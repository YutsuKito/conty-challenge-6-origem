import test from 'node:test';import assert from 'node:assert/strict';import {createService} from '../src/service.js';
const url='https://app.conty.example/open?campaign=spring&src=community';const ref='https://app.conty.example/open?referral=creator_1';
const touch=(s,id,at,link=url)=>s.touch({install_id:'install1',click_id:id,opened_at:at,url:link});
test('duplicidade e último toque elegível',()=>{const s=createService();touch(s,'click1','2026-10-01T10:00:00Z');touch(s,'click1','2026-10-01T10:00:00Z');touch(s,'click2','2026-10-02T10:00:00Z',ref);const a=s.register({install_id:'install1',user_id:'user1',registered_at:'2026-10-03T10:00:00Z'});assert.equal(a.attribution.source,'creator_1');assert.equal(a.touches.length,2);assert.equal(a.touches[0].reason,'superseded_by_last_touch');});
test('empate de horário desempata pelo click_id ascendente',()=>{const s=createService();touch(s,'z','2026-10-01T10:00:00Z');touch(s,'a','2026-10-01T10:00:00Z',ref);assert.equal(s.register({install_id:'install1',user_id:'u',registered_at:'2026-10-01T11:00:00Z'}).attribution.click_id,'a');});
test('prazo começa na primeira abertura; posteriores ao cadastro e fora da janela não ganham',()=>{const s=createService({windowDays:7});touch(s,'one','2026-10-01T10:00:00Z');touch(s,'expired','2026-10-08T10:00:00.001Z',ref);const a=s.register({install_id:'install1',user_id:'u',registered_at:'2026-10-09T10:00:00Z'});assert.equal(a.attribution.click_id,'one');touch(s,'late','2026-10-10T10:00:00Z',ref);const b=s.getRegistration('u');assert.equal(b.touches.find(t=>t.click_id==='late').reason,'after_registration');});
test('sem toque válido fica orgânico e motivo auditável',()=>{const s=createService();const a=s.register({install_id:'unknown',user_id:'u',registered_at:'2026-10-10T10:00:00Z'});assert.equal(a.attribution.kind,'organic');assert.equal(a.attribution.reason,'no_eligible_touch');});

test('clique recebido após cadastro com mesmo timestamp não vence',()=>{const s=createService();touch(s,'original','2026-10-01T10:00:00Z');s.register({install_id:'install1',user_id:'u',registered_at:'2026-10-02T10:00:00Z'});touch(s,'late','2026-10-02T10:00:00Z',ref);const result=s.getRegistration('u');assert.equal(result.attribution.click_id,'original');assert.equal(result.touches.find(t=>t.click_id==='late').reason,'after_registration');});
test('abertura orgânica independente inicia janela antes do primeiro link',()=>{const s=createService({windowDays:7});s.open({install_id:'install1',first_open_at:'2026-10-01T10:00:00Z'});touch(s,'edge','2026-10-08T10:00:00Z');touch(s,'late','2026-10-08T10:00:00.001Z',ref);const a=s.register({install_id:'install1',user_id:'u',registered_at:'2026-10-09T10:00:00Z'});assert.equal(a.attribution.click_id,'edge');assert.equal(a.touches.find(t=>t.click_id==='late').reason,'outside_window');});
test('abertura explícita corrige toque recebido antes da instalação',()=>{const s=createService();touch(s,'early','2026-10-01T10:00:00Z');s.open({install_id:'install1',first_open_at:'2026-10-02T10:00:00Z'});const a=s.register({install_id:'install1',user_id:'u',registered_at:'2026-10-03T10:00:00Z'});assert.equal(a.attribution.kind,'organic');assert.equal(a.touches[0].reason,'before_first_open');});
test('aberturas fora de ordem resolvem a menor data sem reiniciar janela',()=>{
 const results=[];
 for(const times of [['2026-10-03T10:00:00Z','2026-10-01T10:00:00Z'],['2026-10-01T10:00:00Z','2026-10-03T10:00:00Z']]){
  const s=createService();for(const first_open_at of times)s.open({install_id:'install1',first_open_at});
  touch(s,'edge','2026-10-08T10:00:00Z');touch(s,'outside','2026-10-08T10:00:00.001Z',ref);
  const r=s.register({install_id:'install1',user_id:'u',registered_at:'2026-10-09T10:00:00Z'});
  assert.equal(r.first_open_at,'2026-10-01T10:00:00.000Z');assert.equal(r.attribution.click_id,'edge');assert.equal(r.touches[1].reason,'outside_window');results.push(r);
 }
 assert.deepEqual(results[0],results[1]);
});
test('abertura repetida em outro fuso representa o mesmo instante',()=>{
 const s=createService();s.open({install_id:'install1',first_open_at:'2026-10-01T07:00:00-03:00'});
 assert.equal(s.open({install_id:'install1',first_open_at:'2026-10-01T10:00:00Z'}).first_open_at,'2026-10-01T10:00:00.000Z');
});
test('sem abertura explícita, toques fora de ordem reconciliam a estimativa',()=>{
 const s=createService();touch(s,'later','2026-10-03T10:00:00Z');touch(s,'earlier','2026-10-01T10:00:00Z');
 assert.equal(s.register({install_id:'install1',user_id:'u',registered_at:'2026-10-04T10:00:00Z'}).first_open_at,'2026-10-01T10:00:00.000Z');
});
test('cadastro congela a abertura; replay aceita e correção tardia retorna 409',()=>{
 const s=createService();s.open({install_id:'install1',first_open_at:'2026-10-01T10:00:00Z'});touch(s,'original','2026-10-02T10:00:00Z');
 const before=s.register({install_id:'install1',user_id:'u',registered_at:'2026-10-03T10:00:00Z'});
 assert.equal(s.open({install_id:'install1',first_open_at:'2026-10-01T07:00:00-03:00'}).first_open_at,before.first_open_at);
 assert.throws(()=>s.open({install_id:'install1',first_open_at:'2026-09-01T10:00:00Z'}),{status:409});assert.deepEqual(s.getRegistration('u'),before);
});
test('cadastro anterior à primeira abertura é recusado sem consumir usuário',()=>{
 const s=createService();s.open({install_id:'install1',first_open_at:'2026-10-02T10:00:00Z'});
 assert.throws(()=>s.register({install_id:'install1',user_id:'u',registered_at:'2026-10-01T10:00:00Z'}),{status:409});
 assert.equal(s.register({install_id:'install1',user_id:'u',registered_at:'2026-10-03T10:00:00Z'}).user_id,'u');
});
