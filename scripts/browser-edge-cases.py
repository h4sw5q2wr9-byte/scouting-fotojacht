"""Run with python after installing Playwright. Creates its own localhost server."""
from playwright.sync_api import sync_playwright, expect
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
import json
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def do_GET(self):
  if self.path.startswith('/scouting-fotojacht/'):
   self.path=self.path[len('/scouting-fotojacht'):]
  super().do_GET()
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',8766),Handler);Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':320,'height':640},is_mobile=True,has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8766/scouting-fotojacht/',wait_until='networkidle')
 for width in [320,375,390,768,1440]:
  page.set_viewport_size({'width':width,'height':844})
  assert page.evaluate('document.documentElement.scrollWidth')==width
 # Local images are genuine files and resolve under a repository prefix.
 page.locator('#localFilter').click()
 images=page.locator('.photo img');assert images.count()==11
 for image in images.all():
  image.scroll_into_view_if_needed();expect(image).to_have_js_property('complete',True)
  assert image.evaluate('(e)=>e.naturalWidth')>0
 page.locator('[data-open="foto-110"]').click();page.locator('#roundDuration').click();expect(page.locator('#roundDuration')).to_have_text('10 min')
 page.locator('#startRound').click();page.reload();expect(page.locator('#clock')).to_have_text('10:00')
 page.evaluate("const s=JSON.parse(localStorage.getItem('fotojacht-state-v2'));s.timer.deadline=Date.now()-1000;localStorage.setItem('fotojacht-state-v2',JSON.stringify(s));")
 page.reload();expect(page.locator('#clock')).to_have_text('00:00');expect(page.locator('#toast')).to_contain_text('Tijd is om')
 page.route('**/assets/references/foto-110.webp',lambda route:route.abort())
 page.reload();page.locator('[data-open="foto-110"]').click();expect(page.locator('#reference .refplaceholder')).to_be_visible();expect(page.locator('#reference a')).to_have_attribute('href',__import__('re').compile('https://www.google.com/search'))
 page.locator('#closeDetail').click();page.locator('#search').fill('MAND!');assert page.locator('.challenge').count()==0 # local-only filter retained
 page.locator('#localFilter').click();page.locator('[data-open="foto-001"]').click()
 page.locator('#awardPoints').fill('11');page.locator('#award').click();expect(page.locator('#toast')).to_contain_text('0 tot en met 10')
 assert not errors,errors
 browser.close()
server.shutdown()
print('PASS: 320–1440px widths; repository subpath; 11 real local images; timer duration/deadline persistence and expiry; broken-image fallback; invalid score rejection; no JS errors.')
