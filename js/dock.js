/* dock.js — macOS 风格底部 Dock：拖入固定 / 拖出移除 / 排序 / 悬停放大 */
import { getSite, getFolder, getState } from './store.js';
import { WIDGETS } from './render.js';
import { loadConfig, saveConfig } from './config.js';
import { paintIcon, chromeFaviconUrl } from './favicon.js';
import { openUrl, toast, firstChar } from './utils.js';

let dragPayload = null;
let dropHandled = false;

/* 默认 Dock：小组件常驻，后面接常用站点（只补一次，之后完全以用户排序为准） */
const DEFAULT_WIDGET_IDS = ['widget-settings', 'widget-folder', 'widget-todo', 'widget-weather', 'widget-note', 'widget-walls'];

function seedDock() {
  const cfg = config();
  if (cfg.dockSeedV2) return;
  const current = Array.isArray(cfg.dockIds)
    ? cfg.dockIds
    : getState().sites.slice(0, 4).map((s) => s.id);
  const merged = [];
  DEFAULT_WIDGET_IDS.forEach((id) => { if (!merged.includes(id) && widgetOf(id)) merged.push(id); });
  current.forEach((id) => { if (!merged.includes(id)) merged.push(id); });
  saveConfig({ dockIds: merged.slice(0, 20), dockSeedV2: true }, { silent: true });
}

function widgetOf(id) { return WIDGETS.find((w) => 'widget-' + w.key === id) || null; }

function config() { return loadConfig(); }
function ids() {
  const list = config().dockIds;
  return Array.isArray(list) ? list : [];
}
function has(id) { return ids().includes(id); }

/* 图标数量多或窗口变窄时等比缩小图标，保证 Dock 单行完整显示（只影响 Dock 自身） */
function fitDock() {
  const n = Math.max(ids().length, 1);
  const base = config().dockSize;
  const scale = Math.max(0.7, Math.min(1.5, config().dockScale || 1));
  const gap = 8;
  const chrome = 48 + 26; /* 视口左右留白 + Dock 内边距 */
  /* 按整体缩放折算可用宽度，避免缩放后整条 Dock 超出视口 */
  const fit = Math.floor(((window.innerWidth - chrome) / scale - gap * (n - 1)) / n);
  const size = Math.max(28, Math.min(base, fit));
  document.documentElement.style.setProperty('--dock-i', size + 'px');
}

function setIds(next) {
  saveConfig({ dockIds: next });
  renderDock();
}

export function pinToDock(id) {
  if (!getSite(id) && !getFolder(id) && !widgetOf(id)) return;
  if (has(id)) { toast('已经在 Dock 里了'); return; }
  setIds([...ids(), id].slice(0, 20));
  toast('已固定到 Dock');
}

export function unpinFromDock(id) {
  if (!has(id)) return;
  setIds(ids().filter((x) => x !== id));
  toast('已从 Dock 移除');
}

function folderIcon(folder, size) {
  const el = document.createElement('span');
  el.className = 'dock-folder';
  const members = folder.iconIds.map(getSite).filter(Boolean).slice(0, 4);
  if (!members.length) {
    el.innerHTML = '<svg><use href="#i-folder"/></svg>';
    return el;
  }
  members.forEach((site) => {
    const mini = document.createElement('span');
    mini.className = 'dock-mini';
    mini.style.background = site.color || '#eef0f4';
    if (site.iconType === 'upload' && site.iconValue) {
      mini.style.backgroundImage = `url("${site.iconValue.replace(/"/g, '%22')}")`;
      mini.style.backgroundSize = 'cover';
    } else if (site.iconType === 'color') {
      mini.textContent = firstChar(site.name);
    } else {
      const src = chromeFaviconUrl(site.url, 32);
      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.addEventListener('error', () => { img.remove(); mini.textContent = firstChar(site.name); }, { once: true });
        mini.appendChild(img);
      } else {
        mini.textContent = firstChar(site.name);
      }
    }
    el.appendChild(mini);
  });
  return el;
}

function dockItem(id) {
  const site = getSite(id);
  const folder = getFolder(id);
  const widget = widgetOf(id);
  if (!site && !folder && !widget) return null;
  const el = document.createElement('button');
  el.className = 'dock-item';
  el.dataset.id = id;
  el.draggable = true;
  el.title = '';

  const icon = document.createElement('span');
  icon.className = 'dock-icon';
  if (site) {
    icon.classList.add('site');
    paintIcon(icon, site, { size: 64 });
  } else if (folder) {
    icon.classList.add('folder');
    icon.appendChild(folderIcon(folder, 42));
  } else {
    icon.classList.add('widget', 'widget-' + widget.key);
    icon.innerHTML = `<svg><use href="#${widget.icon}"/></svg>`;
  }
  const label = document.createElement('span');
  label.className = 'dock-label';
  label.textContent = site ? site.name : folder ? folder.name : widget.label;
  el.appendChild(icon);
  el.appendChild(label);

  el.addEventListener('click', (e) => {
    const cfg = loadConfig();
    if (site) openUrl(site.url, { newTab: cfg.openSiteNewTab || e.ctrlKey || e.metaKey });
    else if (folder) window.app?.openFolder?.(folder.id);
    else {
      const action = {
        weather: 'openWeather', todo: 'openTodo', note: 'openNote',
        folder: 'openFolders', settings: 'openSettings', walls: 'openWallpaperLibrary',
      }[widget.key];
      window.app?.[action]?.();
    }
  });
  /* 中键在新标签页打开 */
  el.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
  el.addEventListener('auxclick', (e) => {
    if (e.button !== 1 || !site) return;
    e.preventDefault();
    openUrl(site.url, { newTab: true });
  });
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.app?.openDockMenu?.(e, id);
  });

  el.addEventListener('dragstart', (e) => {
    dragPayload = 'dock:' + id;
    window.__compassDrag = dragPayload;
    dropHandled = false;
    e.dataTransfer.setData('text/plain', dragPayload);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    document.querySelectorAll('#dock .dock-item').forEach((x) => x.classList.remove('drop-before', 'drop-after'));
    dragPayload = null;
    window.__compassDrag = '';
  });

  return el;
}

export function renderDock() {
  const dock = document.getElementById('dock');
  if (!dock) return;
  const cfg = config();
  fitDock();
  if (!cfg.showDock) {
    dock.classList.add('hidden');
    document.body.classList.remove('has-dock');
    return;
  }
  dock.classList.remove('hidden');
  document.body.classList.add('has-dock');
  const list = ids();
  dock.innerHTML = '';
  if (!list.length) {
    const tip = document.createElement('span');
    tip.className = 'dock-empty';
    tip.textContent = '把图标拖到这里固定';
    dock.appendChild(tip);
    return;
  }
  list.forEach((id) => {
    const item = dockItem(id);
    if (item) dock.appendChild(item);
    else saveConfig({ dockIds: ids().filter((x) => x !== id) }, { silent: true });
  });
}

function ensureDragPayload(e) {
  if (dragPayload) return dragPayload;
  if (window.__compassDrag) return window.__compassDrag;
  try { return e.dataTransfer.getData('text/plain') || ''; } catch (err) { return ''; }
}

export function initDock() {
  const dock = document.getElementById('dock');
  if (!dock) return;

  document.addEventListener('dragstart', (e) => {
    const raw = e.dataTransfer?.getData('text/plain') || '';
    if (raw) dragPayload = raw;
  }, true);

  dock.addEventListener('dragover', (e) => {
    const raw = ensureDragPayload(e);
    if (!raw.startsWith('item:') && !raw.startsWith('dock:')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dock.classList.add('dock-drop');
    const target = e.target.closest('.dock-item');
    document.querySelectorAll('#dock .dock-item').forEach((x) => x.classList.remove('drop-before', 'drop-after'));
    if (target && raw.startsWith('dock:')) {
      const rect = target.getBoundingClientRect();
      target.classList.add(e.clientX < rect.left + rect.width / 2 ? 'drop-before' : 'drop-after');
    }
  });
  dock.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget || !dock.contains(e.relatedTarget)) {
      dock.classList.remove('dock-drop');
      document.querySelectorAll('#dock .dock-item').forEach((x) => x.classList.remove('drop-before', 'drop-after'));
    }
  });

  dock.addEventListener('drop', (e) => {
    e.preventDefault();
    dropHandled = true;
    dock.classList.remove('dock-drop');
    document.querySelectorAll('#dock .dock-item').forEach((x) => x.classList.remove('drop-before', 'drop-after'));
    const raw = ensureDragPayload(e);
    if (raw.startsWith('item:')) {
      pinToDock(raw.slice(5));
      return;
    }
    if (!raw.startsWith('dock:')) return;
    const srcId = raw.slice(5);
    const target = e.target.closest('.dock-item');
    const next = ids().filter((x) => x !== srcId);
    if (!target) { next.push(srcId); setIds(next); return; }
    const targetId = target.dataset.id;
    let index = next.indexOf(targetId);
    if (index < 0) index = next.length;
    else {
      const rect = target.getBoundingClientRect();
      if (e.clientX >= rect.left + rect.width / 2) index += 1;
    }
    next.splice(index, 0, srcId);
    setIds(next);
  });

  /* 网格里的图标拖到 Dock 也能固定；拖拽结束清理 */
  document.addEventListener('dragend', () => {
    dock.classList.remove('dock-drop');
    setTimeout(() => { dragPayload = null; dropHandled = false; }, 0);
  });

  document.addEventListener('app-render', renderDock);
  document.addEventListener('configchange', (e) => {
    const d = e.detail || {};
    if ('showDock' in d || 'dockIds' in d) renderDock();
    if ('dockSize' in d || 'dockScale' in d) fitDock();
  });
  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(fitDock);
  });

  /* 首次/升级：把小组件写进 Dock 默认项目，站点按原来的顺序跟在后面 */
  seedDock();
  renderDock();
}

/* 供右键菜单使用 */
export function dockMenu(e, id) {
  const menu = document.getElementById('ctx-menu');
  if (!menu) return;
  menu.innerHTML = '';
  const site = getSite(id);
  const folder = getFolder(id);
  const widget = widgetOf(id);
  const add = (label, fn, danger = false) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (danger) b.classList.add('danger');
    b.addEventListener('click', () => { menu.classList.add('hidden'); menu.innerHTML = ''; fn(); });
    menu.appendChild(b);
  };
  add('打开', () => {
    if (site) openUrl(site.url, { newTab: loadConfig().openSiteNewTab });
    else if (folder) window.app?.openFolder?.(folder.id);
    else {
      const action = {
        weather: 'openWeather', todo: 'openTodo', note: 'openNote',
        folder: 'openFolders', settings: 'openSettings', walls: 'openWallpaperLibrary',
      }[widget?.key];
      window.app?.[action]?.();
    }
  });
  if (site) add('编辑', () => window.app?.openSiteEditor?.(id));
  else if (folder) add('编辑', () => window.app?.openFolder?.(folder.id));
  const sep = document.createElement('div');
  sep.className = 'pop-sep';
  menu.appendChild(sep);
  add('从 Dock 移除', () => unpinFromDock(id), true);
  menu.classList.remove('hidden');
  menu.style.left = '0px'; menu.style.top = '0px';
  const rect = menu.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(e.clientX, window.innerWidth - rect.width - 8)) + 'px';
  menu.style.top = Math.max(8, e.clientY - rect.height - 10) + 'px';
}
