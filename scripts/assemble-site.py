"""Publish only curated website assets and generated tools, never the repo root."""
from pathlib import Path
import shutil,tomllib
import runpy
context=runpy.run_path(str(Path(__file__).with_name('validate-site.py')))
root=context['ROOT'];out=root/'dist-site'
if out.exists():shutil.rmtree(out)
out.mkdir()
for name in context['ASSETS']:
 target=out/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/name,target)
shutil.copytree(root/'tools',out/'tools')
config=tomllib.loads((root/'netlify.toml').read_text())
headers=[]
for rule in config.get('headers',[]):
 headers.append(rule['for'])
 for key,value in rule.get('values',{}).items():headers.append(f'  {key}: {value}')
(out/'_headers').write_text('\n'.join(headers)+'\n')
redirects=['https://trendytools.netlify.app/* https://tools.rdskills-lab.com/:splat 301!', 'http://trendytools.netlify.app/* https://tools.rdskills-lab.com/:splat 301!', 'http://tools.rdskills-lab.com/* https://tools.rdskills-lab.com/:splat 301!']
for rule in config.get('redirects',[]):redirects.append(f"{rule['from']} {rule['to']} {rule.get('status',301)}"+('!' if rule.get('force') else ''))
(out/'_redirects').write_text('\n'.join(redirects)+'\n')
assert not any((out/name).exists() for name in ['.github','scripts','workers','.build-cache','node_modules','AGENTS.md'])
print('Assembled website-only dist-site, including headers and redirects.')
