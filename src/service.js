import {fail,required} from './http.js';
const DAY=86400000;
export function createService({windowDays=7}={}){
 const installs=new Map(),registrations=new Map();
 function getInstall(id){let x=installs.get(id);if(!x){x={install_id:id,first_open_at:null,first_open_explicit:false,touches:[],registration:null};installs.set(id,x);}return x;}
 function parse(iso){const n=Date.parse(iso);required(typeof iso==='string'&&Number.isFinite(n),'Horário inválido');return n;}
 function source(url){let u;try{u=new URL(url);}catch{fail('Link inválido');}required(['https:','http:'].includes(u.protocol),'Protocolo inválido');const referral=u.searchParams.get('referral');const campaign=u.searchParams.get('campaign');const src=u.searchParams.get('src');required(referral||campaign||src,'Link sem origem');return {kind:referral?'referral':'campaign',source:referral||campaign||src,url};}
 function audit(install){const registered=install.registration;
  const end=Date.parse(install.first_open_at)+windowDays*DAY;
  const touches=install.touches.map(t=>{let reason='eligible';if(t.received_after_registration)reason='after_registration';else if(Date.parse(t.opened_at)<Date.parse(install.first_open_at))reason='before_first_open';else if(Date.parse(t.opened_at)>end)reason='outside_window';else if(registered&&Date.parse(t.opened_at)>Date.parse(registered.registered_at))reason='after_registration';return {...t,reason,winner:false};});
  // Last eligible touch wins. Same millisecond: smallest click ID wins for stability.
  const candidates=touches.filter(t=>t.reason==='eligible').sort((a,b)=>Date.parse(b.opened_at)-Date.parse(a.opened_at)||a.click_id.localeCompare(b.click_id));
  const winner=candidates[0];if(winner){const chosen=touches.find(t=>t.click_id===winner.click_id);chosen.winner=true;chosen.reason='selected_last_touch';for(const t of touches){if(t.reason==='eligible')t.reason='superseded_by_last_touch';}}
  return {winner,touches};
 }
 return {
 open({install_id,first_open_at}){required(typeof install_id==='string'&&!!install_id,'Instalação obrigatória');parse(first_open_at);const i=getInstall(install_id);if(i.registration)fail('Instalação já cadastrada',409);if(i.first_open_explicit&&i.first_open_at!==first_open_at)fail('Primeira abertura conflitante',409);i.first_open_at=first_open_at;i.first_open_explicit=true;return {install_id,first_open_at};},
 touch({install_id,click_id,url,opened_at}){required(typeof install_id==='string'&&!!install_id&&typeof click_id==='string'&&!!click_id,'Instalação e clique obrigatórios');parse(opened_at);const origin=source(url);const install=getInstall(install_id);
   const old=install.touches.find(t=>t.click_id===click_id);if(old){if(old.opened_at!==opened_at||old.url!==url)fail('Clique duplicado conflitante',409);return structuredClone(old);}
   if(install.first_open_at===null)install.first_open_at=opened_at;
   const touch={click_id,opened_at,...origin,received_after_registration:!!install.registration};install.touches.push(touch);return structuredClone(touch);
 },
 register({install_id,user_id,registered_at}){required(typeof install_id==='string'&&!!install_id&&typeof user_id==='string'&&!!user_id,'Identificadores obrigatórios');parse(registered_at);const i=getInstall(install_id);
  if(!i.first_open_at)i.first_open_at=registered_at;
  if(i.registration)fail('Instalação já cadastrada',409);
  if(registrations.has(user_id))fail('Usuário já cadastrado',409);
  i.registration={user_id,registered_at};registrations.set(user_id,install_id);return this.getRegistration(user_id);
 },
 getRegistration(user_id){const id=registrations.get(user_id);if(!id)fail('Cadastro não encontrado',404);const i=getInstall(id);const {winner,touches}=audit(i);
  return {user_id,install_id:id,first_open_at:i.first_open_at,registered_at:i.registration.registered_at,validity_days:windowDays,rule:'last_eligible_touch; tie by click_id ascending',attribution:winner?{kind:winner.kind,source:winner.source,click_id:winner.click_id,reason:'last_eligible_touch'}:{kind:'organic',source:null,click_id:null,reason:'no_eligible_touch'},touches};
 }
 };
}
