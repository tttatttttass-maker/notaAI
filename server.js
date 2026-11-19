/** Nota AI — tiny dependency-free Node.js server, Node >=18 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = __dirname;
try {
  const envText = fs.readFileSync(path.join(ROOT,'.env'),'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]]=match[2].replace(/^(\"|')|(?:\"|')$/g,'');
  }
} catch { /* .env is optional */ }
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const KEY = process.env.GROQ_API_KEY || '';
const FILES = {'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css'};
const MIME = {'html':'text/html; charset=utf-8','js':'application/javascript; charset=utf-8','css':'text/css; charset=utf-8'};
const SYSTEM = `Ты встроенный AI-органайзер небольшого приложения Nota AI. Общайся на русском, лаконично, дружелюбно.
Твоя задача: преобразовать команду пользователя в предложение конкретных действий с заметками.
Всегда возвращай объект JSON, никакого дополнительного текста вне JSON.
Допустимые действия:
create_note: title, content, folder, tags, deadline
update_note: noteId, title, content, folder, tags, deadline
set_deadline: noteId, deadline
move_note: noteId, folder
add_tags: noteId, tags
append_content: noteId, content
Поля для всех действий обязательны, если неприменимы — пустая строка или пустой массив. Папки: Учёба, Проекты, Личное, Идеи.
Для update_note непустые значения полей заменяют прежние; пустые означают «оставь как было».
Нельзя придумывать noteId: используй только ID из контекста (для создания noteId пуст).
Если пользователь просит таблицу — используй таблицу Markdown с разделителем | --- |. Для задач — чек-лист - [ ].
Для даты указывай YYYY-MM-DD, при неоднозначности уточни в message и верни actions пустым. Если запрашивают дедлайны — ответь по контексту без actions.
Не выдумывай заметки, которых нет в контексте. Не выполняй разрушительных действий. Возвращай не более 20 действий.
Никакие действия не исполняются автоматически — пользователь подтверждает их отдельно.`;
const actionSchema = {
  type:'object', additionalProperties:false,
  properties:{
    message:{type:'string'},
    actions:{type:'array',items:{type:'object',additionalProperties:false,properties:{
      type:{type:'string',enum:['create_note','update_note','set_deadline','move_note','add_tags','append_content']},
      noteId:{type:'string'},title:{type:'string'},content:{type:'string'},folder:{type:'string'},tags:{type:'array',items:{type:'string'}},deadline:{type:'string'}
    },required:['type','noteId','title','content','folder','tags','deadline']}}
  },required:['message','actions']
};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function readBody(req,limit=120000){return new Promise((resolve,reject)=>{let body='';req.on('data',chunk=>{body+=chunk;if(body.length>limit){reject(new Error('Слишком длинный запрос'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(body));}catch{reject(new Error('Неверный JSON'));}});req.on('error',reject);});}
async function askAI(payload){
  const notes=Array.isArray(payload.notes)?payload.notes.slice(0,60):[];
  const input={today:String(payload.today||''),activeId:String(payload.activeId||''),command:String(payload.prompt||'').slice(0,1400),notes:notes.map(n=>({id:String(n.id||''),title:String(n.title||'').slice(0,120),folder:String(n.folder||''),deadline:String(n.deadline||''),tags:Array.isArray(n.tags)?n.tags.slice(0,12):[],done:!!n.done,content:String(n.content||'').slice(0,1000)}))};
  // Groq Chat Completions API: бесплатный тариф, совместимая с OpenAI структура ответа.
  const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{
    method:'POST',headers:{'Authorization':`Bearer ${KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      model:MODEL,
      messages:[{role:'system',content:SYSTEM},{role:'user',content:JSON.stringify(input)}],
      max_completion_tokens:3500,
      response_format:{type:'json_schema',json_schema:{name:'nota_actions',strict:true,schema:actionSchema}}
    }),signal:AbortSignal.timeout(45000)
  });
  const raw=await response.json();
  if(!response.ok){
    if(response.status===401)return Promise.reject(new Error('Неверный GROQ_API_KEY. Проверь ключ в .env.'));
    if(response.status===429)return Promise.reject(new Error('Лимит бесплатного Groq исчерпан. Попробуй позже.'));
    throw new Error(raw.error?.message||`Groq вернул ошибку ${response.status}`);
  }
  const output=raw.choices?.[0]?.message?.content||'';
  if(!output)throw new Error('Groq не вернул текст. Проверь модель и лимиты.');
  const parsed=JSON.parse(output);
  if(typeof parsed.message!=='string'||!Array.isArray(parsed.actions))throw new Error('Некорректный ответ AI');
  return parsed;
}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/api/status')return json(res,200,{ai:!!KEY,provider:KEY?'Groq':null,model:KEY?MODEL:null});
    if(req.method==='POST'&&url.pathname==='/api/ai'){
      if(!KEY)return json(res,503,{error:'GROQ_API_KEY не задан. Доступен локальный деморежим.'});
      const payload=await readBody(req);if(!payload||typeof payload.prompt!=='string')return json(res,400,{error:'Укажи команду'});
      return json(res,200,await askAI(payload));
    }
    if(req.method==='GET'&&FILES[url.pathname]){
      const file=path.join(ROOT,FILES[url.pathname]);const ext=path.extname(file).slice(1);
      res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff'});
      return fs.createReadStream(file).pipe(res);
    }
    json(res,404,{error:'Страница не найдена'});
  }catch(error){console.error('Request failed:',error.message);if(!res.headersSent)json(res,500,{error:error.message||'Серверная ошибка'});else res.end();}
});
server.listen(PORT,()=>console.log(`\n✦ Nota AI запущен: http://localhost:${PORT}\n  Режим: ${KEY?'Groq ('+MODEL+')':'Демо (без API-ключа)'}\n`));
