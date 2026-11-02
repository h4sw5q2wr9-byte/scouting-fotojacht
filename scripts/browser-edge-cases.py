"""Browser-local migration and reference fallback tests. Starts a localhost-only server."""
from playwright.sync_api import sync_playwright, expect
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
import base64,json
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def do_GET(self):
  if self.path.startswith('/scouting-fotojacht/'):self.path=self.path[len('/scouting-fotojacht'):]
  super().do_GET()
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',8768),Handler);Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8768/scouting-fotojacht/',wait_until='networkidle')
  # Seed old photos; a new app version must not lose or silently upload them.
  data=base64.b64encode((ROOT/'assets/references/foto-114.webp').read_bytes()).decode()
  page.evaluate('''data=>new Promise((resolve,reject)=>{const r=indexedDB.open('scouting-fotojacht-pictures',1);r.onsuccess=()=>{const db=r.result;const tx=db.transaction('images','readwrite');const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));const blob=new Blob([bytes],{type:'image/webp'});tx.objectStore('images').put(blob,'recreation:foto-114');tx.objectStore('images').put(blob,'foto-001');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=reject};r.onerror=reject})''',data)
  page.reload();page.locator('[data-page="album"]').click();expect(page.locator('#legacySection')).to_be_visible();expect(page.locator('#legacyGrid .gallery-item')).to_have_count(1)
  page.locator('#legacyGrid .gallery-item').click();expect(page.locator('#photoDialog')).to_be_visible()
  with page.expect_download() as download:page.locator('#downloadPhoto').click()
  assert download.value.suggested_filename.endswith('.webp')
  page.on('dialog',lambda dialog:dialog.accept());page.locator('#deletePhoto').click();expect(page.locator('#legacySection')).not_to_be_visible()
  page.locator('[data-page="spelen"]').click();page.locator('#browse').click();expect(page.locator('.browse-card')).to_have_count(12) # 11 references + old custom image
  page.locator('[data-challenge="foto-001"]').click();expect(page.locator('#reference img')).to_be_visible();expect(page.locator('#referenceCredit')).to_contain_text('Eigen voorbeeld')
  page.locator('#playPage summary').click();page.locator('#removeReference').click();expect(page.locator('#reference a')).to_be_visible()
  # An expired restored timer and a missing image both have meaningful fallbacks.
  page.evaluate("const prefs=JSON.parse(localStorage.getItem('fotojacht-simple-v1'));prefs.challengeId='foto-114';prefs.timer={deadline:Date.now()-1000};localStorage.setItem('fotojacht-simple-v1',JSON.stringify(prefs));")
  page.route('**/assets/references/foto-114.webp',lambda route:route.abort())
  page.reload();expect(page.locator('#clock')).to_have_text('00:00');expect(page.locator('#reference a')).to_be_visible()
  page.locator('#timerReset').click();expect(page.locator('#clock')).to_have_text('05:00')
  page.locator('#duration').select_option('600');page.reload();expect(page.locator('#clock')).to_have_text('10:00')
  assert not errors,errors
  browser.close()
 print('PASS: repository subpath, existing IndexedDB photos preserved/exported/deleted, custom reference migration, missing-image fallback, timer restoration/expiry and duration settings; no JS errors.')
finally:server.shutdown()
