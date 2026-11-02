from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json,time,base64,uuid
ROOT=Path(__file__).resolve().parents[1]
TEAM='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';USER='11111111-1111-4111-8111-111111111111';MEMBER='22222222-2222-4222-8222-222222222222';URL='https://fotojacht-test.supabase.co';CODE='f'*48
team={'id':TEAM,'name':'De Vossen','owner_id':USER,'created_at':'2026-11-02T12:00:00Z'}
user={'id':USER,'email':'owner@example.test','aud':'authenticated','role':'authenticated','email_confirmed_at':'2026-11-02T12:00:00Z','app_metadata':{'provider':'email'},'user_metadata':{}}
enc=lambda obj:base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip('=')
token=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':USER,'aud':'authenticated','role':'authenticated','exp':int(time.time())+3600})+'.mock-signature'
photos=[];objects={};calls=[];members=[{'user_id':USER,'display_name':'owner@example.test'},{'user_id':MEMBER,'display_name':'member@example.test'}]
def handle(route):
 req=route.request;path=req.url.split('.supabase.co')[1].split('?')[0];calls.append((req.method,path));data=req.post_data_json if 'application/json' in req.headers.get('content-type','') and req.post_data else None
 def reply(body,status=200):route.fulfill(status=status,content_type='application/json',body=json.dumps(body),headers={'access-control-allow-origin':'*'})
 if req.method=='OPTIONS':route.fulfill(status=204,headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'});return
 if path=='/auth/v1/token':reply({'access_token':token,'refresh_token':'mock-refresh','expires_in':3600,'token_type':'bearer','user':user});return
 if path=='/auth/v1/user':reply(user);return
 if path=='/auth/v1/logout':reply({});return
 if path=='/rest/v1/teams':reply([team]);return
 if path=='/rest/v1/team_members':reply(members);return
 if path=='/rest/v1/photos':
  if req.method=='POST':
   row=dict(data);row['created_at']='2026-11-02T12:30:00Z';photos.append(row);reply(None,201)
  elif req.method=='DELETE':photos.clear();reply(None,204)
  else:reply(photos)
  return
 if '/rpc/rotate_team_invite' in path:reply(CODE);return
 if '/rpc/remove_team_member' in path:members[:]=[m for m in members if m['user_id']!=data['p_user']];reply(None);return
 if path.startswith('/storage/v1/object/'):
  if req.method=='POST':
   assert req.headers['authorization']=='Bearer '+token
   from email.parser import BytesParser
   from email.policy import default
   multipart=BytesParser(policy=default).parsebytes(('Content-Type: '+req.headers['content-type']+'\r\n\r\n').encode()+req.post_data_buffer)
   image=next(part.get_payload(decode=True) for part in multipart.iter_parts() if part.get_content_type()=='image/jpeg')
   assert image[:2]==b'\xff\xd8'
   assert b'Exif\x00\x00' not in image
   key=path.split('/team-photos/')[1];objects[key]=image;reply({'Key':'team-photos/'+key});return
  if req.method=='GET':
   assert req.headers['authorization']=='Bearer '+token
   key=path.split('/team-photos/')[1];route.fulfill(status=200,content_type='image/jpeg',body=objects[key],headers={'cache-control':'no-store'});return
  if req.method=='DELETE':
   for key in data['prefixes']:objects.pop(key,None)
   reply([]);return
 reply({'error':'Unhandled '+path},500)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block');page.set_default_timeout(7000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/config.js',lambda r:r.fulfill(content_type='text/javascript',body='window.FOTOJACHT_CONFIG='+json.dumps({'url':URL,'publishableKey':'sb_publishable_mockkey'})+';'))
 page.route(URL+'/**',handle)
 page.goto('http://127.0.0.1:8767/',wait_until='networkidle')
 page.locator('[data-page="teams"]').click();expect(page.locator('#authPanel')).to_be_visible()
 page.locator('#email').fill('owner@example.test');page.locator('#password').fill('mock-password');page.locator('#signIn').click();expect(page.locator('#signedInPanel')).to_be_visible();expect(page.locator('#teamList')).to_contain_text('De Vossen')
 page.locator('[data-select-team]').click();expect(page.locator('#takePhoto')).to_be_enabled()
 page.locator('#takePhoto').click();page.locator('#photoPicker').set_input_files(ROOT/'assets/references/foto-114.webp');expect(page.locator('#uploadDialog')).to_be_visible();expect(page.locator('#uploadCaption')).to_contain_text('De Vossen')
 assert not photos and not objects # choosing an image does not send bytes
 page.locator('#photoPoints').select_option('7');page.locator('#savePhoto').click();expect(page.locator('#uploadDialog')).not_to_be_visible()
 assert len(photos)==1 and photos[0]['team_id']==TEAM and photos[0]['owner_id']==USER
 page.locator('[data-page="album"]').click();expect(page.locator('.gallery-item')).to_have_count(1);expect(page.locator('.gallery-item img')).to_have_js_property('complete',True)
 page.locator('.gallery-item').click();expect(page.locator('#photoDialog')).to_be_visible();expect(page.locator('.comparison img')).to_have_count(2)
 with page.expect_download() as event:page.locator('#downloadPhoto').click()
 assert event.value.suggested_filename.startswith('fotojacht-')
 page.locator('[data-close="photoDialog"]').click()
 with page.expect_download() as event:page.locator('[data-download-team]').click()
 export=Path('/tmp/fotojacht-test-export.html');event.value.save_as(export);assert 'data:image/jpeg;base64' in export.read_text()
 page.reload();expect(page.locator('.gallery-item')).to_have_count(1)
 page.locator('[data-page="teams"]').click();page.locator('[data-invite-team]').click();expect(page.locator('#generatedCode')).to_have_text(CODE);expect(page.locator('.member-row')).to_have_count(2)
 page.on('dialog',lambda dialog:dialog.accept())
 page.locator('[data-remove-member]').click();expect(page.locator('.member-row')).to_have_count(1)
 page.locator('[data-close="inviteDialog"]').click()
 page.locator('[data-page="album"]').click();page.locator('.gallery-item').click();page.locator('#deletePhoto').click();expect(page.locator('.gallery-item')).to_have_count(0);assert not objects
 page.locator('[data-page="teams"]').click();page.locator('#signOut').click();expect(page.locator('#authPanel')).to_be_visible()
 page.locator('[data-page="album"]').click();expect(page.locator('#albumContent')).to_contain_text('Log in');assert page.locator('[src^="blob:"]').count()==0
 assert not errors,errors
 assert any(path.startswith('/storage/v1/object/team-photos/') for method,path in calls if method=='GET')
 print('PASS mocked cloud UI: login, team selection, confirmed JPEG upload with no EXIF, private authenticated image requests, album/reload, export, invite/member removal, delete and logout media cleanup; no JS errors. This is not a live-service test.')
 b.close()
