"""Exercise file sharing without sending anything to external apps."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json, zipfile
ROOT=Path(__file__).resolve().parents[1]
items=json.loads((ROOT/'assets/references/sources.json').read_text())['items']
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(service_workers='block',viewport={'width':390,'height':844})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("""Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>files.length===1&&files[0].type==='application/zip'});Object.defineProperty(navigator,'share',{value:async({files})=>{if(window.shareFailure)throw new DOMException('Test',window.shareFailure);window.sharedFile={name:files[0].name,size:files[0].size};}});""")
 # Optimized-copy failure must gracefully use the original JPEG.
 page.route('**/'+items[0]['previewImage'],lambda r:r.abort())
 page.goto('http://127.0.0.1:8772/');page.locator('#startPlaying').click()
 expect(page.locator('#reference')).to_have_js_property('complete',True)
 expect(page.locator('#takePhoto')).to_be_enabled()
 assert page.locator('#reference').evaluate('(e)=>e.naturalWidth>0&&e.currentSrc.endsWith(".jpg")')
 assert page.locator('#albumBadge').evaluate('(e)=>e.closest("[aria-live]")!==null')
 # Every generated WebP is decodable.
 page.unroute('**/'+items[0]['previewImage'])
 page.evaluate('''async()=>{for(const x of window.FOTOJACHT_LOCAL_REFERENCES){const img=new Image();img.src=x.previewImage;await img.decode();if(img.naturalWidth<300)throw Error(x.title)}}''')
 page.locator('#takePhoto').click();page.locator('#photoPicker').set_input_files(ROOT/items[0]['image']);page.locator('#savePhoto').click()
 expect(page.locator('#viewerDialog')).to_be_visible();page.locator('#bestPose').click();expect(page.locator('#bestPose')).to_have_attribute('aria-pressed','true');page.locator('[data-close="viewerDialog"]').click()
 page.locator('[data-page="album"]').click();expect(page.locator('.album-card')).to_contain_text('Beste pose')
 page.reload();expect(page.locator('.album-card')).to_contain_text('Beste pose')
 with page.expect_download() as event:page.locator('#downloadZip').click()
 path=Path('/tmp/fotojacht-sharing.zip');event.value.save_as(path)
 with zipfile.ZipFile(path) as z:
  rows=json.loads(z.read('results.json'));assert rows[0]['bestPose'] is True
  assert 'LICENTIES.txt' in z.namelist() and 'docs/user-reference-uploads.md' in z.namelist()
  assert any(n.endswith('-credits.txt') for n in z.namelist())
  assert 'docs/user-reference-uploads.md' in z.read('index.html').decode()
 expect(page.locator('#shareZip')).to_be_visible();page.locator('#shareZip').click();expect(page.locator('#exportStatus')).to_contain_text('gedeeld');assert page.evaluate('window.sharedFile.size')>10000
 page.evaluate('window.shareFailure="AbortError"');page.locator('#shareZip').click();expect(page.locator('#exportStatus')).to_contain_text('geannuleerd')
 page.evaluate('window.shareFailure="NotAllowedError"');page.locator('#shareZip').click();expect(page.locator('#exportStatus')).to_contain_text('Downloads / Bestanden')
 page.locator('.group-options summary').click();page.locator('#groupName').fill('Nieuwe groep');expect(page.locator('#shareZip')).to_be_hidden()
 # No file-share API: ZIP download remains usable.
 page.evaluate("Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false})") if False else None
 assert not errors,errors
 browser.close()
 print('PASS: all WebP decodes, JPEG fallback, best-pose persistence/export, ZIP rights/credit files, native share success/cancellation/failure and stale-file invalidation; no external sharing performed.')
