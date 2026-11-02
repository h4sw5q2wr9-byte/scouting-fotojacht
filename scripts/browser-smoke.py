"""Run against a repository-only localhost server on port 8769."""
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
from PIL import Image
import zipfile,json,io,os
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
class AlbumHandler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory="/tmp/fotojacht-extracted-test",**kw)
 def log_message(self,*a):pass
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block')
 errors=[];writes=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:writes.append(r.url) if r.method not in ['GET','HEAD'] else None)
 page.goto(os.environ.get('FOTOJACHT_URL','http://127.0.0.1:8769/'),wait_until='networkidle')
 expect(page.locator('#takePhoto')).to_be_enabled();expect(page.locator('#activeTeam')).to_contain_text('Mijn team')
 assert page.locator('#reference img').evaluate('(e)=>e.naturalWidth')>0
 for width in [320,375,390,768,1440]:
  page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth')==width
 page.set_viewport_size({'width':390,'height':844})
 page.locator('[data-page="teams"]').click();page.locator('#teamName').fill('Vossen & Scouts');page.locator('#createTeamForm button').click();expect(page.locator('#activeTeam option:checked')).to_have_text('Vossen & Scouts')
 def save(points='5'):
  page.locator('#takePhoto').click();page.locator('#photoPicker').set_input_files(ROOT/'assets/references/foto-114.webp');expect(page.locator('#uploadDialog')).to_be_visible();page.locator('#photoPoints').select_option(points);page.locator('#savePhoto').click();expect(page.locator('#uploadDialog')).not_to_be_visible()
 save('7')
 page.reload();page.locator('[data-page="album"]').click();expect(page.locator('.gallery-item')).to_have_count(1);expect(page.locator('#albumContent')).to_contain_text('7 punten')
 page.locator('.gallery-item').click();expect(page.locator('.comparison img')).to_have_count(2);page.locator('[data-close="photoDialog"]').click()
 page.locator('[data-page="teams"]').click();page.locator('#teamName').fill('Wolven');page.locator('#createTeamForm button').click();save('3')
 # An external-only challenge exports an explicit missing-original panel and link.
 page.locator('#browse').click();page.locator('#showAll').check();expect(page.locator('.browse-card')).to_have_count(145);page.locator('#search').fill('MAND!');page.locator('.browse-card').click();expect(page.locator('#reference a')).to_be_visible();save('4')
 page.locator('[data-page="album"]').click();expect(page.locator('.gallery-item')).to_have_count(3)
 with page.expect_download(timeout=30000) as event:page.locator('#downloadAll').click()
 path=Path('/tmp/fotojacht-export-test.zip');event.value.save_as(path)
 with zipfile.ZipFile(path) as z:
  assert z.testzip() is None
  manifest=json.loads(z.read('overzicht.json'));assert len(manifest)==3
  assert {row['team'] for row in manifest}=={'Vossen & Scouts','Wolven'}
  assert any(row['title']=='Girl with a Pearl Earring' for row in manifest)
  assert sum(row['original'] is None for row in manifest)==1
  for row in manifest:
   assert row['photo'] in z.namelist();assert row['comparison'] in z.namelist()
   assert Image.open(io.BytesIO(z.read(row['comparison']))).size==(1600,1050)
   assert z.read(row['photo'])[:2]==b'\xff\xd8'
   assert b'Exif\x00\x00' not in z.read(row['photo'])
   if row['original']:assert row['original'] in z.namelist()
  assert 'Vossen &amp; Scouts' in z.read('album.html').decode()
  assert 'Zoek origineel' in z.read('album.html').decode()
  z.extractall('/tmp/fotojacht-extracted-test')
 # Offline album contains real relative images; test it as a file, as downloaded.
 server=ThreadingHTTPServer(('127.0.0.1',8770),AlbumHandler);Thread(target=server.serve_forever,daemon=True).start()
 album=browser.new_page();album.goto('http://127.0.0.1:8770/album.html');expect(album.locator('img')).to_have_count(3)
 for image in album.locator('img').all():assert image.evaluate('(e)=>e.complete&&e.naturalWidth>0')
 album.close();server.shutdown()
 # Filtered team export contains just that team's records.
 team=page.locator('#albumTeam option').filter(has_text='Vossen & Scouts').get_attribute('value');page.locator('#albumTeam').select_option(team);expect(page.locator('.gallery-item')).to_have_count(1)
 with page.expect_download(timeout=30000) as event:page.locator('[data-export-team]').click()
 path2=Path('/tmp/fotojacht-team-test.zip');event.value.save_as(path2)
 with zipfile.ZipFile(path2) as z:assert len(json.loads(z.read('overzicht.json')))==1
 # Delete only one record, and verify persistence after a second reload.
 page.on('dialog',lambda dialog:dialog.accept());page.locator('.gallery-item').click();page.locator('#deletePhoto').click();expect(page.locator('.gallery-item')).to_have_count(0)
 page.reload();expect(page.locator('.gallery-item')).to_have_count(2)
 page.locator('[data-page="spelen"]').click();page.locator('#favorite').click();page.reload();expect(page.locator('#favorite')).to_have_attribute('aria-pressed','true')
 page.locator('#timerToggle').click();expect(page.locator('#clock')).not_to_have_text('05:00');page.locator('#timerReset').click();expect(page.locator('#clock')).to_have_text('05:00')
 page.evaluate('scrollTo(0,0)');page.screenshot(path='/tmp/fotojacht-v5-mobile.png')
 assert not errors,errors;assert not writes,writes
 print('PASS: local teams and photos persist, 145 challenges, mobile 320–1440px, comparisons, all-team/per-team ZIPs with valid JPEGs/titles/originals, offline HTML album, deletion, timer/favorites; no JS errors and no network uploads.')
 browser.close()
