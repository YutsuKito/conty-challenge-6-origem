import {http} from './http.js';import {createService} from './service.js';
export function createApp(service=createService()){return http(service,[['POST',/^\/opens$/, (s,b)=>s.open(b)],['POST',/^\/touches$/, (s,b)=>s.touch(b)],['POST',/^\/registrations$/, (s,b)=>s.register(b)],['GET',/^\/registrations\/([^/]+)$/, (s,b,id)=>s.getRegistration(id)]]);}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href)createApp().listen(3006,()=>console.log('http://localhost:3006'));
