#!/usr/bin/env python3
"""静态一致性检查（v2）：manifest / 资源引用 / HTML id / JS import / Chrome 保留名。

用法：python check_static.py
退出码 0 表示全部通过。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
errors = []
warnings = []

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Chrome 保留：扩展根目录下以 _ 开头的文件/目录会导致加载失败
for p in ROOT.iterdir():
    if p.name.startswith('_'):
        errors.append(f'根目录存在 Chrome 保留名前缀项：{p.name}（以 _ 开头会导致扩展无法加载）')

try:
    manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
except Exception as exc:  # noqa: BLE001
    print('manifest.json 解析失败:', exc)
    sys.exit(1)

for key in ('name', 'version', 'manifest_version'):
    if key not in manifest:
        errors.append(f'manifest 缺少字段 {key}')
if manifest.get('manifest_version') != 3:
    errors.append('manifest_version 不是 3')

newtab = manifest.get('chrome_url_overrides', {}).get('newtab')
if not newtab:
    errors.append('manifest 未配置 chrome_url_overrides.newtab')
elif not (ROOT / newtab).exists():
    errors.append(f'newtab 页面不存在：{newtab}')

for _size, rel in (manifest.get('icons') or {}).items():
    if not (ROOT / rel).exists():
        errors.append(f'manifest 图标缺失：{rel}')
for res in manifest.get('web_accessible_resources', []):
    for pattern in res.get('resources', []):
        if pattern.startswith('_favicon'):
            continue
        if '*' not in pattern and not (ROOT / pattern).exists():
            errors.append(f'web_accessible_resources 文件缺失：{pattern}')

html_path = ROOT / newtab if newtab else ROOT / 'newtab.html'
html = html_path.read_text(encoding='utf-8')
html_ids = set(re.findall(r'\bid="([^"]+)"', html))
for ref in re.findall(r'(?:href|src)="([^"]+)"', html):
    if ref.startswith(('http://', 'https://', '#', 'data:')):
        continue
    if not (ROOT / ref).exists():
        errors.append(f'{html_path.name} 引用的资源不存在：{ref}')

DYNAMIC_IDS = {
    'wp-name', 'wp-type', 'wp-thumb', 'font-color-picker', 'engine-menu', 'bd-perm-btn',
}
js_files = sorted((ROOT / 'js').glob('*.js'))
for js in js_files:
    text = js.read_text(encoding='utf-8')
    for imp in re.findall(r"from\s+'([^']+)'", text) + re.findall(r"import\('([^']+)'\)", text):
        if not imp.startswith('.'):
            continue
        if not (js.parent / imp).resolve().exists():
            errors.append(f'{js.name} 引用的模块不存在：{imp}')
    for gid in re.findall(r"getElementById\('([^']+)'\)", text):
        if gid in html_ids or gid in DYNAMIC_IDS:
            continue
        warnings.append(f'{js.name} 静态引用 id「{gid}」不在 HTML 中（可能由 JS 动态创建）')

for css in sorted((ROOT / 'css').glob('*.css')):
    for ref in re.findall(r'url\(\s*[\'"]?([^\'")]+)', css.read_text(encoding='utf-8')):
        if ref.startswith(('http', 'data:', '#')):
            continue
        if not (ROOT / ref).exists():
            errors.append(f'{css.name} 引用的资源不存在：{ref}')

wp_dir = ROOT / 'images' / 'wallpapers'
wallpapers = sorted(wp_dir.glob('*.jpg')) if wp_dir.exists() else []
if len(wallpapers) < 8:
    warnings.append(f'内置壁纸只有 {len(wallpapers)} 张，建议 ≥ 8 张')

print(f'检查：manifest 1，HTML 1，CSS {len(list((ROOT / "css").glob("*.css")))}，JS {len(js_files)}，壁纸 {len(wallpapers)}')
for w in warnings:
    print('  [warn]', w)
if errors:
    print(f'\n发现 {len(errors)} 个错误：')
    for e in errors:
        print('  [error]', e)
    sys.exit(1)
print('\n全部通过：0 错误')
