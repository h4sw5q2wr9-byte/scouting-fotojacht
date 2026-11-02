from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);page.set_default_timeout(7000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8767/',wait_until='networkidle')
 expect(page.locator('#reference img')).to_have_js_property('naturalWidth',930)
 assert page.locator('#takePhoto').is_disabled()
 page.screenshot(path='/tmp/fotojacht-simple-mobile.png',full_page=False)
 page.locator('#browse').click();assert page.locator('.browse-card').count()==11
 page.locator('#showAll').check();assert page.locator('.browse-card').count()==145
 page.locator('#search').fill('MAND!');expect(page.locator('.browse-card')).to_have_count(1);page.locator('.browse-card').click();expect(page.locator('#reference a')).to_have_attribute('href',__import__('re').compile('google.com'))
 page.locator('#timerToggle').click();expect(page.locator('#clock')).not_to_have_text('05:00')
 page.locator('#favorite').click();page.reload();expect(page.locator('#favorite')).to_have_attribute('aria-pressed','true')
 page.locator('[href="#album"][data-page]').click();expect(page.locator('#albumContent')).to_contain_text('Log in')
 page.locator('[href="#teams"][data-page]').click();expect(page.locator('#connectionNotice')).to_be_visible();expect(page.locator('#authPanel')).not_to_be_visible()
 page.locator('[href="#spelen"][data-page]').click()
 for width in [320,375,390,768,1440]:
  page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth')==width
 page.set_viewport_size({'width':390,'height':844});page.locator('#browse').click();page.locator('#search').fill('');page.locator('#showAll').uncheck();page.locator('[data-challenge="foto-114"]').click();page.evaluate('scrollTo(0,0)');page.screenshot(path='/tmp/fotojacht-simple-mobile.png')
 assert not errors,errors
 print('PASS: simple mobile navigation, in-site images, 145 accessible challenges, timer, favorites, safe unconfigured mode and responsive widths; no JS errors.')
 b.close()
