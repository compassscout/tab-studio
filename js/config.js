/* config.js — 配置默认值、读写、映射到 CSS 变量 / body 类 */
export const CONFIG_KEY = 'compass_config_v1';
export const META_KEY = 'compass_meta_v1';

import { db, SETTINGS_STORE } from './db.js';

/* 外观设置镜像：localStorage 仍是主存储，IndexedDB 仅在清理浏览数据后兜底 */
const MIRROR_ID = 'config';
function mirrorSettings(cfg) {
  try {
    db.put(SETTINGS_STORE, { id: MIRROR_ID, value: cfg, ts: Date.now() }).catch(() => {});
  } catch (e) { /* 忽略 */ }
}

/** 启动时若 localStorage 中没有配置（被清理过），用镜像恢复 */
export async function restoreConfigMirror() {
  let raw = null;
  try { raw = localStorage.getItem(CONFIG_KEY); } catch (e) { raw = null; }
  if (raw) return false;
  try {
    const rec = await db.get(SETTINGS_STORE, MIRROR_ID);
    if (!rec || !rec.value) return false;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(rec.value));
    cache = null;
    return true;
  } catch (e) {
    return false;
  }
}

/** 布局：行 × 列（与原版一致，标签 3×6 表示 3 行 6 列） */
export const LAYOUTS = [
  { id: '2x4', rows: 2, cols: 4, label: '2×4' },
  { id: '2x5', rows: 2, cols: 5, label: '2×5' },
  { id: '2x6', rows: 2, cols: 6, label: '2×6' },
  { id: '2x7', rows: 2, cols: 7, label: '2×7' },
  { id: '3x3', rows: 3, cols: 3, label: '3×3' },
  { id: '3x6', rows: 3, cols: 6, label: '3×6' },
];

export const DEFAULT_CONFIG = {
  /* 壁纸 */
  wallMask: 40,
  wallBlur: 0,
  wallAuto: false,
  wallInterval: '1h',
  wallFavoriteOnly: false,
  /* 打开方式 */
  openSiteNewTab: false,
  openSearchNewTab: true,
  openBookmarkNewTab: false,
  openHistoryNewTab: false,
  /* 视图 */
  showWindmill: true,
  showPageArrows: true,
  showWidgets: true,
  topBookmarks: false,
  /* macOS Dock */
  showDock: true,
  dockMagnify: true,
  dockSize: 48,
  dockScale: 1,
  dockOffset: 18,
  dockAlign: 'center',
  dockIds: null,
  /* 布局 */
  layoutId: '3x6',
  /* 图标 */
  iconRadius: 50,
  iconOpacity: 1,
  iconScale: 1,
  gridOffset: 0,
  hideIconName: false,
  iconShadow: false,
  startAnimation: false,
  sortByFrequency: false,
  /* 搜索 */
  searchEngine: 'baidu',
  searchCategory: 'web',
  customEngines: [],
  hideSearch: false,
  searchSuggest: true,
  keepSearchInput: false,
  hideSearchCategory: false,
  hideSearchButton: true,
  searchScale: 1,
  searchRadius: 28,
  searchOpacity: 1,
  /* 字体 */
  fontShadow: true,
  fontSize: 13,
  fontColor: 'rgb(221, 221, 221)',
  /* 其他 */
  animType: 'default',
  minimal: false,
  network: true,
};

let cache = null;

export function loadConfig() {
  if (cache) return cache;
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') || {}; } catch (e) { stored = {}; }
  cache = Object.assign({}, DEFAULT_CONFIG, stored);
  /* 一次性迁移：左右翻页按钮改为默认开启 */
  if (!stored._cfgVer || stored._cfgVer < 2) {
    cache.showPageArrows = true;
    cache._cfgVer = 2;
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cache)); } catch (e) { /* 忽略配额异常 */ }
  }
  return cache;
}

/** 其他标签页改了配置（storage 事件）时，丢弃本页缓存并重新读取 */
export function reloadConfig() {
  cache = null;
  return loadConfig();
}

export function saveConfig(patch, { silent = false } = {}) {
  cache = Object.assign({}, loadConfig(), patch);
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cache)); } catch (e) { /* 忽略配额异常 */ }
  mirrorSettings(cache);
  applyConfig(cache);
  if (!silent) document.dispatchEvent(new CustomEvent('configchange', { detail: patch }));
  return cache;
}

export function resetConfig() {
  cache = Object.assign({}, DEFAULT_CONFIG);
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cache)); } catch (e) { /* ignore */ }
  mirrorSettings(cache);
  applyConfig(cache);
  document.dispatchEvent(new CustomEvent('configchange', { detail: cache }));
  return cache;
}

export function loadMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; }
  catch (e) { return {}; }
}
export function saveMeta(patch) {
  const meta = Object.assign({}, loadMeta(), patch);
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* ignore */ }
  return meta;
}

export function currentLayout(cfg = loadConfig()) {
  return LAYOUTS.find((l) => l.id === cfg.layoutId) || LAYOUTS[LAYOUTS.length - 1];
}

/** 配置 → CSS 变量 / body 类 / 直接控制少量 DOM */
export function applyConfig(cfg = loadConfig()) {
  const root = document.documentElement.style;
  const set = (k, v) => root.setProperty(k, v);

  set('--icon-radius', cfg.iconRadius + '%');
  set('--icon-opacity', String(cfg.iconOpacity));
  set('--icon-scale', String(cfg.iconScale));
  set('--grid-offset', (cfg.gridOffset ?? 0) + 'px');
  set('--icon-font-size', cfg.fontSize + 'px');
  set('--icon-font-color', cfg.fontColor);
  set('--icon-text-shadow', cfg.fontShadow ? '0 1px 3px rgba(0, 0, 0, 0.45)' : 'none');
  set('--search-scale', String(cfg.searchScale));
  set('--search-radius', cfg.searchRadius + 'px');
  set('--search-opacity', String(cfg.searchOpacity));
  set('--mask-alpha', String(cfg.wallMask / 100));
  set('--wallpaper-blur', cfg.wallBlur + 'px');
  set('--ui-scale', '1');
  set('--dock-size', cfg.dockSize + 'px');
  set('--dock-scale', String(cfg.dockScale ?? 1));
  set('--dock-bottom', (cfg.dockOffset ?? 18) + 'px');

  const layout = currentLayout(cfg);
  set('--rows', String(layout.rows));
  set('--cols', String(layout.cols));

  const body = document.body;
  if (body) {
    body.classList.toggle('hide-label', !!cfg.hideIconName);
    body.classList.toggle('no-anim', !cfg.startAnimation);
    body.classList.toggle('anim-fade', cfg.animType === 'fade');
    body.classList.toggle('anim-bounce', cfg.animType === 'bounce');
    body.classList.toggle('minimal-mode', !!cfg.minimal);
    body.classList.toggle('dock-on', !!cfg.showDock);
    body.classList.toggle('dock-no-magnify', !cfg.dockMagnify);
    body.classList.toggle('dock-align-left', cfg.dockAlign === 'left');
    body.classList.toggle('dock-align-right', cfg.dockAlign === 'right');
  }

  const hide = (el, cond) => { if (el) el.classList.toggle('hidden', !!cond); };
  hide(document.getElementById('search-cats'), cfg.hideSearchCategory);
  hide(document.getElementById('search-wrap'), cfg.hideSearch);
  hide(document.getElementById('windmill'), !cfg.showWindmill);
  hide(document.getElementById('dock'), !cfg.showDock);
  document.getElementById('page-prev')?.classList.toggle('visible', !!cfg.showPageArrows);
  document.getElementById('page-next')?.classList.toggle('visible', !!cfg.showPageArrows);
  const submit = document.getElementById('search-submit');
  if (submit) submit.classList.toggle('visible', !cfg.hideSearchButton);
}

export function configSummary(cfg = loadConfig()) {
  return {
    mask: cfg.wallMask, blur: cfg.wallBlur,
    layout: cfg.layoutId, radius: cfg.iconRadius,
  };
}
