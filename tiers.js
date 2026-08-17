const BASIC_PRIVILEGES=[
{id:'pool',name:'Piscina',icon:'🏊'},{id:'reading',name:'Leer antes de dormir',icon:'📖'},{id:'garden_play',name:'Jugar en el jardín',icon:'🌳'},{id:'music_basic',name:'Escuchar música',icon:'🎵'},{id:'board_game',name:'Jugar a un juego de mesa',icon:'🎲'},{id:'bike',name:'Bicicleta / patinete',icon:'🚲'},{id:'ball',name:'Jugar al fútbol o a la pelota',icon:'⚽'},{id:'crafts',name:'Dibujar, manualidades o plastilina',icon:'🎨'},{id:'lego',name:'Puzles / Lego',icon:'🧩'},{id:'park',name:'Ir al parque',icon:'🛝'}];
const BLUE_PRIVILEGES=[
{id:'blue_sweet',name:'Dulce',icon:'🍬',active:true},{id:'blue_tv15',name:'15 min de TV',icon:'📺',active:true},{id:'blue_extra_story',name:'Cuento extra antes de dormir',icon:'📚',active:true},{id:'blue_treat',name:'Elegir un capricho pequeño durante la compra',icon:'🛒',active:true},{id:'blue_garden',name:'Más tiempo en el jardín',icon:'🌳',active:true},{id:'blue_car_music',name:'Elegir música en el coche',icon:'🎵',active:true}];
const GOLD_PRIVILEGES=[
{id:'gold_friend',name:'Invitar a un amigo',icon:'🧑‍🤝‍🧑',active:true},{id:'gold_parent',name:'Plan con papá o mamá',icon:'❤️',active:true},{id:'gold_dinner',name:'Elegir cena',icon:'🍽️',active:true},{id:'gold_breakfast',name:'Elegir desayuno especial del finde',icon:'🥞',active:true},{id:'gold_family',name:'Elegir actividad familiar en casa',icon:'🏠',active:true}];

if(!Array.isArray(state.bluePrivileges)||!state.bluePrivileges.length)state.bluePrivileges=BLUE_PRIVILEGES.map(p=>({...p}));
else state.bluePrivileges=state.bluePrivileges.map(p=>({...p,active:p.active!==false}));
if(!Array.isArray(state.goldPrivileges)||!state.goldPrivileges.length)state.goldPrivileges=GOLD_PRIVILEGES.map(p=>({...p}));
else state.goldPrivileges=state.goldPrivileges.map(p=>({...p,active:p.active!==false}));
Object.values(state.days).forEach(d=>{d.earnedPrivileges=d.earnedPrivileges||[]});
save();

function earnedForDay(d){const list=d.card==='blue'?state.bluePrivileges:d.card==='gold'?state.goldPrivileges:[];const ids=new Set(d.earnedPrivileges||[]);return list.filter(p=>ids.has(p.id))}
function tierList(type){return type==='blue'?state.bluePrivileges:state.goldPrivileges}
function saveTierPrivileges(){save();}

const tierChildCard=childCard;
childCard=function(c,dateKey){
  const html=tierChildCard(c,dateKey),d=getDay(c.id,dateKey),earned=earnedForDay(d);
  if(!earned.length)return html;
  const block=`<div class="earned-block"><h3>${d.card==='gold'?'⭐ Premios especiales ganados':'🔵 Extras ganados hoy'}</h3><div class="priv-grid">${earned.map(p=>`<span class="priv earned">${p.icon} ${escapeHtml(p.name)} ✓</span>`).join('')}</div></div>`;
  return html.replace('</article>',`${block}</article>`);
};

let tierEditor=null;
const tierModalHtml=modalHtml;
modalHtml=function(){
  let html=tierModalHtml();
  if(ui.modal){
    const d=getDay(ui.modal.childId,ui.modal.dateKey);
    const chooser=(type,list,title,help)=>`<div id="${type}Privileges" class="${d.card===type?'':'hidden'}"><h3>${title}</h3><p>${help}</p>${list.filter(p=>p.active!==false).map(p=>`<label class="check"><input type="checkbox" data-earned="${type}" value="${p.id}" ${(d.earnedPrivileges||[]).includes(p.id)?'checked':''}> ${p.icon} ${escapeHtml(p.name)}</label>`).join('')}</div>`;
    html=html.replace('<button class="primary" data-save-card>',`${chooser('blue',state.bluePrivileges,'🔵 Elige los extras que gana','Puedes activar uno, varios o todos.')}${chooser('gold',state.goldPrivileges,'⭐ Elige los premios especiales que gana','Puedes activar uno, varios o todos.')}<button class="primary" data-save-card>`);
  }
  if(!tierEditor)return html;
  const list=tierList(tierEditor.type),p=tierEditor.id?list.find(x=>x.id===tierEditor.id):null,label=tierEditor.type==='blue'?'extra azul':'premio dorado';
  return html+`<div class="overlay priv-overlay"><div class="sheet priv-sheet"><div class="sheet-head"><div><h2>${p?'Editar':'Nuevo'} ${label}</h2><p>Elige un icono y un nombre.</p></div><button data-tier-close>✕</button></div><label>Icono<input id="tierIcon" maxlength="8" value="${escapeHtml(p?.icon||'🎁')}"></label><label>Nombre<input id="tierName" maxlength="60" value="${escapeHtml(p?.name||'')}" placeholder="Ej. Elegir película"></label><button class="primary" data-tier-save>${p?'Guardar cambios':'Añadir'}</button></div></div>`;
};

const tierSettingsPage=settingsPage;
settingsPage=function(){
  let html=tierSettingsPage();
  const section=(type,title,desc,list)=>`<section class="panel"><div class="priv-title"><div><h2>${title}</h2><p>${desc}</p></div><button class="priv-add" data-tier-add="${type}">+ Añadir</button></div>${list.map(p=>`<div class="priv-setting"><div><strong>${p.icon||'🎁'} ${escapeHtml(p.name)}</strong>${p.active===false?'<small>Inactivo</small>':''}</div><div class="priv-actions"><button data-tier-toggle="${type}:${p.id}">${p.active===false?'Activar':'Desactivar'}</button><button data-tier-edit="${type}:${p.id}">Editar</button><button class="priv-delete" data-tier-delete="${type}:${p.id}">Eliminar</button></div></div>`).join('')||'<p>No hay elementos configurados.</p>'}</section>`;
  const blue=section('blue','🔵 Extras de tarjeta azul','Se pueden conceder al terminar el día con tarjeta azul.',state.bluePrivileges);
  const gold=section('gold','⭐ Premios de tarjeta dorada','Se pueden conceder por comportamiento excepcional.',state.goldPrivileges);
  html=html.replace('<h2>Privilegios</h2>','<h2>⚪ Privilegios básicos</h2>').replace('<p>Modifica los privilegios que utilizáis en casa.</p>','<p>Disponibles con blanca. La amarilla puede quitar algunos y la roja/negra los quita todos.</p>');
  return html.replace('<section class="panel"><h2>Datos</h2>',`${blue}${gold}<section class="panel"><h2>Datos</h2>`);
};

const tierWire=wire;
wire=function(){
  tierWire();
  const saveButton=document.querySelector('[data-save-card]');
  if(saveButton){const original=saveButton.onclick;saveButton.onclick=()=>{
    const {childId,dateKey}=ui.modal||{};if(!childId)return original?.();
    const d=getDay(childId,dateKey);const selected=document.querySelector('[data-pick].selected')?.dataset.pick||d.card;
    if(selected==='blue'||selected==='gold')d.earnedPrivileges=[...document.querySelectorAll(`input[data-earned="${selected}"]:checked`)].map(x=>x.value);else d.earnedPrivileges=[];
    setDay(d);original?.();
  }}
  document.querySelectorAll('[data-tier-add]').forEach(b=>b.onclick=()=>{tierEditor={type:b.dataset.tierAdd,id:null};render()});
  document.querySelectorAll('[data-tier-edit]').forEach(b=>b.onclick=()=>{const[type,id]=b.dataset.tierEdit.split(':');tierEditor={type,id};render()});
  document.querySelectorAll('[data-tier-toggle]').forEach(b=>b.onclick=()=>{const[type,id]=b.dataset.tierToggle.split(':'),p=tierList(type).find(x=>x.id===id);if(p){p.active=p.active===false;saveTierPrivileges();render()}});
  document.querySelectorAll('[data-tier-delete]').forEach(b=>b.onclick=()=>{const[type,id]=b.dataset.tierDelete.split(':'),list=tierList(type),p=list.find(x=>x.id===id);if(p&&confirm(`¿Eliminar “${p.name}”?`)){if(type==='blue')state.bluePrivileges=list.filter(x=>x.id!==id);else state.goldPrivileges=list.filter(x=>x.id!==id);Object.values(state.days).forEach(d=>d.earnedPrivileges=(d.earnedPrivileges||[]).filter(x=>x!==id));saveTierPrivileges();render()}});
  document.querySelector('[data-tier-close]')?.addEventListener('click',()=>{tierEditor=null;render()});
  document.querySelector('[data-tier-save]')?.addEventListener('click',()=>{const name=document.getElementById('tierName').value.trim(),icon=document.getElementById('tierIcon').value.trim()||'🎁';if(!name){alert('Escribe un nombre.');return}const list=tierList(tierEditor.type);if(tierEditor.id){const p=list.find(x=>x.id===tierEditor.id);p.name=name;p.icon=icon}else list.push({id:`${tierEditor.type}_${Date.now()}`,name,icon,active:true});saveTierPrivileges();tierEditor=null;ui.toast='Privilegios actualizados ✓';render();setTimeout(()=>{ui.toast=null;render()},1800)});
};

document.addEventListener('click',e=>{const b=e.target.closest?.('[data-pick]');if(!b)return;setTimeout(()=>{const selected=b.dataset.pick;document.getElementById('bluePrivileges')?.classList.toggle('hidden',selected!=='blue');document.getElementById('goldPrivileges')?.classList.toggle('hidden',selected!=='gold')},0)});
render();