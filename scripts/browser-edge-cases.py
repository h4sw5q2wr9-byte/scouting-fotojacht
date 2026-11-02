"""Use a localhost-only repository server at :8772; tests never upload photos."""
from playwright.sync_api import sync_playwright,expect
from pathlib import Path
import base64,zipfile,json
ROOT=Path(__file__).resolve().parents[1]
ITEMS=json.loads((ROOT/'assets/references/sources.json').read_text())['items']
TOTAL=len(ITEMS)
SOLO=sum(x['players']==1 for x in ITEMS)
THREE=sum(x['players']<=3<=x['maxPlayers'] for x in ITEMS)
URL='http://127.0.0.1:8772/'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 # Recover an original v1 recreation into the separate legacy section.
 page=browser.new_page(service_workers='block');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/app.js',lambda r:r.fulfill(content_type='text/javascript',body='/* seed v1 */'));page.goto(URL)
 data=base64.b64encode((ROOT/'assets/references/grumpy-cat.jpg').read_bytes()).decode()
 page.evaluate('''data=>new Promise((resolve,reject)=>{const r=indexedDB.open('scouting-fotojacht-pictures',1);r.onupgradeneeded=()=>r.result.createObjectStore('images');r.onsuccess=()=>{const db=r.result,tx=db.transaction('images','readwrite');tx.objectStore('images').put(new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type:'image/jpeg'}),'recreation:foto-114');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=reject};r.onerror=reject})''',data)
 page.unroute('**/app.js');page.reload();page.locator('#startPlaying').click();page.locator('[data-page="album"]').click();expect(page.locator('#legacySection')).to_be_visible();expect(page.locator('#legacyCount')).to_have_text('(1)');expect(page.locator('#albumBadge')).to_have_text('0')
 page.locator('#legacySection summary').click()
 with page.expect_download() as event:page.locator('#legacyZip').click()
 path=Path('/tmp/fotojacht-v2-legacy.zip');event.value.save_as(path)
 with zipfile.ZipFile(path) as z:assert json.loads(z.read('results.json'))[0]['title']=='Girl with a Pearl Earring'
 page.reload();expect(page.locator('#legacyCount')).to_have_text('(1)')
 # A recreation of a retired V2 portrait retains its original title/credit.
 archive=json.loads((ROOT/'archive/challenges-v1.json').read_text());retired=next(item for item in archive if item['title']=='Billie Eilish')
 page.evaluate("""args=>new Promise((resolve,reject)=>{const r=indexedDB.open('scouting-fotojacht-pictures',2);r.onsuccess=()=>{const db=r.result,tx=db.transaction('photos','readwrite'),blob=new Blob([Uint8Array.from(atob(args.data),c=>c.charCodeAt(0))],{type:'image/jpeg'});tx.objectStore('photos').put({id:'v2:'+args.id,challenge_id:args.id,title:'Billie Eilish',blob,referenceBlob:blob,created_at:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=reject};r.onerror=reject})""",{'data':data,'id':retired['id']})
 page.reload();expect(page.locator('#legacyCount')).to_have_text('(2)');page.locator('#legacySection summary').click()
 with page.expect_download() as event:page.locator('#legacyZip').click()
 path=Path('/tmp/fotojacht-retired-v2.zip');event.value.save_as(path)
 with zipfile.ZipFile(path) as z:
  rows=json.loads(z.read('results.json'));old=next(row for row in rows if row['title']=='Billie Eilish');assert old['credit']['author']=='Toglenn';assert old['credit']['licenseUrl'];assert old['original'] in z.namelist()
 # Failed in-site photo is not replaced with a search link or a playable placeholder.
 first=json.loads((ROOT/'assets/references/sources.json').read_text())['items'][0]
 broken=browser.new_page(service_workers='block');broken.route('**/'+first['image'],lambda r:r.abort());broken.goto(URL);broken.locator('#startPlaying').click();expect(broken.locator('#imageError')).to_be_visible();expect(broken.locator('#takePhoto')).to_be_disabled();broken.locator('#browse').click();expect(broken.locator('.picker-card')).to_have_count(TOTAL-1);assert broken.locator('a[href*="google"]').count()==0
 # Unavailable storage is clearly reported and can never pretend to save.
 blocked=browser.new_page(service_workers='block');blocked.add_init_script("Object.defineProperty(window,'indexedDB',{get(){throw new DOMException('Storage disabled','SecurityError')}})");blocked.goto(URL);blocked.locator('#startPlaying').click();expect(blocked.locator('#takePhoto')).to_be_disabled();expect(blocked.locator('#saveHint')).to_contain_text('niet beschikbaar')
 assert not errors,errors
 # Complete worker install caches public references, not personal media.
 offline=browser.new_context(service_workers='allow');tab=offline.new_page();tab.goto(URL+'?v=2');tab.locator('#startPlaying').click();tab.evaluate('navigator.serviceWorker.ready');tab.wait_for_function('navigator.serviceWorker.controller!==null')
 cached=tab.evaluate('''async()=>{const c=await caches.open('fotojacht-deck-v2.2.0');return (await c.keys()).map(r=>new URL(r.url).pathname)}''')
 for item in json.loads((ROOT/'assets/references/sources.json').read_text())['items']:assert '/'+item['image'] in cached
 assert not any('/photos/' in path or 'blob:' in path for path in cached)
 offline.set_offline(True);tab.reload();expect(tab.locator('#reference')).to_have_js_property('complete',True);assert tab.locator('#reference').evaluate('(e)=>e.naturalWidth>0');tab.locator('#browse').click();expect(tab.locator('.picker-card')).to_have_count(TOTAL)
 offline.close();browser.close()
 print('PASS: original v1 photo recovery/legacy ZIP without data loss; broken refs hidden/no search detours; storage denied fails clearly; full 33-image deck and app load offline after worker install, with no personal photos in Cache Storage.')
