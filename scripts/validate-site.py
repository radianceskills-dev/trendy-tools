"""Validate tracked website assets without installing or rebuilding tools."""
from pathlib import Path
import re,json,subprocess,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parent.parent
ASSETS=['index.html','arctic-dashboard.css','favicon.svg','favicon.png','og-card.png','robots.txt','sitemap.xml','llms.txt','pricing.md','search-pages.css','flowchart-examples.json','flowchart-page.js','ai-flowchart/index.html','ai-flowchart-examples/index.html','offline-tools/index.html','ai-capabilities.json','tools-manifest.json']
for name in ASSETS:
 p=ROOT/name
 assert p.is_file() and p.stat().st_size, f'Missing website asset: {name}'
 if p.suffix=='.json': json.loads(p.read_text())
 if p.suffix=='.html':
  text=p.read_text()
  for tag in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>',text,re.S):json.loads(tag)
  for tag in re.findall(r'<script(?![^>]*application/ld\+json)[^>]*>(.*?)</script>',text,re.S):
   subprocess.run(['node','--check'],input=tag,text=True,check=True,capture_output=True)
  for link in re.findall(r'(?:src|href)=["\'](/[^"\']*)',text):
   path=link.split('?')[0].split('#')[0]
   if path.startswith('//') or path.startswith('/tools/'):continue
   target=ROOT/path.lstrip('/')
   if path.endswith('/'):target=target/'index.html'
   assert target.exists(),f'{name}: missing {path}'
ET.parse(ROOT/'sitemap.xml')
assert 'Sitemap: https://tools.rdskills-lab.com/sitemap.xml' in (ROOT/'robots.txt').read_text()
subprocess.run(['node','--check',str(ROOT/'flowchart-page.js')],check=True)
print('Dashboard, SEO pages, local asset references, structured data and JS syntax verified.')
