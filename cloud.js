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
function inviteSetupScreen(session,message=''){
  const email=session.user.email||'';
  document.getElementById('app').innerHTML=`<main class="auth-shell"><section class="auth-card"><div class="auth-logo">👧 ⭐ 👦</div><h1>Únete a ${FAMILY_NAME}</h1><p class="auth-sub">Has sido invitado como adulto con <strong>${escapeHtml(email)}</strong>.</p>${message?`<div class="auth-message">${escapeHtml(message)}</div>`:''}<p>Para activar tu acceso, crea una contraseña para tu cuenta de KidBehaviour.</p><label>Nueva contraseña<input id="invitePassword" type="password" autocomplete="new-password" minlength="6" placeholder="Mínimo 6 caracteres"></label><label>Repite la contraseña<input id="invitePassword2" type="password" autocomplete="new-password" minlength="6" placeholder="Repite la contraseña"></label><button class="primary" data-complete-invite>Crear cuenta y unirme</button><button class="secondary" data-cancel-invite>Cancelar</button></section></main>`;
  document.querySelector('[data-complete-invite]').onclick=()=>completeInviteSetup(session);
  document.querySelector('[data-cancel-invite]').onclick=async()=>{await sb.auth.signOut();authScreen()};
}
async function completeInviteSetup(session){
  const p1=document.getElementById('invitePassword').value,p2=document.getElementById('invitePassword2').value;
  if(p1.length<6){inviteSetupScreen(session,'La contraseña debe tener al menos 6 caracteres.');return}
  if(p1!==p2){inviteSetupScreen(session,'Las contraseñas no coinciden.');return}
  const {error}=await sb.auth.updateUser({password:p1});
  if(error){inviteSetupScreen(session,error.message);return}
  await startCloud(session,true);
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
function migratePrivilegeTiers(){if(typeof BASIC_PRIVILEGES==='undefined')return false;let changed=false;const basicIds=new Set(BASIC_PRIVILEGES.map(p=>p.id));if(!Array.isArray(state.privileges)||!state.privileges.length){state.privileges=BASIC_PRIVILEGES.map(p=>({...p,active:true}));changed=true}if(!Array.isArray(state.bluePrivileges)||!state.bluePrivileges.length){state.bluePrivileges=BLUE_PRIVILEGES.map(p=>({...p}));changed=true}if(!Array.isArray(state.goldPrivileges)||!state.goldPrivileges.length){state.goldPrivileges=GOLD_PRIVILEGES.map(p=>({...p}));changed=true}Object.values(state.days||{}).forEach(d=>{const lost=(d.lostPrivileges||[]).filter(id=>basicIds.has(id));if(JSON.stringify(lost)!==JSON.stringify(d.lostPrivileges||[])){d.lostPrivileges=lost;changed=true}if(!Array.isArray(d.earnedPrivileges)){d.earnedPrivileges=[];changed=true}});localStorage.setItem(PRIVILEGE_SETTINGS_KEY,JSON.stringify(state.privileges));return changed}
async function pendingInviteFor(session){const {data,error}=await sb.from('invitations').select('id,family_id,role').is('accepted_at',null).gt('expires_at',new Date().toISOString()).limit(1);if(error)throw error;return data?.[0]||null}
async function startCloud(session,inviteConfirmed=false){
  cloud.session=session;if(!session){cloud.ready=false;authScreen();return}
  document.getElementById('app').innerHTML='<main class="auth-shell"><section class="auth-card"><h2>Sincronizando…</h2><p>Preparando tu familia.</p></section></main>';
  try{
    let {data:members,error}=await sb.from('family_members').select('family_id,role').eq('user_id',session.user.id).limit(1);if(error)throw error;
    if(!members?.length){
      const invite=await pendingInviteFor(session);
      if(invite){
        if(!inviteConfirmed){inviteSetupScreen(session);return}
        const {data:fid,error:ae}=await sb.rpc('accept_family_invitation',{p_invitation_id:invite.id});if(ae)throw ae;members=[{family_id:fid,role:invite.role}]
      } else {
        const {data:fid,error:be}=await sb.rpc('bootstrap_family',{p_name:FAMILY_NAME,p_state:localSnapshot()});if(be)throw be;members=[{family_id:fid,role:'admin'}]
      }
    }
    const member=members[0];cloud.role=member.role;const {data:fam,error:fe}=await sb.from('families').select('id,name').eq('id',member.family_id).single();if(fe)throw fe;cloud.family=fam;const {data:remote,error:re}=await sb.from('family_state').select('state,version').eq('family_id',fam.id).single();if(re)throw re;let migrated=false;if(remote?.state&&Object.keys(remote.state).length){state=remote.state;state.children=state.children?.length?state.children:CHILDREN;state.days||={};state.rewards||=[];state.restrictions||=[];migrated=migratePrivilegeTiers();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));cloud.lastRemoteVersion=remote.version||1}cloud.lastSnapshot=snapshotString();cloud.ready=true;subscribeFamily();render();if(migrated)await pushCloudState();
  }catch(e){console.error(e);authScreen(`No se pudo preparar la sincronización: ${e.message}`)}
}
async function pushCloudState(){if(!cloud.ready||cloud.syncing||!cloud.family||!cloud.session)return;cloud.syncing=true;try{const snap=snapshotString();const {data,error}=await sb.from('family_state').update({state:localSnapshot(),version:cloud.lastRemoteVersion+1,updated_at:new Date().toISOString(),updated_by:cloud.session.user.id}).eq('family_id',cloud.family.id).select('version').single();if(error)throw error;cloud.lastRemoteVersion=data.version;cloud.lastSnapshot=snap}catch(e){console.error('Cloud save failed',e)}finally{cloud.syncing=false}}
function subscribeFamily(){if(cloud.channel)sb.removeChannel(cloud.channel);cloud.channel=sb.channel(`family:${cloud.family.id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'family_state',filter:`family_id=eq.${cloud.family.id}`},payload=>{const row=payload.new;if(!row||row.updated_by===cloud.session.user.id||row.version<=cloud.lastRemoteVersion)return;cloud.lastRemoteVersion=row.version;state=row.state;state.children=state.children?.length?state.children:CHILDREN;state.days||={};state.rewards||=[];state.restrictions||=[];migratePrivilegeTiers();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));cloud.lastSnapshot=snapshotString();render()}).subscribe()}
async function inviteAdult(email){if(cloud.role!=='admin')return {error:new Error('Solo un administrador puede invitar adultos.')};const {data,error}=await sb.functions.invoke('invite-family-member',{body:{email:email.trim().toLowerCase(),family_id:cloud.family.id}});if(error)return {error};if(data?.error)return {error:new Error(data.error)};return {error:null}}
async function logoutCloud(){await sb.auth.signOut();cloud={session:null,family:null,role:null,ready:false,syncing:false,channel:null,lastRemoteVersion:0,lastSnapshot:''};authScreen()}
setInterval(()=>{if(!cloud.ready||cloud.syncing)return;const now=snapshotString();if(now&&now!==cloud.lastSnapshot)pushCloudState()},800);
const cloudSettingsPage=settingsPage;settingsPage=function(){const base=cloudSettingsPage();if(!cloud.ready)return base;return `<section class="panel family-panel"><div class="family-title"><div><h2>Familia</h2><p>${escapeHtml(cloud.family.name)}</p></div><span class="role-pill">${cloud.role==='admin'?'Administrador':'Adulto'}</span></div><div class="setting-row"><span>👤 ${escapeHtml(cloud.session.user.email||'')}</span><strong>Conectado</strong></div>${cloud.role==='admin'?`<div class="invite-box"><label>Invitar a otro adulto<input id="inviteEmail" type="email" placeholder="email@ejemplo.com"></label><button class="secondary" data-invite>Enviar invitación</button><p>Recibirá una invitación para crear su cuenta antes de acceder a la familia.</p></div>`:''}<button class="danger" data-logout>Cerrar sesión</button></section>${base.replace('<p>Los datos se guardan solo en este dispositivo.</p>','<p>Los datos se guardan en este dispositivo y se sincronizan con la familia.</p>')}`};
const cloudWire=wire;wire=function(){cloudWire();document.querySelector('[data-logout]')?.addEventListener('click',logoutCloud);document.querySelector('[data-invite]')?.addEventListener('click',async()=>{const email=document.getElementById('inviteEmail').value.trim();if(!email){alert('Escribe el email de la persona que quieres invitar.');return}const button=document.querySelector('[data-invite]');button.disabled=true;button.textContent='Enviando…';const {error}=await inviteAdult(email);if(error){alert(error.message);render();return}ui.toast='Invitación enviada por email ✓';render();setTimeout(()=>{ui.toast=null;render()},2200)})};
(async()=>{const {data:{session}}=await sb.auth.getSession();if(session)await startCloud(session);else authScreen();sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT')authScreen();else if((event==='SIGNED_IN'||event==='PASSWORD_RECOVERY')&&session&&!cloud.ready)setTimeout(()=>startCloud(session),0)})})();