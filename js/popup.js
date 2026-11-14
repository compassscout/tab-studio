/* popup.js — 创建标签面板：预填当前网页 → 选图标/文字/字号/颜色 → 确定即收藏进新标签页
 *
 * 交互对齐 Infinity：左键点工具栏图标就在当前网页上弹出这个面板，不跳转页面。
 */
import { initStore, getState, addSite } from './store.js';
import { loadConfig, saveConfig, loadMeta } from './config.js';
import { paintIcon } from './favicon.js';
import { normalizeUrl, hostNameOf, firstChar } from './utils.js';

const $ = (id) => document.getElementById(id);
const COLORS = ['#ef4444', '#f59e0b', '#facc15', '#22c55e', '#06b6d4', '#2f6fed', '#7c3aed', '#f472b6'];

let mode = 'auto';        /* auto | color | upload */
let color = '#4c8bf5';
let iconValue = '';       /* 本地图片 dataURL */
let tabInfo = { title: '', url: '' };

function setMsg(text, kind = '') {
  const el = $('msg');
  el.textContent = text || '';
  el.className = 'msg' + (kind ? ` ${kind}` : '');
}

/* ---------------- 预览 ---------------- */
function siteDraft() {
  const name = ($('f-text').value || $('f-name').value || hostNameOf($('f-url').value)).trim();
  return {
    name,
    url: $('f-url').value.trim(),
    color,
    iconType: mode,
    iconValue,
  };
}

function paintColorPreview() {
  const box = $('pv-color');
  box.style.backgroundImage = 'none';
  box.style.background = color;
  box.textContent = firstChar($('f-text').value || $('f-name').value || '?');
}

function paintUploadPreview() {
  const box = $('pv-upload');
  if (!iconValue) {
    box.style.backgroundImage = 'none';
    box.textContent = '＋';
    box.classList.add('opt-empty');
    return;
  }
  box.classList.remove('opt-empty');
  box.textContent = '';
  box.style.background = color;
  box.style.backgroundImage = `url("${iconValue.replace(/"/g, '%22')}")`;
}

function paintPreviews() {
  const draft = siteDraft();
  const autoBox = $('pv-auto');
  autoBox.textContent = '';
  autoBox.style.backgroundImage = 'none';
  paintIcon(autoBox, { ...draft, iconType: 'auto' }, { size: 52 });
  paintColorPreview();
  paintUploadPreview();
}

/* ---------------- 初始化 ---------------- */
async function readTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = String((tab && tab.url) || '');
  const isSelf = !url || url.startsWith(chrome.runtime.getURL(''));
  const isWeb = /^https?:\/\//i.test(url);
  if (!isWeb || isSelf) {
    setMsg('当前页面无法添加，请切到要收藏的网页再点图标', 'warn');
    $('confirm-btn').disabled = true;
    return;
  }
  tabInfo = { title: String(tab.title || '').trim(), url };
  $('f-name').value = tabInfo.title || hostNameOf(url);
  $('f-url').value = url;
  $('f-text').value = tabInfo.title || hostNameOf(url);
  $('cur-host').textContent = hostNameOf(url);
  paintPreviews();
}

function renderColors() {
  const row = $('color-row');
  row.innerHTML = '';
  COLORS.forEach((c) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch' + (c.toLowerCase() === color.toLowerCase() ? ' active' : '');
    btn.style.background = c;
    btn.style.color = c; /* active 外圈用当前色 */
    btn.title = c;
    btn.addEventListener('click', () => {
      color = c;
      renderColors();
      paintPreviews();
    });
    row.appendChild(btn);
  });
}

function bindModes() {
  document.querySelectorAll('.icon-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      document.querySelectorAll('.icon-opt').forEach((b) => b.classList.toggle('active', b === btn));
      if (mode === 'upload' && !iconValue) $('f-file').click();
      paintPreviews();
    });
  });

  $('f-file').addEventListener('change', () => {
    const file = $('f-file').files && $('f-file').files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { setMsg('图片建议小于 1MB，否则新标签页加载会变慢', 'warn'); }
    const reader = new FileReader();
    reader.onload = () => {
      iconValue = String(reader.result || '');
      paintPreviews();
    };
    reader.onerror = () => setMsg('图片读取失败', 'err');
    reader.readAsDataURL(file);
  });

  ['f-name', 'f-text'].forEach((id) => {
    $(id).addEventListener('input', () => {
      if (id === 'f-name' && !$('f-text').dataset.touched) $('f-text').value = $('f-name').value;
      paintPreviews();
    });
  });
  $('f-text').addEventListener('input', () => { $('f-text').dataset.touched = '1'; });
}

function bindFont() {
  const cfg = loadConfig();
  const slider = $('f-font');
  const out = $('font-val');
  slider.value = String(cfg.fontSize || 13);
  out.textContent = slider.value;
  slider.addEventListener('input', () => { out.textContent = slider.value; });
}

/* ---------------- 确定：写入工作台 ---------------- */
async function confirmAdd() {
  const btn = $('confirm-btn');
  btn.disabled = true;
  setMsg('');
  try {
    const guess = normalizeUrl($('f-url').value || tabInfo.url);
    if (!guess.ok) { setMsg(guess.reason, 'err'); btn.disabled = false; return; }

    await initStore();
    if (getState().sites.some((s) => s.url === guess.url)) {
      setMsg('这个网页已经在工作台里了', 'warn');
      btn.disabled = false;
      return;
    }

    const name = ($('f-text').value || $('f-name').value || hostNameOf(guess.url)).trim().slice(0, 80);
    const meta = loadMeta();
    const pages = getState().pages;
    const pageId = pages.some((p) => p.id === meta.currentPageId) ? meta.currentPageId : pages[0] && pages[0].id;

    const result = await addSite({
      name,
      url: guess.url,
      color,
      iconType: mode,
      iconValue: mode === 'upload' ? iconValue : '',
      pageId,
    });

    const fontSize = Number($('f-font').value);
    if (fontSize !== loadConfig().fontSize) saveConfig({ fontSize });

    setMsg(result.moved ? '已收藏（当前页已满，已顺延到后一页）' : '已收藏到工作台', 'ok');
    setTimeout(() => { try { window.close(); } catch (e) { /* 忽略 */ } }, 700);
  } catch (e) {
    setMsg('添加失败：' + (e && e.message ? e.message : '未知错误'), 'err');
    btn.disabled = false;
  }
}

/* ---------------- 可选权限 ---------------- */
function bindPerm(btnId, perm) {
  const btn = $(btnId);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const ok = await chrome.permissions.request({ permissions: [perm] });
      setMsg(ok ? `${perm === 'bookmarks' ? '书签' : '历史'}权限已开启` : '未获得权限（不影响其他功能）', ok ? 'ok' : 'warn');
    } catch (e) {
      setMsg('权限申请失败', 'err');
    }
    refreshPerm();
  });
}

async function refreshPerm() {
  for (const [id, perm] of [['perm-bookmarks', 'bookmarks'], ['perm-history', 'history']]) {
    const btn = $(id);
    if (!btn) continue;
    let has = false;
    try { has = await chrome.permissions.contains({ permissions: [perm] }); } catch (e) { /* 忽略 */ }
    btn.textContent = has ? '已开启' : '开启';
    btn.classList.toggle('on', has);
    btn.disabled = has;
  }
}

/* ---------------- 启动 ---------------- */
function boot() {
  bindModes();
  bindFont();
  renderColors();
  bindPerm('perm-bookmarks', 'bookmarks');
  bindPerm('perm-history', 'history');
  refreshPerm();

  $('confirm-btn').addEventListener('click', confirmAdd);
  $('cancel-btn').addEventListener('click', () => { try { window.close(); } catch (e) { /* 忽略 */ } });
  $('open-newtab').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html'), active: true });
    window.close();
  });
  $('perm-toggle').addEventListener('click', (e) => {
    e.preventDefault();
    const box = $('perm-box');
    box.hidden = !box.hidden;
  });

  readTab().catch(() => {
    setMsg('读取当前页面失败', 'err');
    $('confirm-btn').disabled = true;
  });
}

boot();
