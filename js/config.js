/* config.js — AppConfig 默认值 + localStorage 读写 + 运行期 CSS 变量覆盖 */
/* localStorage 键：infinity_config_v1（配置） / infinity_meta_v1（元信息） */

export const CONFIG_KEY = 'infinity_config_v1';
export const META_KEY = 'infinity_meta_v1';

/** 全部设置项默认值（与基线规范第 8 节冻结清单一致） */
export const DEFAULT_CONFIG = {
  wallpaperMaskAlpha: 15,
  wallpaperBlur: 18,
  wallpaperFavoriteOnly: true,
  wallpaperAutoRotate: false,
  wallpaperRotateInterval: '12h',
  searchEngine: 'baidu',
  searchCategory: 'web',
  openSiteNewTab: true,
  openSearchNewTab: true,
  openBookmarkNewTab: true,
  openHistoryNewTab: true,
  gmailNotify: false,
  ringtone: false,
  gmailBadge: false,
  todoBadge: false,
  screenScale: 1.0,
  sidebarScale: 1.0,
  showWindmill: true,
  showTopSites: false,
  showTopBookmarks: false,
  showPageButtons: false,
  hideAiIcon: true,
  layoutId: '2x5',
  hideIconName: false,
  iconShadow: true,
  startAnimation: true,
  iconRadius: 10,
  iconOpacity: 1,
  iconSize: 64,
  hideSearch: false,
  showSuggestions: false,
  keepSearchContent: false,
  hideSearchCategory: true,
  hideSearchButton: false,
  searchSize: 1,
  searchRadius: 8,
  searchOpacity: 1,
  fontShadow: false,
  fontSize: 13,
  fontColor: '#ffffff',
  animType: 'default',
  settingsMinimal: false,
};

export const LAYOUTS = {
  '2x4': { cols: 2, rows: 4, label: '2×4' },
  '2x5': { cols: 2, rows: 5, label: '2×5' },
  '2x6': { cols: 2, rows: 6, label: '2×6' },
  '2x7': { cols: 2, rows: 7, label: '2×7' },
  '3x3': { cols: 3, rows: 3, label: '3×3' },
  'custom36': { cols: 3, rows: 6, label: '自定义 3×6' },
};

let cache = null;

export function loadConfig() {
  if (cache) return cache;
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') || {}; } catch (e) { stored = {}; }
  cache = Object.assign({}, DEFAULT_CONFIG, stored);
  return cache;
}

export function saveConfig(patch) {
  cache = Object.assign({}, loadConfig(), patch);
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cache)); } catch (e) {}
  applyConfigToDom(cache);
  return cache;
}

export function resetStyleConfig() {
  const styleKeys = Object.keys(DEFAULT_CONFIG).filter((k) => k !== 'settingsMinimal');
  const patch = {};
  styleKeys.forEach((k) => { patch[k] = DEFAULT_CONFIG[k]; });
  return saveConfig(patch);
}

export function loadMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; }
  catch (e) { return {}; }
}
export function saveMeta(patch) {
  const meta = Object.assign({}, loadMeta(), patch);
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {}
  return meta;
}

export function applyConfigToDom(cfg) {
  const root = document.documentElement.style;
  const s = (k, v) => root.setProperty(k, v);
  s('--mask-alpha', (cfg.wallpaperMaskAlpha / 100).toFixed(3));
  s('--wallpaper-blur', cfg.wallpaperBlur + 'px');
  s('--icon-radius', cfg.iconRadius + 'px');
  s('--icon-opacity', String(cfg.iconOpacity));
  s('--icon-size', cfg.iconSize + 'px');
  s('--icon-font-size', cfg.fontSize + 'px');
  s('--icon-font-color', cfg.fontColor);
  s('--search-radius', cfg.searchRadius + 'px');
  s('--search-opacity', String(cfg.searchOpacity));
  s('--search-scale', String(cfg.searchSize));
  s('--body-zoom', String(cfg.screenScale));
  s('--sidebar-scale', String(cfg.sidebarScale));
  const layout = LAYOUTS[cfg.layoutId] || LAYOUTS['2x5'];
  s('--grid-cols', String(layout.cols));
  s('--grid-rows', String(layout.rows));

  document.body.classList.toggle('name-hidden', !!cfg.hideIconName);
  document.body.classList.toggle('icon-shadow-on', !!cfg.iconShadow);
  document.body.classList.toggle('font-shadow-on', !!cfg.fontShadow);
  document.body.classList.toggle('anim-bounce', cfg.animType === 'bounce');
  document.body.classList.toggle('anim-fade', cfg.animType === 'fade');
  document.body.classList.toggle('minimal-mode', !!cfg.settingsMinimal);

  const homeSearch = document.getElementById('home-search-wrap');
  if (homeSearch) homeSearch.style.display = cfg.hideSearch ? 'none' : '';
  const windmill = document.getElementById('windmill-btn');
  if (windmill) windmill.style.display = cfg.showWindmill ? '' : 'none';
  const searchBtn = document.getElementById('search-btn');
  if (searchBtn) searchBtn.style.display = cfg.hideSearchButton ? 'none' : '';
  const prev = document.getElementById('page-prev');
  const next = document.getElementById('page-next');
  if (prev && next) {
    prev.style.display = cfg.showPageButtons ? 'flex' : 'none';
    next.style.display = cfg.showPageButtons ? 'flex' : 'none';
  }
}
