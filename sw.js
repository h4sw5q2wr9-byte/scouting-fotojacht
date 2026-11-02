const NAME='fotojacht-core-v2';
const CORE=['./','./index.html','./challenges.js','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(NAME).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n.startsWith('fotojacht-')&&n!==NAME).map(n=>caches.delete(n)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==location.origin)return;
 e.respondWith(fetch(e.request).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(NAME).then(c=>c.put(e.request,copy))}return resp}).catch(()=>caches.match(e.request).then(v=>v||caches.match('./index.html'))));
});
