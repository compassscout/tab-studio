#!/usr/bin/env node
/* 交付打包：一条命令重建 dist/ 里的三类下载包，并同步下载页版本号
 *
 *   node tools/pack-dist.js
 *
 * 产物（沿用现有命名与结构）：
 *   dist/tab-studio-edge-v<ver>.zip       Edge 商店提交包（zip 根即扩展文件，不含目录层）
 *   dist/assets/tab-studio-extension-v<ver>.zip  网页下载：解压成文件夹可直接"加载已解压的扩展"
 *   dist/assets/tab-studio-web-v<ver>.zip        网页版离线包（含 网页版说明.txt）
 * 同时把 dist/index.html 与 dist 下的 manifest/newtab/js/css/images 整体刷新。
 *
 * 优先用 zip 命令；没有则回退 tools/pyzip.py（Python 标准库），两者都写 UTF-8 文件名标记。
 */
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

process.on('uncaughtException', (e) => { console.error('[pack-dist] 未捕获异常:', e && e.stack || e); process.exit(1); });

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version;
if (!version) { console.error('manifest.json 缺 version'); process.exit(1); }

const EXT_ITEMS = ['manifest.json', 'newtab.html', 'css', 'js', 'icons', 'images', 'popup.html'];
const DOC_FILES = ['README.md', '安装说明.md'];
const WEB_DOC = '网页版说明.txt';

const rm = (p) => fs.rmSync(p, { recursive: true, force: true });
const cp = (from, to) => fs.cpSync(path.join(ROOT, from), path.join(to, path.basename(from)), { recursive: true });

/* 优先系统 zip；没有就用 tools/pyzip.py（Python 标准库），两者都写 UTF-8 文件名标记 */
const HAS_ZIP = spawnSync('zip', ['--version'], { stdio: 'ignore' }).status === 0;
function zip(cwd, out, args) {
  out = path.resolve(cwd, out);
  if (HAS_ZIP) {
    execFileSync('zip', ['-r', '-q', out, ...args], { cwd, stdio: 'inherit' });
  } else {
    const win = process.platform === 'win32';
    const py = win ? 'py' : 'python3';
    const pre = win ? ['-3'] : [];
    const r = spawnSync(py, [...pre, path.join(__dirname, 'pyzip.py'), out, cwd, ...args], { stdio: 'inherit' });
    if (r.status !== 0) { console.error('打包失败：pyzip 退出码 ' + r.status + '（请确认已安装 Python 3）'); process.exit(1); }
  }
  console.log('  ✓', path.relative(ROOT, out));
}

/* 1. 刷新 dist 静态镜像（index.html 保留，只替换其余文件） */
for (const item of ['css', 'js', 'icons', 'images', 'manifest.json', 'newtab.html', 'popup.html']) {
  rm(path.join(DIST, item));
  cp(item, DIST);
}
console.log('dist/ 静态镜像已刷新');

/* 2. Edge 商店包：zip 根目录即扩展文件 */
rm(path.join(DIST, `tab-studio-edge-v${version}.zip`));
for (const f of fs.readdirSync(DIST).filter((x) => /^tab-studio-edge-v.*\.zip$/.test(x) && x !== `tab-studio-edge-v${version}.zip`)) rm(path.join(DIST, f));
zip(DIST, path.join(DIST, `tab-studio-edge-v${version}.zip`), EXT_ITEMS);

/* 3. 扩展 zip（解压为文件夹） */
const ASSETS = path.join(DIST, 'assets');
fs.mkdirSync(ASSETS, { recursive: true });
const stage = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'tabstudio-pack-'));
const extDir = path.join(stage, `tab-studio-extension-v${version}`);
fs.mkdirSync(extDir, { recursive: true });
for (const item of EXT_ITEMS) cp(item, extDir);
for (const doc of DOC_FILES) if (fs.existsSync(path.join(ROOT, doc))) cp(doc, extDir);
rm(path.join(ASSETS, `tab-studio-extension-v${version}.zip`));
for (const f of fs.readdirSync(ASSETS).filter((x) => /^tab-studio-(extension|web)-v.*\.zip$/.test(x))) rm(path.join(ASSETS, f));
zip(stage, path.join(ASSETS, `tab-studio-extension-v${version}.zip`), [`tab-studio-extension-v${version}`]);

/* 4. 网页版离线包（去 manifest，加说明） */
const webDir = path.join(stage, `tab-studio-web-v${version}`);
fs.cpSync(extDir, webDir, { recursive: true });
rm(path.join(webDir, 'manifest.json'));
rm(path.join(webDir, 'popup.html'));
rm(path.join(webDir, 'README.md'));
rm(path.join(webDir, '安装说明.md'));
if (fs.existsSync(path.join(ROOT, WEB_DOC))) cp(WEB_DOC, webDir);
zip(stage, path.join(ASSETS, `tab-studio-web-v${version}.zip`), [`tab-studio-web-v${version}`]);
rm(stage);

/* 5. dist/index.html 下载链接版本同步 */
const idx = path.join(DIST, 'index.html');
if (fs.existsSync(idx)) {
  let html = fs.readFileSync(idx, 'utf8');
  html = html.replace(/tab-studio-(extension|web)-v\d+\.\d+\.\d+\.zip/g, (m, kind) => `tab-studio-${kind}-v${version}.zip`);
  html = html.replace(/TAB-STUDIO-\d+\.\d+\.\d+-/g, `TAB-STUDIO-${version}-`);
  /* 注意：不改写正文里的 vX.Y.Z 叙述（如"商店当前上架 v2.1.0"），发布文案请人工更新 */
  fs.writeFileSync(idx, html, 'utf8');
  console.log('  ✓ dist/index.html 下载链接已指向 v' + version + '（正文叙述请人工核对）');
}

console.log(`打包完成（v${version}）。发布顺序：git push → GitHub Actions 出桌面 exe Release → 把 dist/ 推到 gh-pages`);
