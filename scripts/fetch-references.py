"""Fetch explicitly curated Commons photographs, preserving image-level licensing.
Run: python scripts/fetch-references.py path/to/candidates.json
Candidate records: [Commons filename, challenge title, category, people, instruction].
Review every resulting photo/credit before publishing. No external gameplay images.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import re,html,json,io,subprocess,urllib.parse,sys,hashlib
ROOT=Path(__file__).resolve().parents[1]
CACHE=Path('/tmp/reference-review');CACHE.mkdir(exist_ok=True)
candidates=json.loads(Path(sys.argv[1]).read_text())
def clean(value):
 value=re.sub(r'<(style|script)\b[^>]*>.*?</\1>','',value,flags=re.S|re.I)
 return re.sub(r'\s+',' ',re.sub('<[^>]+>',' ',html.unescape(value))).strip()
def get(row):
 file,title,category,people,description=row
 key=hashlib.sha1(file.encode()).hexdigest()[:10];source='https://commons.wikimedia.org/wiki/File:'+urllib.parse.quote(file.replace(' ','_'))
 try:
  path=CACHE/(key+'.html')
  if not path.exists():path.write_bytes(subprocess.check_output(['curl','-fLsS','--retry','2','--max-time','35',source]))
  page=html.unescape(path.read_text())
  shorts=re.findall(r'class="licensetpl_short"[^>]*>(.*?)</span>',page,re.S)
  license=next((clean(x) for x in shorts if re.match(r'^(CC BY(?:-SA)? [0-9.]+|CC0|Public domain)',clean(x))),None)
  if not license:raise ValueError('No acceptable image-level license: '+repr([clean(x) for x in shorts]))
  if 'nominated for deletion' in clean(page[:page.find('id="filehistory"')]).lower():raise ValueError('Deletion warning: manual review required')
  match=re.search(r'<meta property="og:image" content="([^"]+)"',page)
  if not match:raise ValueError('No image')
  media=match[1].split('?')[0].replace('https://thumb.wikimedia.org/','https://upload.wikimedia.org/')
  raw=CACHE/(key+'.image')
  if not raw.exists():raw.write_bytes(subprocess.check_output(['curl','-fLsS','--retry','2','--max-time','40',media]))
  im=Image.open(io.BytesIO(raw.read_bytes()));im.thumbnail((1400,1200));
  slug=re.sub('[^a-z0-9]+','-',title.lower()).strip('-');image=f'assets/references/{slug}.jpg';im.convert('RGB').save(ROOT/image,'JPEG',quality=87,optimize=True)
  authorrow=re.search(r'id="fileinfotpl_aut".*?</td>\s*<td[^>]*>(.*?)(?:</td>\s*</tr>)',page,re.S)
  author=clean(authorrow[1]) if authorrow else ''
  fn=re.search(r'class="fn"[^>]*>(.*?)</',authorrow[1],re.S) if authorrow else None
  if fn:author=clean(fn[1])
  if file.startswith('Barack Obama with Spider-Man') or file.startswith('Barack Obama with artistic') or file.startswith('Obama and Biden'):author='Pete Souza / The White House'
  if file.startswith('Barack Obama Mic'):author='The White House'
  if file.startswith('Buzz salutes'):author='Neil Armstrong / NASA'
  if not author or len(author)>300:author=author[:300] or 'See source page — needs review'
  licenseURL=('https://creativecommons.org/publicdomain/mark/1.0/' if license=='Public domain' else 'https://creativecommons.org/publicdomain/zero/1.0/' if license=='CC0' else 'https://creativecommons.org/licenses/'+('by-sa' if 'BY-SA' in license else 'by')+'/'+license.split()[-1]+'/')
  result=dict(id='deck-'+key,title=title,category=category,people=people,description=description,image=image,author=author,license=license,licenseUrl=licenseURL,source=source,sourceFile=file,modifications='Resized to maximum 1400×1200; JPEG encoded; no pose edits',imageType='photograph',enabled=True)
  print('OK',title,license,author[:110],im.size,flush=True);return result
 except Exception as error:print('FAILED',title,str(error),flush=True);return None
with ThreadPoolExecutor(max_workers=2) as pool:results=[row for row in pool.map(get,candidates) if row]
Path('/tmp/new-photo-deck.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print('TOTAL',len(results))
