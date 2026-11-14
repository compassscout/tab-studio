'use strict';
/* desktop/main.js — Electron 主进程
 * 目标：把同一份源码（根目录 newtab.html + js/css/icons/images）装进一个桌面窗口。
 * - 用自定义协议 tabstudio://app/ 加载页面：IndexedDB / ES Module / CSP 都按正常站点处理
 * - 站点在独立子窗口打开，主窗口始终是「工作室」
 * - 只给必要域名放行 CORS（扩展里靠 host_permissions，桌面端靠响应头注入）
 */
const { app, BrowserWindow, Menu, dialog, protocol, net, session, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

const IS_SMOKE = process.argv.includes('--smoke');
const IMPORT_FILE = (() => {
  const i = process.argv.indexOf('--import');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const ROOT = path.resolve(__dirname, '..');
const SCHEME = 'tabstudio';
const ORIGIN = `${SCHEME}://app`;
const START_URL = `${ORIGIN}/newtab.html`;
const APP_ICON = path.join(ROOT, 'icons', 'icon128.png');

/* 冒烟测试用独立数据目录，不污染用户真实数据 */
if (IS_SMOKE) app.setPath('userData', path.join(os.tmpdir(), 'tabstudio-smoke'));
if (IMPORT_FILE) app.setPath('userData', path.join(os.tmpdir(), 'tabstudio-import-test'));

protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
}]);

/* ---------------- 静态资源协议 ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
};

/* 页面的 CSP：只允许本地脚本，图片可到 https，连接只走 https */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: data:",
  "media-src 'self' blob: https:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function registerAppProtocol() {
  protocol.handle(SCHEME, async (request) => {
    let url;
    try { url = new URL(request.url); } catch (e) { return new Response('bad request', { status: 400 }); }
    if (url.hostname !== 'app') return new Response('not found', { status: 404 });

    let rel = decodeURIComponent(url.pathname || '/');
    if (rel === '/' || rel === '') rel = '/newtab.html';
    const filePath = path.join(ROOT, path.normalize(rel).replace(/^[\\/]+/, ''));
    /* 目录穿越保护：只允许读源码根目录内的文件 */
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
      return new Response('forbidden', { status: 403 });
    }

    const ext = path.extname(filePath).toLowerCase();
    try {
      const res = await net.fetch(pathToFileURL(filePath).toString());
      if (!res.ok) return new Response('not found', { status: 404 });
      const headers = new Headers(res.headers);
      headers.set('Content-Type', MIME[ext] || 'application/octet-stream');
      headers.set('Cache-Control', 'no-cache');
      if (ext === '.html') headers.set('Content-Security-Policy', CSP);
      return new Response(res.body, { status: 200, headers });
    } catch (e) {
      return new Response('not found', { status: 404 });
    }
  });
}

/* ---------------- CORS 白名单 ---------------- */

/* 按域名后缀放行：favicon.im 会 302 到 a.favicon.im，必应也可能换子域，
 * 所以用通配匹配 + 后缀校验，避免每加一个跳转域名就要改一次代码。 */
const CORS_SUFFIXES = [
  'favicon.im',        /* 网站图标 */
  'duckduckgo.com',    /* 网站图标 */
  'google.com',        /* 网站图标 / 搜索建议 */
  'gstatic.com',
  'bing.com',          /* 必应每日壁纸 / 搜索 */
  'open-meteo.com',    /* 天气 */
];

function isCorsHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return false;
  return CORS_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
}

function relaxCors() {
  const filter = { urls: CORS_SUFFIXES.flatMap((s) => [`https://${s}/*`, `https://*.${s}/*`]) };
  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    let hostname = '';
    try { hostname = new URL(details.url).hostname; } catch (e) { hostname = ''; }
    if (!isCorsHost(hostname)) { callback({}); return; }

    const headers = details.responseHeaders || {};
    for (const key of Object.keys(headers)) {
      if (/^access-control-allow-(origin|credentials|headers|methods)$/i.test(key)) delete headers[key];
    }
    headers['Access-Control-Allow-Origin'] = ['*'];
    headers['Access-Control-Allow-Headers'] = ['*'];
    headers['Access-Control-Allow-Methods'] = ['GET, HEAD, OPTIONS'];
    callback({ responseHeaders: headers, statusLine: details.statusLine });
  });
}

/* ---------------- 窗口状态 ---------------- */

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function readState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')) || {}; } catch (e) { return {}; }
}

let saveTimer = null;
function saveStateSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const win = mainWindow;
    if (!win || win.isDestroyed()) return;
    const state = { bounds: win.getNormalBounds(), maximized: win.isMaximized() };
    try { fs.writeFileSync(stateFile(), JSON.stringify(state)); } catch (e) { /* ignore */ }
  }, 400);
}

/** 上次的窗口位置可能落在已拔掉的显示器上，检查后才复用 */
function safeBounds(saved) {
  if (!saved || typeof saved !== 'object') return null;
  const { x, y, width, height } = saved;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  const w = Math.min(Math.max(Math.round(width), 960), 4096);
  const h = Math.min(Math.max(Math.round(height), 640), 2880);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { width: w, height: h };
  const visible = require('electron').screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return x < a.x + a.width - 80 && x + w > a.x + 80 && y >= a.y - 40 && y < a.y + a.height - 80;
  });
  return visible ? { x: Math.round(x), y: Math.round(y), width: w, height: h } : { width: w, height: h };
}

/* ---------------- 站点子窗口 ---------------- */

let mainWindow = null;
const siteWindows = new Set();
let lastSite = null;

function isWebUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function rememberSite(win, url, title) {
  const target = String(url || win.webContents.getURL() || '');
  if (!isWebUrl(target)) return;
  lastSite = { url: target, title: String(title || win.getTitle() || '') };
}

function decorateSiteWindow(win) {
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) { openSiteWindow(url, { newTab: true }); return { action: 'deny' }; }
    if (/^mailto:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(`${SCHEME}://`)) event.preventDefault();
  });
  win.webContents.on('did-navigate', (_e, url) => rememberSite(win, url, win.getTitle()));
  win.webContents.on('did-navigate-in-page', (_e, url) => rememberSite(win, url, win.getTitle()));
  win.webContents.on('page-title-updated', (_e, title) => {
    win.setTitle(title ? `${title} — TAB STUDIO` : 'TAB STUDIO');
    rememberSite(win, win.webContents.getURL(), title);
  });
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => siteWindows.delete(win));
}

function openSiteWindow(rawUrl, { newTab = true } = {}) {
  const url = String(rawUrl || '').trim();
  if (!url) return null;
  if (/^mailto:/i.test(url)) { shell.openExternal(url); return null; }
  if (!isWebUrl(url)) return null;

  /* newTab=false：在当前（最近打开的）站点窗口里跳转，模拟「当前标签页」 */
  if (newTab === false) {
    const list = [...siteWindows].filter((w) => !w.isDestroyed());
    const current = list.reverse().find((w) => w.isFocused()) || list[0];
    if (current) {
      current.loadURL(url);
      current.focus();
      return current;
    }
  }

  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 480,
    minHeight: 360,
    backgroundColor: '#ffffff',
    title: 'TAB STUDIO',
    icon: APP_ICON,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: true,
    },
  });
  decorateSiteWindow(win);
  siteWindows.add(win);
  const loading = win.loadURL(url);
  if (loading && loading.catch) loading.catch(() => {});
  rememberSite(win, url, '');
  return win;
}

function notify(message) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('studio:toast', String(message || ''));
}

/* ---------------- 主窗口 ---------------- */

function createMainWindow() {
  const state = readState();
  const bounds = safeBounds(state.bounds) || { width: 1360, height: 860 };

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'TAB STUDIO',
    icon: APP_ICON,
    backgroundColor: '#101418',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webSecurity: true,
    },
  });

  if (state.maximized) mainWindow.maximize();

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('resize', saveStateSoon);
  mainWindow.on('move', saveStateSoon);
  mainWindow.on('maximize', saveStateSoon);
  mainWindow.on('unmaximize', saveStateSoon);
  mainWindow.on('closed', () => { mainWindow = null; });

  /* 页面里的 target=_blank / window.open 一律走站点窗口，不在工作室里导航走 */
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openSiteWindow(url, { newTab: true });
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(ORIGIN)) return;
    event.preventDefault();
    openSiteWindow(url, { newTab: true });
  });
  /* 页面上拖入文件时 Chromium 默认会导航到 file://，这里拦住 */
  mainWindow.webContents.on('will-frame-navigate', (event, url) => {
    if (url.startsWith(ORIGIN) || url.startsWith('about:')) return;
    event.preventDefault();
  });

  mainWindow.loadURL(START_URL);

  if (process.argv.includes('--devtools')) mainWindow.webContents.openDevTools({ mode: 'detach' });
  return mainWindow;
}

/* ---------------- 菜单 ---------------- */

function send(action) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('studio:shortcut', action);
}

function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '新建站点', accelerator: 'CmdOrCtrl+T', click: () => send('add') },
        { label: '新建文件夹', accelerator: 'CmdOrCtrl+Shift+N', click: () => send('folder') },
        { label: '壁纸库', accelerator: 'CmdOrCtrl+Shift+B', click: () => send('wallpaper') },
        { type: 'separator' },
        { label: '设置', accelerator: 'CmdOrCtrl+,', click: () => send('settings') },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '聚焦搜索', accelerator: 'CmdOrCtrl+K', click: () => send('search') },
        { type: 'separator' },
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '强制重新加载', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: '开发者工具', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '实际大小', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: '放大', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: '全屏', accelerator: 'F11', role: 'togglefullscreen' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: '数据保存在哪里', click: () => shell.openPath(app.getPath('userData')) },
        { label: '关于 TAB STUDIO', click: showAbout },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '关于 TAB STUDIO',
    message: 'TAB STUDIO',
    detail: [
      `桌面版 ${app.getVersion()}`,
      `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
      '',
      '界面源码就在本目录（newtab.html / js / css），改完按 Ctrl+R 立即生效。',
      `数据目录：${app.getPath('userData')}`,
    ].join('\n'),
    buttons: ['知道了'],
    noLink: true,
  });
}

/* ---------------- 生命周期 ---------------- */

function setupSession() {
  relaxCors();
  /* 权限一律拒绝，只保留全屏与剪贴板写入这类无风险能力 */
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'fullscreen' || permission === 'clipboard-sanitized-write');
  });

  session.defaultSession.on('will-download', (event, item) => {
    const name = item.getFilename();
    item.on('done', (_e, state) => {
      if (state === 'completed') notify(`已下载：${name}`);
      else if (state === 'interrupted') notify(`下载中断：${name}`);
    });
  });
}

/* ---------------- 新版本检查（仅打包版，不自动下载/安装） ---------------- */

const RELEASE_REPO = 'compassscout/tab-studio';

/** 语义化版本比较：a>b 返回 1，a<b 返回 -1，相等 0 */
function compareVersions(a, b) {
  const pa = String(a || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

async function checkForUpdate() {
  try {
    const res = await net.fetch(`https://api.github.com/repos/${RELEASE_REPO}/releases/latest`, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'TAB-STUDIO-desktop' },
    });
    if (!res.ok) return;
    const info = await res.json();
    const latest = (info && info.tag_name) || '';
    const current = app.getVersion();
    if (!latest || compareVersions(latest, current) <= 0) return;
    /* 优先免安装版资源，没有就退回 release 页面 */
    const assets = Array.isArray(info.assets) ? info.assets : [];
    const pick = assets.find((x) => /portable/i.test(x.name)) || assets.find((x) => /\.exe$/i.test(x.name));
    const url = (pick && pick.browser_download_url) || info.html_url;
    const payload = { version: String(latest).replace(/^v/i, ''), url: String(url || '') };
    /* 页面监听器在 boot 里注册，留一点余量再推送 */
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('studio:update', payload);
      }
    }, 2500);
  } catch (e) {
    /* 离线或接口异常：静默，不打扰 */
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.tabstudio.desktop');
    registerAppProtocol();
    setupSession();
    buildMenu();
    createMainWindow();

    ipcMain.handle('studio:open-url', (_e, url, opts) => {
      openSiteWindow(String(url || ''), opts || {});
      return { ok: true };
    });
    ipcMain.handle('studio:last-page', () => lastSite);
    ipcMain.handle('studio:open-external', (_e, url) => {
      if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) shell.openExternal(url);
      return { ok: true };
    });
    ipcMain.handle('studio:info', () => ({
      version: app.getVersion(),
      electron: process.versions.electron,
      dataPath: app.getPath('userData'),
    }));

    if (IS_SMOKE) runSmoke();
    if (IMPORT_FILE) runImportTest(IMPORT_FILE);
    /* 只有安装后的正式包才检查更新：源码运行版本永远最新，没必要问 GitHub */
    if (app.isPackaged && !IS_SMOKE && !IMPORT_FILE) setTimeout(checkForUpdate, 8000);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

/* ---------------- 冒烟测试：截图 + 收集控制台错误 ---------------- */

/* 隐藏模式：--import <file> 在临时环境里真实执行一次导入并截图（用于验证备份文件兼容性） */
function runImportTest(file) {
  const errors = [];
  const outDir = path.join(ROOT, 'screenshots');
  mainWindow.webContents.on('console-message', (_e, level, message, line, source) => {
    if (level >= 2) errors.push(`${message} @${source}:${line}`);
  });
  mainWindow.webContents.once('did-finish-load', async () => {
    try {
      await new Promise((r) => setTimeout(r, 2500));
      await mainWindow.webContents.executeJavaScript(
        "document.querySelector('.privacy-modal [data-ok]')?.click(); true", true,
      );
      await new Promise((r) => setTimeout(r, 1800));
      const json = fs.readFileSync(file, 'utf-8');
      const result = await mainWindow.webContents.executeJavaScript(`(async () => {
        const data = ${JSON.stringify(json)};
        const { importAll } = await import('./js/store.js');
        const parsed = JSON.parse(data);
        const { state: st, issues } = await importAll({ ...parsed.data, formatVersion: parsed.formatVersion });
        return { sites: st.sites.length, folders: st.folders.length, pages: st.pages.length, issues: (issues || []).length };
      })()`, true);
      console.log('[import] imported:', JSON.stringify(result));
      mainWindow.webContents.invalidate();
      /* 448 个远程图标按并发闸门分批加载，多等一会儿让首屏图标就位 */
      await new Promise((r) => setTimeout(r, 20000));
      const image = await mainWindow.webContents.capturePage();
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'desktop-08-imported.png'), image.toPNG());
      const state = await mainWindow.webContents.executeJavaScript(`(async () => {
        const probe = (src) => new Promise((res) => {
          const img = new Image();
          const t = setTimeout(() => res({ src: src.slice(0, 50), status: 'timeout' }), 8000);
          img.onload = () => { clearTimeout(t); res({ src: src.slice(0, 50), status: 'ok', w: img.naturalWidth }); };
          img.onerror = (e) => { clearTimeout(t); res({ src: src.slice(0, 50), status: 'error' }); };
          img.referrerPolicy = 'no-referrer';
          img.src = src;
        });
        const urls = [];
        document.querySelectorAll('.folder-icon .folder-mini').forEach((m) => {
          const s = m.style.backgroundImage || '';
          const mm = s.match(/url\\("([^"]+)"/);
          if (mm) urls.push(mm[1]);
        });
        const card = document.querySelector('.folder-icon');
        const cs = card ? getComputedStyle(card) : null;
        const mini0 = document.querySelector('.folder-icon .folder-mini');
        const mcs = mini0 ? getComputedStyle(mini0) : null;
        const before = mini0 ? mini0.getBoundingClientRect().width : -1;
        /* 实验：给 mini 一个子节点，看尺寸是否恢复 */
        let afterImg = -1;
        if (mini0) {
          const t = document.createElement('span');
          mini0.appendChild(t);
          afterImg = mini0.getBoundingClientRect().width;
          t.remove();
        }
        const exp = {};
        if (mini0) {
          mini0.style.width = '100%';
          exp.widthPct = mini0.getBoundingClientRect().width;
          mini0.style.width = '';
          mini0.style.aspectRatio = '1';
          exp.aspect = mini0.getBoundingClientRect().width;
          mini0.style.aspectRatio = '';
        }
        const csKeys = ['display','width','height','alignSelf','justifySelf','gridArea','overflow','minWidth','minHeight','position','boxSizing','flexBasis','contain','contentVisibility','zoom'];
        const cssDump = {};
        if (mcs) { csKeys.forEach((k) => { cssDump[k] = mcs[k]; }); cssDump.rect = { w: mini0.getBoundingClientRect().width, h: mini0.getBoundingClientRect().height }; }
        return {
          miniCount: urls.length,
          before,
          afterImg,
          exp,
          cssDump,
          cardKids: card ? card.children.length : 0,
        };
      })()`, true);
      console.log('[import] probe:', JSON.stringify(state, null, 1));
      console.log('[import] errors:', errors.length ? JSON.stringify(errors.slice(0, 10)) : 'none');
    } catch (e) {
      console.log('[import] failed:', e && e.message);
    }
    setTimeout(() => app.exit(0), 300);
  });
}

function runSmoke() {
  const errors = [];
  const outDir = app.isPackaged
    ? path.join(app.getPath('userData'), 'smoke')
    : path.join(ROOT, 'screenshots');
  const shot = async (name) => {
    try {
      /* Windows 下 capturePage 可能拿到上一帧合成结果（尤其刚弹出浮层时），
         先 invalidate 强制重绘一小段再截，保证浮层入镜 */
      mainWindow.webContents.invalidate();
      await new Promise((r) => setTimeout(r, 160));
      const image = await mainWindow.webContents.capturePage();
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, name), image.toPNG());
    } catch (e) {
      console.log(`[smoke] screenshot ${name} skipped: ${e && e.message}`);
    }
  };

  mainWindow.webContents.on('console-message', (_e, level, message, line, source) => {
    if (level >= 2) errors.push(`${message} @${source}:${line}`);
  });
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    errors.push(`did-fail-load ${code} ${desc} ${url}`);
  });

  mainWindow.webContents.once('did-finish-load', async () => {
    try {
      await new Promise((r) => setTimeout(r, 2500));
      await shot('desktop-01-notice.png');
      await mainWindow.webContents.executeJavaScript(
        "document.querySelector('.privacy-modal [data-ok]')?.click(); true", true,
      );
      await new Promise((r) => setTimeout(r, 2200));
      await shot('desktop-02-home.png');

      /* 注入一个 6 站点的文件夹，验证文件夹九宫格渲染 */
      const injected = await mainWindow.webContents.executeJavaScript(`(async () => {
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open('compass_newtab');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const getAll = (store) => new Promise((resolve, reject) => {
          const q = db.transaction(store).objectStore(store).getAll();
          q.onsuccess = () => resolve(q.result || []);
          q.onerror = () => reject(q.error);
        });
        const put = (store, value) => new Promise((resolve, reject) => {
          const q = db.transaction(store, 'readwrite').objectStore(store).put(value);
          q.onsuccess = () => resolve(true);
          q.onerror = () => reject(q.error);
        });
        const sites = await getAll('sites');
        const pages = await getAll('pages');
        if (!sites.length || !pages.length) return { skipped: true, sites: sites.length };
        const picks = sites.slice(0, 6);
        const folder = { id: 'smoke-folder', name: '常用收藏', iconIds: picks.map((s) => s.id) };
        await put('folders', folder);
        const page = pages[0];
        page.siteIds = page.siteIds || [];
        if (!page.siteIds.includes(folder.id)) page.siteIds.unshift(folder.id);
        await put('pages', page);
        return { sites: sites.length, folderSites: picks.length };
      })()`, true);
      console.log('[smoke] folder:', JSON.stringify(injected));
      if (injected && !injected.skipped) {
        await mainWindow.webContents.executeJavaScript('location.reload(); true', true);
        await new Promise((r) => setTimeout(r, 5000));
        await shot('desktop-03-folder.png');
        const folderInfo = await mainWindow.webContents.executeJavaScript(`(() => ({
          folders: document.querySelectorAll('.folder-icon .folder-mini img').length,
          minis: document.querySelectorAll('.folder-icon .folder-mini').length,
        }))()`, true);
        console.log('[smoke] folder-grid:', JSON.stringify(folderInfo));
        const miniCss = await mainWindow.webContents.executeJavaScript(`(() => {
          const m = document.querySelector('.folder-icon .folder-mini');
          if (!m) return null;
          const card = m.closest('.folder-icon');
          const ccs = getComputedStyle(card);
          const cell = card.closest('.cell');
          const keys = ['display','width','height','alignSelf','justifySelf','gridArea','overflow','minWidth','minHeight','position','boxSizing','flexBasis','contain','contentVisibility','zoom'];
          const o = { rect: { w: m.getBoundingClientRect().width, h: m.getBoundingClientRect().height } };
          keys.forEach((k) => { o[k] = ccs[k]; });
          o.card = { w: ccs.width, h: ccs.height, cols: ccs.gridTemplateColumns, rows: ccs.gridTemplateRows,
                     align: ccs.alignItems, justify: ccs.justifyItems, pad: ccs.padding, gap: ccs.gap,
                     iconSize: ccs.getPropertyValue('--icon-size') };
          o.cellRect = cell ? { w: cell.getBoundingClientRect().width, h: cell.getBoundingClientRect().height, cls: cell.className } : null;
          return o;
        })()`, true);
        console.log('[smoke] mini-css:', JSON.stringify(miniCss));
      }

      /* 缩小 → 放大：验证轨道位移重新吸附（图标始终居中） */
      mainWindow.setBounds({ width: 960, height: 640 });
      await new Promise((r) => setTimeout(r, 900));
      await shot('desktop-04-small.png');
      mainWindow.setBounds({ width: 1600, height: 900 });
      await new Promise((r) => setTimeout(r, 900));
      await shot('desktop-05-big.png');
      const snap = await mainWindow.webContents.executeJavaScript(`(() => {
        const t = document.getElementById('pager-track');
        const m = new DOMMatrixReadOnly(getComputedStyle(t).transform);
        return { trackX: Math.round(m.m41), wantX: -t.clientWidth, ok: Math.abs(m.m41 + t.clientWidth) < 2 };
      })()`, true);
      console.log('[smoke] track-snap:', JSON.stringify(snap));

      /* 引擎菜单（Infinity 式九宫格） */
      await mainWindow.webContents.executeJavaScript(
        "document.getElementById('engine-btn')?.click(); true", true,
      );
      await new Promise((r) => setTimeout(r, 500));
      const menuDbg = await mainWindow.webContents.executeJavaScript(`(() => {
        const m = document.getElementById('engine-menu');
        if (!m) return { exists: false };
        const r = m.getBoundingClientRect();
        const cs = getComputedStyle(m);
        return { exists: true, cls: m.className, display: cs.display, zIndex: cs.zIndex,
                 rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
                 tiles: m.querySelectorAll('.engine-tile').length };
      })()`, true);
      console.log('[smoke] engine-menu:', JSON.stringify(menuDbg));
      await shot('desktop-06-engine.png');
      await mainWindow.webContents.executeJavaScript(
        "document.getElementById('engine-menu')?.classList.add('hidden'); true", true,
      );

      /* 右上角按钮 → 右侧抽屉「快捷」页（Infinity 同款交互） */
      await mainWindow.webContents.executeJavaScript(
        "document.getElementById('menu-btn')?.click(); true", true,
      );
      await new Promise((r) => setTimeout(r, 700));
      const quickDbg = await mainWindow.webContents.executeJavaScript(`(() => {
        const p = document.getElementById('panel');
        const page = document.querySelector('.panel-page[data-page="quick"]');
        return {
          panelOpen: p?.classList.contains('open'),
          quickActive: page?.classList.contains('active'),
          tiles: document.querySelectorAll('.quick-tile').length,
          bodyOpen: document.body.classList.contains('panel-open'),
        };
      })()`, true);
      console.log('[smoke] quick-drawer:', JSON.stringify(quickDbg));
      await shot('desktop-07-quick.png');
      await mainWindow.webContents.executeJavaScript(
        "document.getElementById('panel-close')?.click(); true", true,
      );
      await new Promise((r) => setTimeout(r, 500));

      const info = await mainWindow.webContents.executeJavaScript(`(() => ({
        booted: !!window.__APP_BOOTED__,
        icons: document.querySelectorAll('#grid .site, #grid .tile, .site-item').length,
        tiles: document.querySelectorAll('.grid-item, .tile').length,
        bodyClass: document.body.className,
        title: document.title,
      }))()`, true);
      console.log('[smoke] page:', JSON.stringify(info));
      console.log('[smoke] errors:', errors.length ? JSON.stringify(errors.slice(0, 12)) : 'none');
      if (!info.booted) errors.push('页面未启动完成（__APP_BOOTED__ 缺失）');
    } catch (e) {
      console.log('[smoke] failed:', e && e.message);
      errors.push(String(e && e.message));
    }
    const code = errors.length ? 1 : 0;
    setTimeout(() => app.exit(code), 300);
  });
}
