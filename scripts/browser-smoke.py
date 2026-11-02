from playwright.sync_api import sync_playwright, expect
import json, os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('FOTOJACHT_URL','http://127.0.0.1:8765/'),wait_until='networkidle')
 assert page.locator('.challenge').count()==145
 assert page.evaluate('document.documentElement.scrollWidth<=390')
 page.screenshot(path='/tmp/fotojacht-mobile.png',full_page=False)
 page.locator('#search').fill('MAND!');assert page.locator('.challenge').count()==1
 page.locator('[data-fav="foto-001"]').click()
 page.reload();assert page.locator('[data-fav="foto-001"]').get_attribute('class')=='fav on'
 page.locator('[data-open="foto-001"]').click();assert page.locator('#modalTitle').inner_text()=='MAND!'
 assert 'google.com' in page.locator('#searchOriginal').get_attribute('href')
 page.locator('#startRound').click();page.wait_for_timeout(1200);assert page.locator('#clock').inner_text()!='05:00'
 page.locator('#recreationPicker').set_input_files(str(ROOT/'assets/references/foto-114.webp'));page.wait_for_timeout(500)
 assert page.locator('#recreation img').count()==1
 page.locator('#awardPoints').fill('7');page.locator('#award').click();assert page.locator('#award').is_disabled()
 page.locator('#closeDetail').click();page.locator('#scoreMobile').click();assert page.locator('#teamAScore').inner_text()=='7'
 page.locator('#teamAName').fill('Scouts');page.locator('#closeScore').click()
 page.reload();page.locator('[data-open="foto-001"]').click();assert page.locator('#recreation img').count()==1;assert page.locator('#award').is_disabled()
 page.locator('#deleteRecreation').click();expect(page.locator('#recreation img')).to_have_count(0)
 page.locator('#closeDetail').click();page.locator('#search').fill('');page.locator('#localFilter').click();assert page.locator('.challenge').count()==11
 page.locator('[data-open="foto-110"]').click();assert page.locator('#reference img').count()==1
 page.locator('#expandReference').click();assert page.locator('#viewer').get_attribute('aria-hidden')=='false'
 page.locator('#closeViewer').click();page.locator('#next').click();assert page.locator('#modalTitle').inner_text()=='The Last Supper'
 page.locator('#prev').click();assert page.locator('#modalTitle').inner_text()=='The Scream (Schreeuw)'
 page.screenshot(path='/tmp/fotojacht-comparison.png')
 page.locator('#skipRound').click();assert page.locator('#modalTitle').inner_text()=='The Last Supper'
 page.locator('#closeDetail').click();page.locator('#localFilter').click()
 page.get_by_role('button',name='🇳🇱 Nederlandse memes',exact=True).click();assert page.locator('.challenge').count()>20
 page.locator('#search').fill('unfindable-string');assert page.locator('.challenge').count()==0
 page.locator('#random').click();assert page.locator('#toast').is_visible()
 assert not errors,errors
 print('PASS mobile Chromium gameplay, filters, navigation, timer, upload/delete, awards, persistence, full-screen viewer, empty state; no JS errors')
 page.set_viewport_size({'width':1440,'height':1000});page.locator('#search').fill('');page.get_by_role('button',name='✨ Alles',exact=True).click();page.screenshot(path='/tmp/fotojacht-desktop.png',full_page=False)
 assert page.evaluate('document.documentElement.scrollWidth<=1440')
 browser.close()
