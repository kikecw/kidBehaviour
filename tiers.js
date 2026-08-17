const BASIC_PRIVILEGES=[
{id:'pool',name:'Piscina',icon:'🏊'},{id:'reading',name:'Leer antes de dormir',icon:'📖'},{id:'garden_play',name:'Jugar en el jardín',icon:'🌳'},{id:'music_basic',name:'Escuchar música',icon:'🎵'},{id:'board_game',name:'Jugar a un juego de mesa',icon:'🎲'},{id:'bike',name:'Bicicleta / patinete',icon:'🚲'},{id:'ball',name:'Jugar al fútbol o a la pelota',icon:'⚽'},{id:'crafts',name:'Dibujar, manualidades o plastilina',icon:'🎨'},{id:'lego',name:'Puzles / Lego',icon:'🧩'},{id:'park',name:'Ir al parque',icon:'🛝'}];
const BLUE_PRIVILEGES=[
{id:'blue_sweet',name:'Dulce',icon:'🍬'},{id:'blue_tv15',name:'15 min de TV',icon:'📺'},{id:'blue_extra_story',name:'Cuento extra antes de dormir',icon:'📚'},{id:'blue_treat',name:'Elegir un capricho pequeño durante la compra',icon:'🛒'},{id:'blue_garden',name:'Más tiempo en el jardín',icon:'🌳'},{id:'blue_car_music',name:'Elegir música en el coche',icon:'🎵'}];
const GOLD_PRIVILEGES=[
{id:'gold_friend',name:'Invitar a un amigo',icon:'🧑‍🤝‍🧑'},{id:'gold_parent',name:'Plan con papá o mamá',icon:'❤️'},{id:'gold_dinner',name:'Elegir cena',icon:'🍽️'},{id:'gold_breakfast',name:'Elegir desayuno especial del finde',icon:'🥞'},{id:'gold_family',name:'Elegir actividad familiar en casa',icon:'🏠'}];

// MVP 2.0 migration: the former mixed privilege list becomes the new basic list.
state.privileges=BASIC_PRIVILEGES.map(p=>({...p,active:true}));
state.bluePrivileges=BLUE_PRIVILEGES;
state.goldPrivileges=GOLD_PRIVILEGES;
Object.values(state.days).forEach(d=>{d.lostPrivileges=(d.lostPrivileges||[]).filter(id=>BASIC_PRIVILEGES.some(p=>p.id===id));d.earnedPrivileges=d.earnedPrivileges||[]});
saveCustomPrivileges();

function earnedForDay(d){const list=d.card==='blue'?state.bluePrivileges:d.card==='gold'?state.goldPrivileges:[];const ids=new Set(d.earnedPrivileges||[]);return list.filter(p=>ids.has(p.id))}

const tierChildCard=childCard;
childCard=function(c,dateKey){
  const html=tierChildCard(c,dateKey),d=getDay(c.id,dateKey),earned=earnedForDay(d);
  if(!earned.length)return html;
  const block=`<div class="earned-block"><h3>${d.card==='gold'?'⭐ Premios especiales ganados':'🔵 Extras ganados hoy'}</h3><div class="priv-grid">${earned.map(p=>`<span class="priv earned">${p.icon} ${escapeHtml(p.name)} ✓</span>`).join('')}</div></div>`;
  return html.replace('</article>',`${block}</article>`);
};

const tierModalHtml=modalHtml;
modalHtml=function(){
  let html=tierModalHtml();if(!ui.modal)return html;
  const d=getDay(ui.modal.childId,ui.modal.dateKey);
  const chooser=(type,list,title,help)=>`<div id="${type}Privileges" class="${d.card===type?'':'hidden'}"><h3>${title}</h3><p>${help}</p>${list.map(p=>`<label class="check"><input type="checkbox" data-earned="${type}" value="${p.id}" ${(d.earnedPrivileges||[]).includes(p.id)?'checked':''}> ${p.icon} ${escapeHtml(p.name)}</label>`).join('')}</div>`;
  html=html.replace('<button class="primary" data-save-card>',`${chooser('blue',state.bluePrivileges,'🔵 Elige los extras que gana','Puedes activar uno, varios o todos.')}${chooser('gold',state.goldPrivileges,'⭐ Elige los premios especiales que gana','Puedes activar uno, varios o todos.')}<button class="primary" data-save-card>`);
  return html;
};

const tierSettingsPage=settingsPage;
settingsPage=function(){
  let html=tierSettingsPage();
  const blue=`<section class="panel"><h2>🔵 Extras de tarjeta azul</h2><p>Se conceden al terminar el día con tarjeta azul.</p>${state.bluePrivileges.map(p=>`<div class="setting-row"><span>${p.icon} ${escapeHtml(p.name)}</span></div>`).join('')}</section>`;
  const gold=`<section class="panel"><h2>⭐ Premios de tarjeta dorada</h2><p>Se conceden por comportamiento excepcional.</p>${state.goldPrivileges.map(p=>`<div class="setting-row"><span>${p.icon} ${escapeHtml(p.name)}</span></div>`).join('')}</section>`;
  html=html.replace('<h2>Privilegios</h2>','<h2>⚪ Privilegios básicos</h2>').replace('<p>Modifica los privilegios que utilizáis en casa.</p>','<p>Disponibles con blanca. La amarilla puede quitar algunos y la roja/negra los quita todos.</p>');
  return html.replace('<section class="panel"><h2>Datos</h2>',`${blue}${gold}<section class="panel"><h2>Datos</h2>`);
};

const tierWire=wire;
wire=function(){
  tierWire();
  document.querySelectorAll('[data-pick]').forEach(b=>{const old=b.onclick;b.onclick=()=>{old?.();setTimeout(()=>{},0)}});
  const saveButton=document.querySelector('[data-save-card]');
  if(saveButton){const original=saveButton.onclick;saveButton.onclick=()=>{
    const {childId,dateKey}=ui.modal||{};if(!childId)return original?.();
    const d=getDay(childId,dateKey);const selected=document.querySelector('[data-pick].selected')?.dataset.pick||d.card;
    if(selected==='blue'||selected==='gold'){
      d.earnedPrivileges=[...document.querySelectorAll(`input[data-earned="${selected}"]:checked`)].map(x=>x.value);
    }else d.earnedPrivileges=[];
    setDay(d);original?.();
  }}
};

// Extend card selection UI so blue/gold choosers follow the selected card immediately.
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-pick]');if(!b)return;setTimeout(()=>{const selected=b.dataset.pick;document.getElementById('bluePrivileges')?.classList.toggle('hidden',selected!=='blue');document.getElementById('goldPrivileges')?.classList.toggle('hidden',selected!=='gold')},0)});
render();