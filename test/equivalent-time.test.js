import test from 'node:test';import assert from 'node:assert/strict';import {createService} from '../src/service.js';
test('replay do mesmo clique com fuso equivalente não cria conflito nem outra origem',()=>{
  const service=createService();const input={install_id:'i',click_id:'c',url:'https://app.example/open?campaign=a',opened_at:'2026-10-01T12:00:00Z'};
  service.touch(input);service.touch({...input,opened_at:'2026-10-01T09:00:00-03:00'});
  const result=service.register({install_id:'i',user_id:'u',registered_at:'2026-10-01T13:00:00Z'});
  assert.equal(result.touches.length,1);assert.equal(result.attribution.click_id,'c');
});
