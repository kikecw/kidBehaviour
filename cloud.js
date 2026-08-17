const SUPABASE_URL='https://lyhtapcdtlfsbfsinugb.supabase.co';
const SUPABASE_KEY='sb_publishable_w11bXI29syCiMeDNF2N2_g_E_Q1XQa6';
const FAMILY_NAME='Carcamo R-Roda';
const APP_URL='https://kikecw.github.io/kidBehaviour/';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let cloud={session:null,family:null,role:null,ready:false,syncing:false,channel:null,lastRemoteVersion:0,lastSnapshot:''};

function authScreen(message=''){
  document.getElementById('app').innerHTML=`<main class="auth-shell"><section class="auth-card"><div class="auth-logo">👧 🟦 👦</div><h1>KidBehaviour</h1><p class="auth-sub">Familia <strong>${FAMILY_NAME}</strong></p>${message?`<div class="auth-message">${escapeHtml(message)}</div>`:''}<label>Email<input id="authEmail" type="email" autocomplete="email" placeholder="tu@email.com"></label><label>Contraseña<input id="authPassword" type="password" autocomplete="current-password" minlength="6" placeholder="Mínimo 6 caracteres"></label><button class="primary" data-login>Entrar</button><button class="secondary" data-signup>Crear cuenta</button><p class="auth-help">Tus datos se sincronizarán de forma privada entre los adultos de la familia.</p></section></main>`;
  document.querySelector('[data-login]').onclick=()=>authAction('login');
  document.querySelector('[data-signup]').onclick=()=>authAction('signup');
}
async function authAction(kind){
  const email=document.getElementById('authEmail').value.trim(),password=document.getElementById('authPassword').value;
  if(!email||password.length<6){authScreen('Escribe un email y una contraseña de al menos 6 caracteres.');return}
  const result=kind==='signup'?await sb.auth.signUp({email,password,options:{emailRedirectTo:APP_URL}}):await sb.auth.signInWithPassword({email,password});
  if(result.error){authScreen(result.error.message);return}
  if(kind==='signup'&&!result.data.session){authScreen('Cuenta creada. Revisa tu email para confirmarla y después pulsa Entrar.');return}
  await startCloud(result.data.session);
}
function localSnapshot(){return JSON.parse(JSON.stringify(state))}
function snapshotString(){try{return JSON.stringify(state)}catch{return''}}
function migratePrivilegeTiers(){
  if(typeof BASIC_PRIVILEGES==='undefined')return false;
  let changed=false;
  const basicIds=new Set(BASIC_PRIVILEGES.map(p=>p.id));
  const wantedBasics=BASIC_PRIVILEGES.map(p=>({...p,active:true}));
  if(JSON.stringify(state.privileges)!==JSON.stringify(wantedBasics)){state.privileges=wantedBasics;changed=true}
  if(typeof BLUE_PRIVILEGES!=='undefined'&&JSON.stringify(state.bluePrivileges)!==JSON.stringify(BLUE_PRIVILEGES)){state.bluePrivileges=BLUE_PRIVILEGES.map(p=>({...p}));changed=true}
  if(typeof GOLD_PRIVILEGES!=='undefined'&&JSON.stringify(state.goldPrivileges)!==JSON.stringify(GOLD_PRIVILEGES)){state.goldPrivileges=GOLD_PRIVILEGES.map(p=>({...p}));changed=true}
  Object.values(state.days||{}).forEach(d=>{const lost=(d.lostPrivileges||[]).filter(id=>basicIds.has(id));if(JSON.stringify(lost)!==JSON.stringify(d.lostPrivileges||[])){d.lostPrivileges=lost;changed=true}if(!Array.isArray(d.earnedPrivileges)){d.earnedPrivileges=[];changed=true}});
  localStorage.setItem(PRIVILEGE_SETTINGS_KEY,JSON.stringify(state.privileges));
  return changed;
}
async function startCloud(session){
  cloud.session=session;
  if(!session){cloud.ready=false;authScreen();return}
  document.getElementById('app').innerHTML='<main class="auth-shell"><section class="auth-card"><h2>Sincronizando…</h2><p>Preparando tu familia.</p></section></main>';
  try{
    let {data:members,error}=await sb.from('family_members').select('family_id,role').eq('user_id',session.user.id).limit(1);
    if(error)throw error;
    if(!members?.length){
      const {data:invites,error:ie}=await sb.from('invitations').select('id,family_id,role').is('accepted_at',null).gt('expires_at',new Date().toISOString()).limit(1);
      if(ie)throw ie;
      if(invites?.length){const {data:fid,error:ae}=await sb.rpc('accept_family_invitation',{p_invitation_id:invites[0].id});if(ae)throw ae;members=[{family_id:fid,role:invites[0].role}]}
      else {const {data:fid,error:be}=await sb.rpc('bootstrap_family',{p_name:FAMILY_NAME,p_state:localSnapshot()});if(be)throw be;members=[{family_id:fid,role:'admin'}]}
    }
    const member=members[0];cloud.role=member.role;
    const {data:fam,error:fe}=await sb.from('families').select('id,name').eq('id',member.family_id).single();if(fe)throw fe;cloud.family=fam;
    const {data:remote,error:re}=await sb.from('family_state').select('state,version').eq('family_id',fam.id).single();if(re)throw re;
    let migrated=false;
    if(remote?.state&&Object.keys(remote.state).length){state=remote.state;state.children=state.children?.length?state.children:CHILDREN;state.days||={};state.rewards||=[];state.restrictions||=[];migrated=migratePrivilegeTiers();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));cloud.lastRemoteVersion=remote.version||1}
    cloud.lastSnapshot=snapshotString();cloud.ready=true;subscribeFamily();render();if(migrated)await pushCloudState();
  }catch(e){console.error(e);authScreen(`No se pudo preparar la sincronización: ${e.message}`)}
}
async function pushCloudState(){
  if(!cloud.ready||cloud.syncing||!cloud.family||!cloud.session)return;
  cloud.syncing=true;
  try{const snap=snapshotString();const {data,error}=await sb.from('family_state').update({state:localSnapshot(),version:cloud.lastRemoteVersion+1,updated_at:new Date().toISOString(),updated_by:cloud.session.user.id}).eq('family_id',cloud.family.id).select('version').single();if(error)throw error;cloud.lastRemoteVersion=data.version;cloud.lastSnapshot=snap}catch(e){console.error('Cloud save failed',e)}finally{cloud.syncing=false}
}
function subscribeFamily(){
  if(cloud.channel)sb.removeChannel(cloud.channel);
  cloud.channel=sb.channel(`family:${cloud.family.id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'family_state',filter:`family_id=eq.${cloud.family.id}`},payload=>{const row=payload.new;if(!row||row.updated_by===cloud.session.user.id||row.version<=cloud.lastRemoteVersion)return;cloud.lastRemoteVersion=row.version;state=row.state;state.children=state.children?.length?state.children:CHILDREN;state.days||={};state.rewards||=[];state.restrictions||=[];migratePrivilegeTiers();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));cloud.lastSnapshot=snapshotString();render()}).subscribe();
}
async function inviteAdult(email){
  if(cloud.role!=='admin')return {error:new Error('Solo un administrador puede invitar adultos.')};
  const clean=email.trim().toLowerCase();
  const {data:existing,error:findError}=await sb.from('invitations').select('id').eq('family_id',cloud.family.id).eq('email',clean).is('accepted_at',null).limit(1);
  if(findError)return {error:findError};
  if(!existing?.length){const {error:insertError}=await sb.from('invitations').insert({family_id:cloud.family.id,email:clean,role:'adult',invited_by:cloud.session.user.id});if(insertError)return {error:insertError}}
  const {error:mailError}=await sb.auth.signInWithOtp({email:clean,options:{emailRedirectTo:APP_URL,shouldCreateUser:true}});
  return {error:mailError};
}
async function logoutCloud(){await sb.auth.signOut();cloud={session:null,family:null,role:null,ready:false,syncing:false,channel:null,lastRemoteVersion:0,lastSnapshot:''};authScreen()}

setInterval(()=>{if(!cloud.ready||cloud.syncing)return;const now=snapshotString();if(now&&now!==cloud.lastSnapshot)pushCloudState()},800);

const cloudSettingsPage=settingsPage;
settingsPage=function(){const base=cloudSettingsPage();if(!cloud.ready)return base;return `<section class="panel family-panel"><div class="family-title"><div><h2>Familia</h2><p>${escapeHtml(cloud.family.name)}</p></div><span class="role-pill">${cloud.role==='admin'?'Administrador':'Adulto'}</span></div><div class="setting-row"><span>👤 ${escapeHtml(cloud.session.user.email||'')}</span><strong>Conectado</strong></div>${cloud.role==='admin'?`<div class="invite-box"><label>Invitar a otro adulto<input id="inviteEmail" type="email" placeholder="email@ejemplo.com"></label><button class="secondary" data-invite>Enviar invitación</button><p>Recibirá un enlace por email. Al abrirlo, KidBehaviour lo unirá automáticamente a esta familia.</p></div>`:''}<button class="danger" data-logout>Cerrar sesión</button></section>${base.replace('<p>Los datos se guardan solo en este dispositivo.</p>','<p>Los datos se guardan en este dispositivo y se sincronizan con la familia.</p>')}`};
const cloudWire=wire;
wire=function(){cloudWire();document.querySelector('[data-logout]')?.addEventListener('click',logoutCloud);document.querySelector('[data-invite]')?.addEventListener('click',async()=>{const email=document.getElementById('inviteEmail').value.trim();if(!email){alert('Escribe el email de la persona que quieres invitar.');return}const button=document.querySelector('[data-invite]');button.disabled=true;button.textContent='Enviando…';const {error}=await inviteAdult(email);if(error){alert(error.message);render();return}ui.toast='Invitación enviada por email ✓';render();setTimeout(()=>{ui.toast=null;render()},2200)})};

(async()=>{const {data:{session}}=await sb.auth.getSession();if(session)await startCloud(session);else authScreen();sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT')authScreen();else if(event==='SIGNED_IN'&&session&&!cloud.ready)setTimeout(()=>startCloud(session),0)})})();
