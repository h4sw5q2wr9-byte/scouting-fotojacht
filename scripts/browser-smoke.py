"""Run after starting a repository-only server on localhost:8772."""
from playwright.sync_api import sync_playwright,expect
from pathlib import Path
from PIL import Image
import zipfile,json,io,os
ROOT=Path(__file__).resolve().parents[1]
ITEMS=json.loads((ROOT/'assets/references/sources.json').read_text())['items']
TOTAL=len(ITEMS)
SOLO=sum(x['players']==1 for x in ITEMS)
THREE=sum(x['players']<=3<=x['maxPlayers'] for x in ITEMS)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block')
 errors=[];writes=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:writes.append(r.url) if r.method not in ['GET','HEAD'] else None)
 page.goto(os.environ.get('FOTOJACHT_URL','http://127.0.0.1:8772/'),wait_until='networkidle');expect(page.locator('#tutorialDialog')).to_be_visible();page.screenshot(path='/tmp/fotojacht-v2-tutorial.png');page.locator('#startPlaying').click();page.locator('#skipGroupName').click();expect(page.locator('#takePhoto')).to_be_enabled()
 assert page.locator('[id*="timer"],a[href*="google"]').count()==0
 assert page.locator('#reference').evaluate('(e)=>e.complete&&e.naturalWidth>0')
 # All references are actual decoded local images, not just existing path strings.
 count=page.evaluate('''async()=>{const items=window.FOTOJACHT_LOCAL_REFERENCES;for(const item of items){const image=new Image();image.src=item.image;await image.decode();if(image.naturalWidth<300)throw Error(item.title);}return items.length}''');assert count==TOTAL
 for width in [320,375,390,768,1440]:
  page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth')==width
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path='/tmp/fotojacht-v2-deck.png')
 first=page.locator('#challengeTitle').text_content()
 def choose_and_save(path):
  page.locator('#takePhoto').click();page.locator('#photoPicker').set_input_files(path);expect(page.locator('#uploadDialog')).to_be_visible();page.locator('#savePhoto').click();expect(page.locator('#viewerDialog')).to_be_visible();expect(page.locator('#comparison img')).to_have_count(2)
 choose_and_save(ROOT/'assets/references/de-mislukte-fusion-dance.jpg');page.locator('[data-close="viewerDialog"]').click();expect(page.locator('#albumBadge')).to_have_text('1')
 # Replacing the same challenge must not create an extra submission.
 choose_and_save(ROOT/'assets/references/grumpy-cat.jpg');page.locator('[data-close="viewerDialog"]').click();expect(page.locator('#albumBadge')).to_have_text('1')
 page.reload();expect(page.locator('#tutorialDialog')).not_to_be_visible();expect(page.locator('#albumBadge')).to_have_text('1');expect(page.locator('#doneBadge')).to_be_visible()
 page.locator('#next').click();second=page.locator('#challengeTitle').text_content();assert second!=first
 choose_and_save(ROOT/'assets/references/de-mislukte-fusion-dance.jpg');page.locator('#continuePlaying').click();expect(page.locator('#viewerDialog')).not_to_be_visible();expect(page.locator('#albumBadge')).to_have_text('2')
 page.locator('#browse').click();expect(page.locator('.picker-card')).to_have_count(TOTAL);page.locator('#playerFilter').select_option('3');expect(page.locator('.picker-card')).to_have_count(THREE)
 eligible=page.locator('.picker-card').evaluate_all('(cards)=>cards.map(c=>c.dataset.pick)')
 page.locator('.picker-card').first.click()
 for _ in range(6):
  page.locator('#random').click();assert page.locator('#reference').get_attribute('data-challenge') in eligible
  page.locator('#next').click();assert page.locator('#reference').get_attribute('data-challenge') in eligible
 page.locator('#browse').click();page.locator('#playerFilter').select_option('1');expect(page.locator('.picker-card')).to_have_count(SOLO)
 page.locator('#playerFilter').select_option('all');expect(page.locator('.picker-card')).to_have_count(TOTAL)
 page.locator('#challengeSearch').fill('Spider-Man');expect(page.locator('.picker-card')).to_have_count(1);page.locator('#challengeSearch').fill('')
 page.locator('[data-close="pickerDialog"]').click();page.locator('#actionDeck').click();expect(page.locator('.picker-card')).to_have_count(sum(bool(x.get('action')) for x in ITEMS));expect(page.locator('#pickerGrid')).to_contain_text('Gangnam');expect(page.locator('#pickerGrid')).to_contain_text('Dab squad')
 page.locator('#challengeSearch').fill('NASA');expect(page.locator('.picker-card')).to_have_count(1);page.locator('[data-close="pickerDialog"]').click();page.locator('#browse').click();expect(page.locator('.picker-card')).to_have_count(TOTAL);expect(page.locator('#challengeSearch')).to_have_value('');expect(page.locator('#playerFilter')).to_have_value('all')
 page.locator('[data-category="Memes"]').click();assert page.locator('.picker-card').count()>=4;page.locator('.picker-card').first.click();expect(page.locator('#pickerDialog')).not_to_be_visible()
 page.locator('[data-page="album"]').click();expect(page.locator('.album-card')).to_have_count(2);page.locator('.group-options summary').click();page.locator('#groupName').fill('Vossen & Scouts')
 with page.expect_download(timeout=30000) as event:page.locator('#downloadZip').click()
 path=Path('/tmp/fotojacht-v2-test.zip');event.value.save_as(path)
 with zipfile.ZipFile(path) as z:
  assert z.testzip() is None;result=json.loads(z.read('results.json'));assert len(result)==2
  assert {r['title'] for r in result}=={first,second}
  for r in result:
   assert r['photo'].startswith('photos/') and r['comparison'].startswith('comparisons/')
   assert len(r['photo'])>len('photos/foto.jpg')
   assert Image.open(io.BytesIO(z.read(r['comparison']))).size==(1600,1080)
   assert z.read(r['photo'])[:2]==b'\xff\xd8' and b'Exif\x00\x00' not in z.read(r['photo'])
   assert r['original'] in z.namelist();assert r['credit']['author'] and r['credit']['licenseUrl']
  assert 'Vossen &amp; Scouts' in z.read('index.html').decode()
 # Album remains, deletion persists, and help remains accessible.
 page.locator('.album-card').first.click();page.on('dialog',lambda d:d.accept());page.locator('#deletePhoto').click();expect(page.locator('.album-card')).to_have_count(1)
 page.reload();expect(page.locator('.album-card')).to_have_count(1)
 page.locator('#help').click();expect(page.locator('#tutorialDialog')).to_be_visible();page.locator('#startPlaying').click()
 assert not errors,errors;assert not writes,writes
 print('PASS V2: tutorial, 56 decoded local images and player filters, 320–1440px, one photo per challenge/replacement, reload persistence, compare/continue, categories, ZIP titles/JPEGs/originals/credits, deletion/help; no JS errors or uploads.')
 browser.close()
