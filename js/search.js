/* search.js — 搜索引擎 / 类别 / 搜索建议 / 回车搜索 */
import { loadConfig, saveConfig, loadMeta, saveMeta } from './config.js';
import { openUrl, debounce, escapeHtml } from './utils.js';
import { getState } from './store.js';

export const ENGINES = {
  baidu: {
    name: '百度', letter: '百', color: '#2932e1',
    urls: {
      web: 'https://www.baidu.com/s?wd=',
      image: 'https://image.baidu.com/search/index?tn=baiduimage&word=',
      news: 'https://www.baidu.com/s?tn=news&wd=',
      video: 'https://www.baidu.com/sf/vsearch?wd=',
      map: 'https://map.baidu.com/search/',
    },
  },
  google: {
    name: 'Google', letter: 'G', color: '#4285f4',
    urls: {
      web: 'https://www.google.com/search?q=',
      image: 'https://www.google.com/search?tbm=isch&q=',
      news: 'https://www.google.com/search?tbm=nws&q=',
      video: 'https://www.google.com/search?tbm=vid&q=',
      map: 'https://www.google.com/maps?q=',
    },
  },
  bing: {
    name: '必应', letter: 'b', color: '#008373',
    urls: {
      web: 'https://www.bing.com/search?q=',
      image: 'https://www.bing.com/images/search?q=',
      news: 'https://www.bing.com/news/search?q=',
      video: 'https://www.bing.com/videos/search?q=',
      map: 'https://www.bing.com/maps?q=',
    },
  },
  yahoo: {
    name: 'Yahoo', letter: 'Y', color: '#6001d2',
    urls: {
      web: 'https://search.yahoo.com/search?p=',
      image: 'https://image.search.yahoo.com/search?p=',
      news: 'https://news.search.yahoo.com/search?p=',
      video: 'https://video.search.yahoo.com/search?p=',
      map: 'https://maps.yahoo.com/?p=',
    },
  },
};

export const CATEGORIES = [
  { id: 'web', label: '网页' },
  { id: 'image', label: '图片' },
  { id: 'news', label: '新闻' },
  { id: 'video', label: '视频' },
  { id: 'map', label: '地图' },
];

/** 内置 + 用户自定义引擎 */
export function allEngines() {
  const map = { ...ENGINES };
  const custom = loadConfig().customEngines || [];
  custom.forEach((item) => {
    if (!item || !item.template) return;
    map[item.id] = {
      name: item.name || '自定义',
      letter: item.letter || (item.name || '自').slice(0, 1),
      color: item.color || '#2d6bfe',
      custom: true,
      urls: {
        web: item.template,
        image: item.template,
        news: item.template,
        video: item.template,
        map: item.template,
      },
    };
  });
  return map;
}

let suggestItems = [];
let suggestIndex = -1;
let suggestLocal = false;
let suggestTimer = null;

function engineMenu() {
  const cfg = loadConfig();
  let menu = document.getElementById('engine-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'engine-menu';
    menu.className = 'popover hidden';
    document.body.appendChild(menu);
  }
  menu.innerHTML = '';
  Object.entries(allEngines()).forEach(([id, engine]) => {
    const btn = document.createElement('button');
    btn.dataset.engine = id;
    btn.innerHTML = `<span class="engine-dot" style="background:${engine.color}">${escapeHtml(engine.letter)}</span><span>${escapeHtml(engine.name)}</span>`;
    if (id === cfg.searchEngine) btn.style.background = 'var(--c-panel-soft)';
    btn.addEventListener('click', () => {
      saveConfig({ searchEngine: id });
      menu.classList.add('hidden');
      syncEngine();
      document.getElementById('search-input')?.focus();
    });
    menu.appendChild(btn);
  });
  return menu;
}

function syncEngine() {
  const cfg = loadConfig();
  const engine = allEngines()[cfg.searchEngine] || ENGINES.baidu;
  const logo = document.getElementById('engine-logo');
  if (logo) {
    logo.textContent = engine.letter;
    logo.style.background = engine.color;
  }
}

function renderCategories() {
  const wrap = document.getElementById('search-cats');
  if (!wrap) return;
  const cfg = loadConfig();
  wrap.innerHTML = '';
  CATEGORIES.forEach((cat) => {
    const btn = document.createElement('button');
    btn.textContent = cat.label;
    btn.className = cfg.searchCategory === cat.id ? 'active' : '';
    btn.addEventListener('click', () => {
      saveConfig({ searchCategory: cat.id });
      renderCategories();
      document.getElementById('search-input')?.focus();
    });
    wrap.appendChild(btn);
  });
}

export function doSearch(query) {
  const q = String(query || '').trim();
  if (!q) return;
  const cfg = loadConfig();
  const engine = allEngines()[cfg.searchEngine] || ENGINES.baidu;
  const base = engine.urls[cfg.searchCategory] || engine.urls.web;
  const encoded = encodeURIComponent(q);
  /* 自定义引擎允许 %s 出现在地址中间，不能一律拼在末尾 */
  const url = base.includes('%s') ? base.replace('%s', encoded) : base + encoded;
  openUrl(url, { newTab: cfg.openSearchNewTab });
  if (!cfg.keepSearchInput) {
    const input = document.getElementById('search-input');
    if (input) { input.value = ''; syncClear(); }
    hideSuggest();
    saveMeta({ searchText: '' });
  }
}

function syncClear() {
  const input = document.getElementById('search-input');
  document.getElementById('search-clear')?.classList.toggle('visible', !!(input && input.value));
}

function hideSuggest() {
  const list = document.getElementById('suggest-list');
  if (list) list.classList.add('hidden');
  suggestItems = [];
  suggestIndex = -1;
  suggestLocal = false;
}

function renderSuggest() {
  const list = document.getElementById('suggest-list');
  if (!list) return;
  if (!suggestItems.length && !suggestLocal) { list.classList.add('hidden'); return; }
  list.innerHTML = '';
  suggestItems.forEach((text, i) => {
    const btn = document.createElement('button');
    btn.innerHTML = `<svg class="s-ico"><use href="#i-search"/></svg><span class="s-text">${escapeHtml(text)}</span>`;
    if (i === suggestIndex) btn.classList.add('active');
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      doSearch(text);
    });
    list.appendChild(btn);
  });
  if (suggestLocal) {
    const hint = document.createElement('div');
    hint.className = 'suggest-hint';
    hint.textContent = suggestItems.length
      ? '在线建议不可用，以上为已收藏站点的匹配'
      : '在线建议暂不可用，按回车直接搜索';
    list.appendChild(hint);
  }
  list.classList.remove('hidden');
}

/** 在线建议不可用时的本地兜底：匹配已收藏站点的名称与网址 */
function localSuggest(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits = [];
  getState().sites.forEach((site) => {
    const name = (site.name || '').toLowerCase();
    const url = (site.url || '').toLowerCase();
    if (name.includes(q) || url.includes(q)) hits.push(site.name || site.url);
  });
  return hits.slice(0, 6);
}

async function fetchSuggest(query) {
  const cfg = loadConfig();
  if (!cfg.network || !cfg.searchSuggest || !query.trim()) { hideSuggest(); return; }
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error('bad status');
    const data = await res.json();
    const items = Array.isArray(data?.[1]) ? data[1] : [];
    suggestItems = items.slice(0, 8);
    suggestIndex = -1;
    suggestLocal = false;
    renderSuggest();
  } catch (e) {
    /* Google 建议在部分网络下不可达：给出明确提示，并展示本地收藏匹配 */
    const local = localSuggest(query);
    suggestItems = local;
    suggestIndex = -1;
    suggestLocal = true;
    renderSuggest();
  }
}

export function initSearch() {
  const input = document.getElementById('search-input');
  const clear = document.getElementById('search-clear');
  const submit = document.getElementById('search-submit');
  const engineBtn = document.getElementById('engine-btn');
  if (!input) return;

  const cfg = loadConfig();
  syncEngine();
  renderCategories();

  if (cfg.keepSearchInput) {
    const meta = loadMeta();
    if (meta.searchText) input.value = meta.searchText;
  }
  syncClear();

  engineBtn?.addEventListener('click', (e) => {
    const menu = engineMenu();
    menu.classList.toggle('hidden');
    if (!menu.classList.contains('hidden')) {
      const rect = engineBtn.getBoundingClientRect();
      menu.style.left = Math.max(8, rect.left) + 'px';
      menu.style.top = (rect.bottom + 6) + 'px';
    }
    e.stopPropagation();
  });

  input.addEventListener('input', () => {
    syncClear();
    if (loadConfig().keepSearchInput) saveMeta({ searchText: input.value });
    clearTimeout(suggestTimer);
    const q = input.value;
    if (!q.trim()) { hideSuggest(); return; }
    suggestTimer = setTimeout(() => fetchSuggest(q), 220);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && suggestItems.length) {
      e.preventDefault();
      suggestIndex = (suggestIndex + 1) % suggestItems.length;
      renderSuggest();
    } else if (e.key === 'ArrowUp' && suggestItems.length) {
      e.preventDefault();
      suggestIndex = (suggestIndex - 1 + suggestItems.length) % suggestItems.length;
      renderSuggest();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      doSearch(suggestIndex >= 0 ? suggestItems[suggestIndex] : input.value);
    } else if (e.key === 'Escape') {
      hideSuggest();
    }
  });

  clear?.addEventListener('click', () => {
    input.value = '';
    syncClear();
    hideSuggest();
    saveMeta({ searchText: '' });
    input.focus();
  });

  submit?.addEventListener('click', () => doSearch(input.value));

  /* 输入即搜索：在页面任意位置键入字符或按 “/” 时聚焦搜索框 */
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (loadConfig().hideSearch) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (document.body.classList.contains('panel-open')) return;
    if (document.querySelector('.modal.open')) return;
    if (e.key === '/') {
      e.preventDefault();
      input.focus();
      return;
    }
    if (e.key.length !== 1 || e.key === ' ') return;
    e.preventDefault();
    input.focus();
    input.value = e.key;
    input.dispatchEvent(new Event('input'));
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#suggest-list') && !e.target.closest('#search-card')) hideSuggest();
    if (!e.target.closest('#engine-menu') && !e.target.closest('#engine-btn')) {
      document.getElementById('engine-menu')?.classList.add('hidden');
    }
  });
  document.addEventListener('configchange', (e) => {
    const detail = e.detail || {};
    if ('searchEngine' in detail) syncEngine();
    if ('searchCategory' in detail) renderCategories();
  });
}
