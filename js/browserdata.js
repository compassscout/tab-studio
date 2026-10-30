/* browserdata.js — 历史记录 / 书签（可选权限，按需申请） */
import { loadConfig } from './config.js';
import { openModal } from './dialog.js';
import { openUrl, escapeHtml, toast } from './utils.js';
import { paintIcon } from './favicon.js';

let mode = 'history';
let keyword = '';
let items = [];
let pendingPerm = 'history';

function api(name) {
  return typeof chrome !== 'undefined' && chrome[name] ? chrome[name] : null;
}

async function hasPermission(perm) {
  if (typeof chrome === 'undefined' || !chrome.permissions) return false;
  try { return await chrome.permissions.contains({ permissions: [perm] }); }
  catch (e) { return false; }
}

async function requestPermission(perm) {
  if (typeof chrome === 'undefined' || !chrome.permissions) return false;
  try { return await chrome.permissions.request({ permissions: [perm] }); }
  catch (e) { return false; }
}

function setHeader(title) {
  const el = document.getElementById('bd-title');
  if (el) el.textContent = title;
}

function showGrant(perm) {
  pendingPerm = perm;
  const btn = document.getElementById('bd-grant');
  if (btn) btn.classList.remove('hidden');
  const body = document.getElementById('bd-body');
  if (!body) return;
  body.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'bd-perm';
  box.innerHTML = `
    <div class="bd-perm-icon"><svg><use href="#i-globe"/></svg></div>
    <h4>需要一次授权</h4>
    <p>${perm === 'history'
      ? '读取浏览历史用于「历史记录」面板，数据只在本机显示，不会上传。'
      : '读取书签用于「书签」面板，数据只在本机显示，不会上传。'}</p>
    <p class="muted small">授权后随时可在 Chrome 扩展详情页撤销。</p>
    <button class="btn primary" id="bd-perm-btn">允许读取${perm === 'history' ? '历史记录' : '书签'}</button>`;
  body.appendChild(box);
  box.querySelector('#bd-perm-btn').addEventListener('click', async () => {
    const ok = await requestPermission(perm);
    if (!ok) { toast('未获得授权'); return; }
    const g = document.getElementById('bd-grant');
    if (g) g.classList.add('hidden');
    await load();
  });
}

function groupLabel(ts) {
  const d = new Date(ts);
  const now = new Date();
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day0 - t0) / 86400000);
  if (diff <= 0) return '今天';
  if (diff === 1) return '昨天';
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

function timeText(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function loadHistory() {
  const history = api('history');
  if (!history) { showGrant('history'); return; }
  const list = await new Promise((resolve) => {
    history.search({ text: '', maxResults: 300, startTime: Date.now() - 30 * 86400000 }, (res) => resolve(res || []));
  });
  items = list.filter((x) => /^https?:\/\//i.test(x.url || ''))
    .map((x) => ({ url: x.url, title: x.title || x.url, ts: x.lastVisitTime, count: x.visitCount }));
}

async function loadBookmarks() {
  const bookmarks = api('bookmarks');
  if (!bookmarks) { showGrant('bookmarks'); return; }
  const tree = await new Promise((resolve) => { bookmarks.getTree((res) => resolve(res || [])); });
  const list = [];
  const walk = (nodes, path) => {
    nodes.forEach((node) => {
      if (node.url && /^https?:\/\//i.test(node.url)) {
        list.push({ url: node.url, title: node.title || node.url, path: path.join(' / ') });
      }
      if (node.children) walk(node.children, node.url ? path : [...path, node.title].filter(Boolean));
    });
  };
  walk(tree, []);
  items = list;
}

function filtered() {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return items;
  return items.filter((x) => (x.title || '').toLowerCase().includes(kw) || (x.url || '').toLowerCase().includes(kw));
}

function row(item) {
  const el = document.createElement('div');
  el.className = 'bd-row';
  const icon = document.createElement('span');
  icon.className = 'bd-icon';
  paintIcon(icon, { name: item.title, url: item.url, color: '#8a90a0', iconType: 'auto' }, { size: 32 });
  const text = document.createElement('div');
  text.className = 'bd-text';
  const title = document.createElement('b');
  title.textContent = item.title;
  const meta = document.createElement('span');
  meta.textContent = mode === 'history' ? item.url : (item.path ? `${item.path} · ${item.url}` : item.url);
  text.appendChild(title); text.appendChild(meta);
  const right = document.createElement('span');
  right.className = 'bd-right';
  right.textContent = mode === 'history' ? timeText(item.ts) : '';
  el.appendChild(icon); el.appendChild(text); el.appendChild(right);
  el.title = item.url;
  el.addEventListener('click', () => {
    const cfg = loadConfig();
    openUrl(item.url, { newTab: mode === 'history' ? cfg.openHistoryNewTab : cfg.openBookmarkNewTab });
  });
  return el;
}

function render() {
  const body = document.getElementById('bd-body');
  if (!body) return;
  body.innerHTML = '';
  const list = filtered();
  if (!list.length) {
    body.innerHTML = `<div class="bd-empty">${keyword ? '没有匹配的结果' : (mode === 'history' ? '最近 30 天没有浏览记录' : '还没有书签')}</div>`;
    return;
  }
  if (mode === 'history') {
    let lastGroup = '';
    list.forEach((item) => {
      const label = groupLabel(item.ts);
      if (label !== lastGroup) {
        lastGroup = label;
        const h = document.createElement('div');
        h.className = 'bd-group';
        h.textContent = label;
        body.appendChild(h);
      }
      body.appendChild(row(item));
    });
  } else {
    list.slice(0, 400).forEach((item) => body.appendChild(row(item)));
  }
}

async function load() {
  const body = document.getElementById('bd-body');
  if (body) body.innerHTML = '<div class="bd-loading">正在读取…</div>';
  try {
    if (mode === 'history') await loadHistory(); else await loadBookmarks();
    render();
  } catch (e) {
    if (body) body.innerHTML = '<div class="bd-empty">读取失败，请检查权限</div>';
  }
}

async function open(target) {
  mode = target;
  keyword = '';
  items = [];
  setHeader(target === 'history' ? '历史记录' : '书签');
  const search = document.getElementById('bd-search');
  if (search) search.value = '';
  const grant = document.getElementById('bd-grant');
  if (grant) grant.classList.add('hidden');
  openModal('browser-modal');
  const perm = target === 'history' ? 'history' : 'bookmarks';
  if (!api(target)) { showGrant(perm); return; }
  const ok = await hasPermission(perm);
  if (!ok) { showGrant(perm); return; }
  await load();
}

export function openHistory() { return open('history'); }
export function openBookmarks() { return open('bookmarks'); }

export function initBrowserData() {
  document.getElementById('bd-search')?.addEventListener('input', (e) => {
    keyword = e.target.value;
    render();
  });
  document.getElementById('bd-grant')?.addEventListener('click', async () => {
    const ok = await requestPermission(pendingPerm);
    if (!ok) { toast('未获得授权'); return; }
    document.getElementById('bd-grant')?.classList.add('hidden');
    await load();
  });
}
