from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import base64
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844},service_workers='block')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/app.js',lambda r:r.fulfill(content_type='text/javascript',body='/* seed original v1 database first */'))
 page.goto('http://127.0.0.1:8769/')
 data=base64.b64encode((ROOT/'assets/references/foto-114.webp').read_bytes()).decode()
 page.evaluate('''data=>new Promise((resolve,reject)=>{const r=indexedDB.open('scouting-fotojacht-pictures',1);r.onupgradeneeded=()=>r.result.createObjectStore('images');r.onsuccess=()=>{const db=r.result,tx=db.transaction('images','readwrite'),blob=new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type:'image/webp'});tx.objectStore('images').put(blob,'recreation:foto-114');tx.objectStore('images').put(blob,'foto-001');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=reject};r.onerror=reject})''',data)
 page.unroute('**/app.js');page.reload();expect(page.locator('#takePhoto')).to_be_enabled()
 page.locator('[data-page="album"]').click();expect(page.locator('.gallery-item')).to_have_count(1);expect(page.locator('#albumContent')).to_contain_text('Eerdere foto’s')
 page.reload();expect(page.locator('.gallery-item')).to_have_count(1) # migration is idempotent
 page.locator('[data-page="spelen"]').click();page.locator('#browse').click();expect(page.locator('.browse-card')).to_have_count(12);page.locator('[data-challenge="foto-001"]').click();expect(page.locator('#referenceCredit')).to_contain_text('Eigen voorbeeld')
 page.locator('#playPage summary').click();page.locator('#removeReference').click();expect(page.locator('#reference a')).to_be_visible()
 page.evaluate("const p=JSON.parse(localStorage.getItem('fotojacht-simple-v1'));p.challengeId='foto-114';p.timer={deadline:Date.now()-1000};localStorage.setItem('fotojacht-simple-v1',JSON.stringify(p))")
 page.route('**/assets/references/foto-114.webp',lambda r:r.abort());page.reload();expect(page.locator('#clock')).to_have_text('00:00');expect(page.locator('#reference a')).to_be_visible()
 page.locator('#duration').select_option('600');page.reload();expect(page.locator('#clock')).to_have_text('10:00')
 assert not errors,errors
 blocked=browser.new_page(service_workers='block');blocked.add_init_script("Object.defineProperty(window,'indexedDB',{get(){throw new DOMException('Storage disabled','SecurityError')}})");blocked.goto('http://127.0.0.1:8769/');expect(blocked.locator('#takePhoto')).to_be_disabled();blocked.locator('[data-page="teams"]').click();expect(blocked.locator('#storageNotice')).to_be_visible()
 print('PASS: original v1 photos/custom examples migrate once and survive reload; missing reference and expired timer fallbacks; saved duration; unavailable storage fails visibly without pretending to save.')
 browser.close()
