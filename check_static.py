# -*- coding: utf-8 -*-
"""M9 静态一致性检查脚本：
1) newtab.html 引用的 css/js 文件存在；
2) 各 js 中 getElementById('id') 的目标 id 在 newtab.html 中存在；
3) 各 js 相对 import 路径存在；
4) manifest.json 引用的图标存在且尺寸正确。
仅做静态文本分析，不启动浏览器。
"""
import os, re, json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = r"E:\标签页浏览器插件"
html_path = os.path.join(ROOT, "newtab.html")

errors, warnings, oks = [], [], []

html = open(html_path, encoding="utf-8").read()

for m in re.finditer(r'(?:href|src)="([^"]+)"', html):
    ref = m.group(1)
    if ref.startswith(("http://", "https://", "//")):
        warnings.append(f"外部引用(允许说明): {ref}")
        continue
    p = os.path.join(ROOT, ref.replace("/", os.sep))
    (oks if os.path.exists(p) else errors).append(f"HTML 引用 {ref}: {'存在' if os.path.exists(p) else '缺失'}")

html_ids = set(re.findall(r'id="([^"]+)"', html))

js_files = [f for f in os.listdir(os.path.join(ROOT, "js")) if f.endswith(".js")]
for fname in js_files:
    code = open(os.path.join(ROOT, "js", fname), encoding="utf-8").read()
    for m in re.finditer(r"getElementById\(\s*['\"]([^'\"]+)['\"]", code):
        target = m.group(1)
        if target not in html_ids:
            errors.append(f"{fname}: getElementById('{target}') 在 newtab.html 中不存在")
        else:
            oks.append(f"{fname} -> #{target}")

for fname in js_files:
    code = open(os.path.join(ROOT, "js", fname), encoding="utf-8").read()
    for m in re.finditer(r"""(?:import|export)\s+(?:[^'"]*\s+from\s+)?['"](\.[^'"]+)['"]""", code):
        rel = m.group(1)
        target = os.path.normpath(os.path.join(ROOT, "js", rel))
        candidates = [target, target + ".js"]
        if any(os.path.exists(c) for c in candidates):
            oks.append(f"{fname} import {rel}")
        else:
            errors.append(f"{fname}: import {rel} 解析不存在")

manifest = json.load(open(os.path.join(ROOT, "manifest.json"), encoding="utf-8"))
try:
    from PIL import Image
    for size, rel in manifest.get("icons", {}).items():
        p = os.path.join(ROOT, rel.replace("/", os.sep))
        if not os.path.exists(p):
            errors.append(f"图标缺失: {rel}")
            continue
        with Image.open(p) as im:
            if im.size == (int(size), int(size)):
                oks.append(f"图标 {rel} 尺寸 {im.size}")
            else:
                errors.append(f"图标 {rel} 尺寸不符 {im.size} != ({size},{size})")
except ImportError:
    warnings.append("PIL 不可用，跳过图标尺寸校验")

print("===== 通过项 (%d) =====" % len(oks))
for o in oks: print(" OK  ", o)
if warnings:
    print("\n===== 提示 (%d) =====" % len(warnings))
    for w in warnings: print(" WARN", w)
print("\n===== 错误 (%d) =====" % len(errors))
for e in errors: print(" ERR ", e)
sys.exit(1 if errors else 0)
