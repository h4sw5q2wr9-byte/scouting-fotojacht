"""Curated public-domain works only. Review source pages before changing this list."""
import urllib.request, urllib.parse, re, html, json, io, subprocess
from pathlib import Path
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[1]
WORKS=[
('foto-110','The Scream.jpg','Edvard Munch'),
('foto-111','Última Cena - Da Vinci 5.jpg','Leonardo da Vinci'),
('foto-112','Grant Wood - American Gothic - Google Art Project.jpg','Grant Wood'),
('foto-113','Mona Lisa, by Leonardo da Vinci, from C2RMF retouched.jpg','Leonardo da Vinci / C2RMF / Dcoetzee'),
('foto-114','Girl with a Pearl Earring.jpg','Johannes Vermeer'),
('foto-120','We Can Do It!.jpg','J. Howard Miller / Westinghouse'),
('foto-121','Creation of Adam (Michelangelo) Detail.jpg','Michelangelo'),
('foto-126','Johannes Vermeer - Het melkmeisje - Google Art Project.jpg','Johannes Vermeer'),
('foto-127','Rembrandt Harmensz. van Rijn - Nachtwacht - Google Art Project.jpg','Rembrandt van Rijn'),
('foto-128','Buzz salutes the U.S. Flag.jpg','NASA / Neil Armstrong'),
('foto-129','Uncle Sam (pointing finger).jpg','James Montgomery Flagg'),
]
def get(w):
 id,title,author=w
 try:
  source='https://commons.wikimedia.org/wiki/File:'+urllib.parse.quote(title.replace(' ','_'))
  page=subprocess.check_output(['curl','-fLsS','--max-time','30',source]).decode()
  if 'public domain' not in page.lower():raise ValueError('No public-domain declaration')
  match=re.search(r'<meta property="og:image" content="([^"]+)"',page)
  if not match:raise ValueError('No thumbnail')
  url=html.unescape(match[1]).split('?')[0].replace('https://thumb.wikimedia.org/','https://upload.wikimedia.org/');raw=subprocess.check_output(['curl','-fLsS','--max-time','30',url])
  im=Image.open(io.BytesIO(raw));im.thumbnail((1100,1100))
  path=f'assets/references/{id}.webp';im.convert('RGB').save(ROOT/path,'WEBP',quality=82)
  print(id,title,im.size)
  return dict(id=id,image=path,source=source,author=author,license='Publiek domein',modifications='Verkleind en omgezet naar WebP')
 except Exception as e:print('FAILED',id,title,str(e));return None
with ThreadPoolExecutor(max_workers=4) as pool:rows=[r for r in pool.map(get,WORKS) if r]
(ROOT/'assets/references/sources.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
