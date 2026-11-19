'use strict';

const STORAGE_KEY = 'nota_ai_college_v1';
const FOLDERS = ['Учёба', 'Проекты', 'Личное', 'Идеи'];
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => (crypto.randomUUID?.() || `n-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dayOffset = (days) => { const d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+days); return localISO(d); };
const simpleDate = (s) => { if (!s || !/^\d{4}-\d\d-\d\d$/.test(s)) return ''; const [y,m,d]=s.split('-').map(Number); const date = new Date(y,m-1,d); return date.getFullYear()===y && date.getMonth()+1===m && date.getDate()===d ? s : ''; };
const dateLabel = (s) => { const v=simpleDate(s); return v ? new Date(`${v}T12:00:00`).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}) : 'Нет даты'; };
const daysUntil = (date) => { const base=new Date();base.setHours(12,0,0,0);const target=new Date(`${date}T12:00:00`);return Math.round((target-base)/86400000); };
const now = () => new Date().toISOString();
const seedNotes = () => [
  {id:uid(),title:'Базы данных · конспект',folder:'Учёба',tags:['SQL','конспект'],deadline:dayOffset(6),done:false,favorite:true,content:'# Реляционные базы данных\n\nБаза данных — организованная коллекция информации.\n\n## Основные понятия\n\n| Понятие | Значение |\n| --- | --- |\n| Таблица | Набор строк и столбцов |\n| Первичный ключ | Уникальный идентификатор записи |\n| SQL | Язык запросов к данным |\n\n## Повторить\n- [x] Что такое таблица\n- [ ] JOIN и объединения\n- [ ] Нормализация данных',updatedAt:now(),createdAt:now()},
  {id:uid(),title:'Курсовой проект · задачи',folder:'Проекты',tags:['курсовая','важно'],deadline:dayOffset(3),done:false,favorite:false,content:'# План выполнения\n\n- [x] Выбрать тему\n- [ ] Сделать прототип интерфейса\n- [ ] Реализовать ключевые функции\n- [ ] Подготовить отчёт\n\n| Этап | Результат |\n| --- | --- |\n| Анализ | Требования |\n| Разработка | Рабочий прототип |\n| Защита | Презентация проекта |',updatedAt:now(),createdAt:now()},
  {id:uid(),title:'Идеи для мини-приложений',folder:'Идеи',tags:['продукт'],deadline:'',done:false,favorite:false,content:'# Что можно разработать\n\n- Умные заметки с AI\n- Трекер привычек\n- Календарь подготовки к сессии\n\n**Главная идея:** полезный продукт может быть небольшим.',updatedAt:now(),createdAt:now()},
  {id:uid(),title:'Подготовка к зачёту',folder:'Учёба',tags:['сессия'],deadline:dayOffset(10),done:false,favorite:false,content:'# Подготовка к зачёту\n\n- [ ] Повторить первые три темы\n- [ ] Решить практические задания\n- [ ] Проверить определения\n- [ ] Встретиться с преподавателем',updatedAt:now(),createdAt:now()}
];
function validNote(n){
  if (!n || typeof n !== 'object') return null;
  return {id:typeof n.id==='string'&&n.id.length<100?n.id:uid(),title:String(n.title||'Без названия').slice(0,120),content:String(n.content||'').slice(0,100000),folder:FOLDERS.includes(n.folder)?n.folder:'Учёба',tags:Array.isArray(n.tags)?n.tags.filter(t=>typeof t==='string').slice(0,12).map(t=>t.slice(0,32)):[],deadline:simpleDate(n.deadline),done:!!n.done,favorite:!!n.favorite,createdAt:n.createdAt||now(),updatedAt:n.updatedAt||now()};
}
function loadNotes(){
  try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));if(Array.isArray(saved))return saved.map(validNote).filter(Boolean).slice(0,500);}catch(error){console.warn('Failed to load notes',error);}
  return seedNotes();
}
const state = {notes:loadNotes(),filter:'all',folder:'',search:'',activeId:null,editorMode:'edit',aiMode:'demo',pendingActions:[]};
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state.notes));}catch{toast('Место в браузере закончилось — экспортируй заметки');}}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),2700);}
function currentNote(){return state.notes.find(n=>n.id===state.activeId);}
function textExcerpt(text){return String(text||'').replace(/^\s*#{1,6}\s*/gm,'').replace(/\|/g,' ').replace(/[-*]\s*\[[x ]\]/gi,'').replace(/[*_`]/g,'').replace(/\s+/g,' ').trim().slice(0,115)||'Пока здесь пусто. Начни с идеи...';}
function timeLabel(iso){const d=new Date(iso);return Number.isNaN(d.getTime())?'недавно':d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'});}
function dueClass(note){if(note.done)return '';const d=daysUntil(note.deadline);return d<0?'overdue':d<=3?'soon':'';}
function dueText(note){if(note.done)return 'Готово';const d=daysUntil(note.deadline);return d<0?`Просрочено · ${dateLabel(note.deadline)}`:d===0?'Сегодня':d===1?'Завтра':`До ${dateLabel(note.deadline)}`;}
function renderNav(){
  $('navAllCount').textContent=state.notes.length;
  document.querySelectorAll('.nav-btn').forEach(btn=>btn.classList.toggle('is-active',btn.dataset.view===state.filter&&state.filter!=='folder'||state.filter==='folder'&&btn.dataset.folder===state.folder));
  $('todayLabel').textContent=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',weekday:'short'});
}
function deadlineItems(){return state.notes.filter(n=>!!n.deadline).sort((a,b)=>Number(a.done)-Number(b.done)||a.deadline.localeCompare(b.deadline));}
function renderDeadlineRows(target,notes){
  target.innerHTML=notes.length?`<div class="deadlines-list">${notes.map(n=>`<div class="deadline-row ${n.done?'is-done':''}"><button class="deadline-check" data-toggle-done="${escapeHtml(n.id)}" title="Отметить готовым">${n.done?'✓':''}</button><div class="deadline-text" data-open="${escapeHtml(n.id)}"><div class="deadline-title">${escapeHtml(n.title)}</div><div class="deadline-folder">${escapeHtml(n.folder)}</div></div><span class="due ${dueClass(n)}">${dueText(n)}</span></div>`).join('')}</div>`:'<div class="empty-state"><div class="empty-icon">◷</div><strong>Всё спокойно</strong>Пока нет запланированных дедлайнов.</div>';
}
function renderDashboard(){
  renderNav();
  $('dashboardView').classList.remove('hidden');$('editorView').classList.add('hidden');
  const titles={all:'Последние заметки',favorites:'Избранные заметки',deadlines:'Все дедлайны',folder:state.folder};
  $('crumbTitle').textContent=titles[state.filter];
  $('sectionTitle').textContent=titles[state.filter];
  $('sectionOverline').textContent=state.filter==='deadlines'?'ТВОЁ РАСПИСАНИЕ':'ТВОЁ ПРОСТРАНСТВО';
  $('stats').innerHTML=`<div class="stat-card"><div class="stat-icon">▤</div><div><div class="stat-number">${state.notes.length}</div><div class="stat-name">Всего заметок</div></div></div><div class="stat-card"><div class="stat-icon">◷</div><div><div class="stat-number">${state.notes.filter(n=>n.deadline&&!n.done).length}</div><div class="stat-name">Активных дедлайнов</div></div></div><div class="stat-card"><div class="stat-icon">✦</div><div><div class="stat-number">${state.notes.filter(n=>n.deadline&&!n.done&&daysUntil(n.deadline)>=0&&daysUntil(n.deadline)<=7).length}</div><div class="stat-name">Задачи на 7 дней</div></div></div>`;
  $('searchInput').value=state.search;
  $('miniDeadlinesSection').classList.toggle('hidden',state.filter==='deadlines');
  let items=[...state.notes];
  if(state.filter==='favorites')items=items.filter(n=>n.favorite);
  if(state.filter==='folder')items=items.filter(n=>n.folder===state.folder);
  if(state.filter==='deadlines')items=items.filter(n=>n.deadline);
  if(state.search){const q=state.search.toLocaleLowerCase('ru');items=items.filter(n=>`${n.title} ${n.content} ${n.tags.join(' ')} ${n.folder}`.toLocaleLowerCase('ru').includes(q));}
  if(state.filter==='deadlines')items.sort((a,b)=>Number(a.done)-Number(b.done)||a.deadline.localeCompare(b.deadline));else items.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  $('notesGrid').innerHTML=items.map(n=>`<article class="note-card" data-open="${escapeHtml(n.id)}" tabindex="0" role="button" aria-label="Открыть заметку ${escapeHtml(n.title)}"><div class="note-card-top"><span class="pill" data-folder="${escapeHtml(n.folder)}">${escapeHtml(n.folder)}</span><button class="note-favorite" data-toggle-favorite="${escapeHtml(n.id)}" aria-label="Избранное">${n.favorite?'★':'☆'}</button></div><h3>${escapeHtml(n.title)}</h3><p class="note-excerpt">${escapeHtml(textExcerpt(n.content))}</p><div class="note-card-foot">${n.tags.slice(0,2).map(t=>`<span class="tag">#${escapeHtml(t)}</span>`).join('')}${n.deadline?`<span class="due ${dueClass(n)}">◷ ${dateLabel(n.deadline)}</span>`:''}<span class="time">${timeLabel(n.updatedAt)}</span></div></article>`).join('')||'<div class="empty-state"><div class="empty-icon">✧</div><strong>Заметок пока нет</strong>Создай первую заметку или попроси об этом ассистента.</div>';
  renderDeadlineRows($('miniDeadlines'),deadlineItems().slice(0,3));
}
function goView(filter,folder=''){
  state.filter=filter;state.folder=folder;state.activeId=null;state.search='';renderDashboard();
}
function createNote(data={}){
  const note=validNote({...data,id:uid(),title:data.title||'Новая заметка',content:data.content||'',folder:data.folder||'Учёба',tags:data.tags||[],deadline:data.deadline||'',done:false,favorite:false,createdAt:now(),updatedAt:now()});
  state.notes.unshift(note);save();return note;
}
function openNote(id){
  const note=state.notes.find(n=>n.id===id);if(!note)return;
  state.activeId=id;$('dashboardView').classList.add('hidden');$('editorView').classList.remove('hidden');
  $('crumbTitle').textContent=note.title;$('noteTitle').value=note.title;$('noteFolder').value=note.folder;$('noteDeadline').value=note.deadline;$('noteTags').value=note.tags.join(', ');$('noteContent').value=note.content;
  $('favoriteBtn').textContent=note.favorite?'★':'☆';state.editorMode='edit';setEditorMode('edit');renderPreview();$('savedIndicator').textContent='● Сохранено';
  document.querySelector('.main-content').scrollTop=0;
}
function newNote(){const n=createNote({title:'Новая заметка',content:'# Мои мысли\n\n'});openNote(n.id);$('noteTitle').focus();$('noteTitle').select();toast('Заметка создана');}
function updateActive(field,value){const n=currentNote();if(!n)return;n[field]=value;n.updatedAt=now();save();$('savedIndicator').textContent='● Сохранено';if(field==='title')$('crumbTitle').textContent=value||'Без названия';if(field==='content')renderPreview();}
function toggleFavorite(id){const n=state.notes.find(n=>n.id===id);if(!n)return;n.favorite=!n.favorite;save();if(state.activeId===id)$('favoriteBtn').textContent=n.favorite?'★':'☆';else renderDashboard();toast(n.favorite?'Добавлено в избранное':'Убрано из избранного');}
function toggleDone(id){const n=state.notes.find(n=>n.id===id);if(!n)return;n.done=!n.done;n.updatedAt=now();save();renderDashboard();}
function deleteCurrent(){const n=currentNote();if(!n)return;if(!confirm(`Удалить заметку «${n.title}»?`))return;state.notes=state.notes.filter(item=>item.id!==n.id);save();goView('all');toast('Заметка удалена');}
function setEditorMode(mode){state.editorMode=mode;const panel=$('editorPanel');panel.classList.toggle('mode-split',mode==='split');panel.classList.toggle('mode-preview',mode==='preview');['Edit','Split','Preview'].forEach(x=>$('mode'+x).classList.toggle('is-current',x.toLowerCase()===mode));}
function inlineMarkdown(s){let v=escapeHtml(s);v=v.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(_,label,url)=>`<a href="${url.replace(/&amp;/g,'&amp;')}" target="_blank" rel="noopener noreferrer">${label}</a>`);v=v.replace(/`([^`]+)`/g,'<code>$1</code>');v=v.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');v=v.replace(/\*([^*\n]+)\*/g,'<em>$1</em>');return v;}
function isTableSeparator(line){return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);}
function parseCells(line){let trimmed=line.trim().replace(/^\|/,'').replace(/\|$/,'');return trimmed.split('|').map(s=>s.trim());}
function markdownToHtml(content){
  const lines=String(content||'').split(/\r?\n/);const out=[];let listOpen=false;
  const closeList=()=>{if(listOpen){out.push('</ul>');listOpen=false;}};
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(line.includes('|')&&lines[i+1]&&isTableSeparator(lines[i+1])){
      closeList();const head=parseCells(line);out.push('<table><thead><tr>'+head.map(h=>`<th>${inlineMarkdown(h)}</th>`).join('')+'</tr></thead><tbody>');i+=2;
      while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()){
        const cells=parseCells(lines[i]);out.push('<tr>'+head.map((_,idx)=>`<td>${inlineMarkdown(cells[idx]||'')}</td>`).join('')+'</tr>');i++;
      }
      out.push('</tbody></table>');i--;continue;
    }
    if(/^\s*[-*]\s+/.test(line)){
      if(!listOpen){out.push('<ul>');listOpen=true;}
      let item=line.replace(/^\s*[-*]\s+/,'');const check=item.match(/^\[([ xX])\]\s*/);
      if(check){item=item.slice(check[0].length);out.push(`<li><input type="checkbox" disabled ${check[1].toLowerCase()==='x'?'checked':''}> ${inlineMarkdown(item)}</li>`);}else out.push(`<li>${inlineMarkdown(item)}</li>`);continue;
    }
    closeList();if(!line.trim())continue;
    const h=line.match(/^(#{1,3})\s+(.+)/);if(h){out.push(`<h${h[1].length}>${inlineMarkdown(h[2])}</h${h[1].length}>`);continue;}
    if(/^\s*---+\s*$/.test(line)){out.push('<hr>');continue;}
    out.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  closeList();return out.join('');
}
function renderPreview(){$('markdownPreview').innerHTML=markdownToHtml($('noteContent').value)||'<p style="color:#777e90">Пока здесь пусто.</p>';}
function insertMarkdown(type){const el=$('noteContent');const start=el.selectionStart;const end=el.selectionEnd;const selected=el.value.slice(start,end);const map={heading:`## ${selected||'Новый раздел'}`,bold:`**${selected||'важный текст'}**`,list:`- ${selected||'Новый пункт'}`,check:`- [ ] ${selected||'Сделать задачу'}`,table:'| Задача | Статус |\n| --- | --- |\n| Подготовка | В работе |\n| Проверка | Не начато |'};const snippet=map[type];if(!snippet)return;const before=el.value.slice(0,start),after=el.value.slice(end);const pad=before&& !before.endsWith('\n')?'\n':'';el.value=before+pad+snippet+after;el.focus();el.selectionStart=el.selectionEnd=(before+pad+snippet).length;updateActive('content',el.value);}

function inferFolder(note){const text=`${note.title} ${note.content}`.toLowerCase();if(/курсов|проект|прототип|приложен|разработ|сайт|код/.test(text))return 'Проекты';if(/экзамен|лекци|зач[её]т|конспект|база данных|универ|sql|учеб|преподав|сесси/.test(text))return 'Учёба';if(/иде[яи]|стартап|придум|вдохновен|мысль для/.test(text))return 'Идеи';return 'Личное';}
function inferTags(note){const src=`${note.title} ${note.content}`.toLowerCase();const found=[];for(const [re,tag] of [[/sql|баз[аыу] данных/,'базы-данных'],[/курсов|проект/,'проект'],[/экзамен|зач[её]т|сесси/,'учёба'],[/срок|дедлайн/,'сроки'],[/иде[яию]/,'идеи']])if(re.test(src))found.push(tag);return found;}
function detectDate(text){const lower=text.toLowerCase();if(/послезавтра/.test(lower))return dayOffset(2);if(/завтра/.test(lower))return dayOffset(1);if(/сегодня/.test(lower))return dayOffset(0);const through=lower.match(/через\s+(\d{1,3})\s+дн/);if(through)return dayOffset(Number(through[1]));let match=lower.match(/(?:на|до)\s+(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?/);if(match)return dateFromParts(+match[1],+match[2],match[3]?+match[3]:null);match=lower.match(/(?:на|до)\s+(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?/);if(match)return dateFromParts(+match[1],MONTHS.indexOf(match[2])+1,match[3]?+match[3]:null);return '';
}
function dateFromParts(day,month,year){const today=new Date();const y=year||today.getFullYear();let result=simpleDate(`${y}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`);if(!year&&result&&result<localISO(today))result=simpleDate(`${y+1}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`);return result;}
function findMentionedNote(prompt){const lower=prompt.toLowerCase();if(/этой заметк|текущ[а-я]* заметк/.test(lower)&&currentNote())return currentNote();const matches=state.notes.filter(n=>lower.includes(n.title.toLowerCase())||n.title.toLowerCase().split(/[\s·—–-]+/).filter(w=>w.length>=5).some(w=>lower.includes(w)));return matches.sort((a,b)=>b.title.length-a.title.length)[0]||null;}
function localAssistant(prompt){
  const lower=prompt.toLowerCase();
  if(/(разлож|организ|сортир|упорядоч|распреде).*(замет|папк)|(теги.*всем)|(по папкам)/.test(lower)){
    const actions=state.notes.map(n=>({type:'update_note',noteId:n.id,folder:inferFolder(n),tags:[...new Set([...n.tags,...inferTags(n)])]})).filter(a=>{const original=state.notes.find(n=>n.id===a.noteId);return original.folder!==a.folder||JSON.stringify(original.tags)!==JSON.stringify(a.tags);});
    return {message:actions.length?`Нашёл ${actions.length} заметок, которым можно улучшить папки или теги. Проверь предложения перед сохранением.`:'Всё уже организовано: подходящие папки и теги стоят на местах.',actions};
  }
  if(/(дедлайн|срок|напоминан)/.test(lower)&&/(постав|установ|назнач|добав|перенес|измени)/.test(lower)){
    const date=detectDate(prompt);const note=findMentionedNote(prompt);
    if(!date)return {message:'Укажи точную дату. Например: «Поставь дедлайн для курсового проекта на 25 ноября».',actions:[]};
    if(!note)return {message:'Не нашёл, к какой заметке относится дедлайн. Напиши её название или открой нужную заметку и скажи «Поставь дедлайн для этой заметки на 25 ноября».',actions:[]};
    return {message:`Предлагаю поставить дедлайн заметке «${note.title}» на ${dateLabel(date)}.`,actions:[{type:'set_deadline',noteId:note.id,deadline:date}]};
  }
  if(/(дедлайн|срок)/.test(lower)&&/(каки|ближайш|покаж|список|есть|когда)/.test(lower)){
    const upcoming=deadlineItems().filter(n=>!n.done).slice(0,5);return {message:upcoming.length?'Твои активные дедлайны:\n'+upcoming.map(n=>`• ${n.title} — ${dateLabel(n.deadline)}${daysUntil(n.deadline)<0?' (просрочен)':''}`).join('\n'):'Активных дедлайнов нет — отличный момент спланировать работу.',actions:[]};
  }
  if(/(создай|сделай|добавь|составь|напиши).*(заметк|план|таблиц)/.test(lower)){
    const raw=prompt.replace(/^(создай|сделай|добавь|составь|напиши)\s*/i,'').replace(/^(мне\s+)?(новую\s+)?(заметку|план|таблицу)\s*/i,'').replace(/^(по теме|на тему|для|о|об)\s*/i,'').replace(/\s+с\s+таблицей.*$/i,'').replace(/[.!?]+$/,'').trim();
    const title=raw.slice(0,85)||'План на неделю';const wantsTable=/таблиц/.test(lower);const isPlan=/план|подготов|экзамен/.test(lower);
    const content=`# ${title}\n\n${isPlan?'## План действий\n- [ ] Собрать информацию\n- [ ] Разбить задачу на этапы\n- [ ] Выполнить первый этап\n- [ ] Проверить результат\n\n':'Здесь можно собирать важные мысли, задачи и материалы.\n\n'}${wantsTable||isPlan?'| Задача | Приоритет | Статус |\n| --- | --- | --- |\n| Подготовить материалы | Высокий | Не начато |\n| Выполнить работу | Средний | В работе |\n':''}`;
    return {message:`Создам заметку «${title}»${wantsTable?' с Markdown-таблицей':''}.`,actions:[{type:'create_note',title,content,folder:/экзамен|лекци|уч[её]б|зач[её]т/.test(lower)?'Учёба':'Проекты',tags:['план'],deadline:''}]};
  }
  if(/(добавь|вставь|сделай).*таблиц/.test(lower)&&currentNote())return {message:'Добавлю таблицу в открытую заметку.',actions:[{type:'append_content',noteId:state.activeId,content:'\n| Этап | Статус |\n| --- | --- |\n| Подготовка | В процессе |\n| Проверка | Не начато |'}]};
  if(/(кратк|резюм|вывод|суммар|перескаж)/.test(lower)&&currentNote()){
    const note=currentNote();const paragraphs=note.content.split(/\n/).map(s=>s.replace(/^[#|\-\s]+/,'').trim()).filter(s=>s.length>15&&!/^[-:|]/.test(s)).slice(0,4);
    return {message:`Краткий обзор заметки «${note.title}»:\n${paragraphs.length?paragraphs.map(x=>'• '+x.slice(0,120)).join('\n'):'Пока недостаточно текста для обзора.'}\n\nВ деморежиме это простое извлечение текста. С настоящим AI можно получать полноценные выводы.`,actions:[]};
  }
  return {message:'В деморежиме я умею создавать заметки и таблицы, раскладывать их по папкам, добавлять теги, назначать дедлайны и показывать ближайшие сроки. Для свободных сложных команд подключи API-ключ в файле .env.',actions:[]};
}
const ACTION_LABELS={create_note:'Создать заметку',update_note:'Изменить заметку',set_deadline:'Назначить дедлайн',move_note:'Переместить в папку',add_tags:'Добавить теги',append_content:'Добавить текст'};
function safeActions(raw){
  if(!Array.isArray(raw))return [];
  return raw.slice(0,30).filter(a=>a&&typeof a==='object'&&ACTION_LABELS[a.type]).map(a=>({type:a.type,noteId:String(a.noteId||'').slice(0,100),title:String(a.title||'').slice(0,120),content:String(a.content||'').slice(0,12000),folder:FOLDERS.includes(a.folder)?a.folder:'',tags:Array.isArray(a.tags)?a.tags.filter(t=>typeof t==='string').slice(0,12).map(t=>t.slice(0,32)):[],deadline:simpleDate(a.deadline)})).filter(a=>(a.type==='create_note'&&!!a.title)||(state.notes.some(n=>n.id===a.noteId)&&((a.type==='set_deadline'&&!!a.deadline)||(a.type==='move_note'&&!!a.folder)||(a.type==='add_tags'&&a.tags.length>0)||(a.type==='append_content'&&!!a.content)||a.type==='update_note')));
}
function describeAction(a){const n=state.notes.find(n=>n.id===a.noteId);const title=a.title||(n&&n.title)||'Заметка';if(a.type==='create_note')return `Создать «${title}»`;if(a.type==='set_deadline')return `«${title}»: дедлайн ${dateLabel(a.deadline)}`;if(a.type==='move_note')return `«${title}» → ${a.folder}`;if(a.type==='add_tags')return `«${title}»: теги ${a.tags.join(', ')}`;if(a.type==='append_content')return `«${title}»: добавить таблицу или текст`;return `«${n?.title||title}»: обновить папку / теги / содержание`;}
function renderProposal(actions){const box=$('proposalBox');state.pendingActions=actions;if(!actions.length){box.innerHTML='';return;}box.innerHTML=`<div class="proposal"><h4>✦ Предлагаю ${actions.length} изменени${actions.length%10===1&&actions.length%100!==11?'е':actions.length%10>=2&&actions.length%10<=4&&(actions.length%100<12||actions.length%100>14)?'я':'й'}</h4><ul>${actions.slice(0,7).map(a=>`<li>${escapeHtml(describeAction(a))}</li>`).join('')}${actions.length>7?`<li>И ещё ${actions.length-7}…</li>`:''}</ul><div class="proposal-actions"><button class="apply" id="applyActions">✓ Применить</button><button class="cancel" id="cancelActions">Отменить</button></div></div>`;}
function applyActions(){
  let count=0;let newest=null;
  for(const a of state.pendingActions){
    if(a.type==='create_note'){if(!a.title)continue;newest=createNote(a);count++;continue;}
    const n=state.notes.find(item=>item.id===a.noteId);if(!n)continue;
    if(a.type==='set_deadline'&&a.deadline){n.deadline=a.deadline;n.done=false;count++;}
    else if(a.type==='move_note'&&a.folder){n.folder=a.folder;count++;}
    else if(a.type==='add_tags'){n.tags=[...new Set([...n.tags,...a.tags])];count++;}
    else if(a.type==='append_content'&&a.content){n.content+='\n'+a.content;count++;}
    else if(a.type==='update_note'){
      if(a.title)n.title=a.title;if(a.content)n.content=a.content;if(a.folder)n.folder=a.folder;if(a.tags.length)n.tags=a.tags;if(a.deadline)n.deadline=a.deadline;count++;
    }else continue;
    n.updatedAt=now();
  }
  save();renderProposal([]);if(newest)openNote(newest.id);else if(currentNote())openNote(state.activeId);else renderDashboard();
  addChat('assistant',`Готово! Применено изменений: ${count}.`);toast(`Готово! Изменений: ${count}`);
}
function addChat(role,text){const div=document.createElement('div');div.className=`chat-msg ${role}`;div.textContent=text;$('chatHistory').appendChild(div);$('aiScroll').scrollTop=$('aiScroll').scrollHeight;}
async function initAiMode(){try{const response=await fetch('/api/status');if(!response.ok)throw new Error('No server');const info=await response.json();state.aiMode=info.ai?'real':'demo';}catch{state.aiMode='demo';}$('aiMode').textContent=state.aiMode==='real'?'● AI подключён · Groq API':'● Деморежим · без нейросети';}
async function runAssistant(prompt){
  if(!prompt.trim())return;$('aiPrompt').value='';renderProposal([]);addChat('user',prompt);$('sendAiBtn').disabled=true;$('sendAiBtn').textContent='…';
  try{
    let result;
    if(state.aiMode==='real'){
      const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,notes:state.notes.map(n=>({id:n.id,title:n.title,content:n.content.slice(0,1000),folder:n.folder,tags:n.tags,deadline:n.deadline,done:n.done})).slice(0,60),activeId:state.activeId,today:localISO(new Date())})});
      const payload=await response.json();if(!response.ok)throw new Error(payload.error||`Ошибка ${response.status}`);result=payload;
    }else result=localAssistant(prompt);
    addChat('assistant',String(result.message||'Готово.').slice(0,3000));renderProposal(safeActions(result.actions));
  }catch(error){addChat('assistant',`Не удалось обработать команду: ${error.message}. Заметки не изменились.`);}finally{$('sendAiBtn').disabled=false;$('sendAiBtn').textContent='↑';$('aiScroll').scrollTop=$('aiScroll').scrollHeight;}
}
function exportData(){const data=JSON.stringify({app:'Nota AI',version:1,exportedAt:now(),notes:state.notes},null,2);const blob=new Blob([data],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`nota-backup-${localISO(new Date())}.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Резервная копия скачана');}
async function importData(file){try{if(file.size>10_000_000)throw Error('Файл слишком большой');const raw=JSON.parse(await file.text());const data=Array.isArray(raw)?raw:raw.notes;if(!Array.isArray(data))throw Error('Нет списка заметок');const parsed=data.map(validNote).filter(Boolean).slice(0,500);if(!confirm(`Импортировать ${parsed.length} заметок? Текущие заметки будут заменены.`))return;state.notes=parsed;state.activeId=null;save();goView('all');toast('Заметки импортированы');}catch(e){toast('Ошибка импорта: '+e.message);}finally{$('importFile').value='';}}
function attachEvents(){
  ['sidebarCreate','heroCreate','newFromList'].forEach(id=>$(id).addEventListener('click',newNote));
  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>goView(btn.dataset.view)));
  document.querySelectorAll('[data-folder]').forEach(btn=>{if(btn.matches('button.folder-btn'))btn.addEventListener('click',()=>goView('folder',btn.dataset.folder));});
  $('homeBtn').addEventListener('click',()=>goView('all'));$('viewDeadlines').addEventListener('click',()=>goView('deadlines'));$('backBtn').addEventListener('click',()=>goView('all'));
  $('searchInput').addEventListener('input',e=>{state.search=e.target.value;renderDashboard();$('searchInput').focus();$('searchInput').setSelectionRange(state.search.length,state.search.length);});
  document.addEventListener('click',e=>{
    const favorite=e.target.closest('[data-toggle-favorite]');if(favorite){e.stopPropagation();toggleFavorite(favorite.dataset.toggleFavorite);return;}
    const done=e.target.closest('[data-toggle-done]');if(done){toggleDone(done.dataset.toggleDone);return;}
    const open=e.target.closest('[data-open]');if(open){openNote(open.dataset.open);return;}
    if(e.target.id==='applyActions')applyActions();if(e.target.id==='cancelActions'){renderProposal([]);toast('Изменения отменены');}
  });
  $('notesGrid').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-open]')){e.preventDefault();openNote(e.target.dataset.open);}});
  $('noteTitle').addEventListener('input',e=>updateActive('title',e.target.value));$('noteContent').addEventListener('input',e=>updateActive('content',e.target.value));$('noteFolder').addEventListener('change',e=>updateActive('folder',e.target.value));$('noteDeadline').addEventListener('change',e=>{updateActive('deadline',simpleDate(e.target.value));if(currentNote())currentNote().done=false;save();});$('noteTags').addEventListener('change',e=>updateActive('tags',[...new Set(e.target.value.split(',').map(x=>x.trim()).filter(Boolean))].slice(0,12)));
  $('favoriteBtn').addEventListener('click',()=>toggleFavorite(state.activeId));$('deleteBtn').addEventListener('click',deleteCurrent);
  ['Edit','Split','Preview'].forEach(x=>$('mode'+x).addEventListener('click',()=>setEditorMode(x.toLowerCase())));
  document.querySelectorAll('[data-insert]').forEach(btn=>btn.addEventListener('click',()=>insertMarkdown(btn.dataset.insert)));
  document.querySelectorAll('[data-prompt]').forEach(btn=>btn.addEventListener('click',()=>{$('aiPrompt').value=btn.dataset.prompt;$('aiPrompt').focus();}));
  $('aiForm').addEventListener('submit',e=>{e.preventDefault();runAssistant($('aiPrompt').value.trim());});
  $('aiPrompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('aiForm').requestSubmit();}});
  $('exportBtn').addEventListener('click',exportData);$('importBtn').addEventListener('click',()=>$('importFile').click());$('importFile').addEventListener('change',e=>{if(e.target.files[0])importData(e.target.files[0]);});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();goView('all');$('searchInput').focus();}if(e.key.toLowerCase()==='n'&&!e.ctrlKey&&!e.metaKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();newNote();}});
}
attachEvents();renderDashboard();initAiMode();save();
