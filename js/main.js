/* main.js — 启动引导：存储初始化 → 配置应用 → 各模块装配 → 渲染 → 侧边栏切换 → 主页搜索 */
import { initStore, getCurrentPage, getState, setCurrentPageId } from './store.js';
import { loadConfig, saveConfig, applyConfigToDom, loadMeta, saveMeta } from './config.js';
import { renderAll, createPageAndGo, initGridDragDrop } from './render.js';
import { initAddTab } from './addtab.js';
import { initFolderModal, initSlideEditor, initSiteEditor, openSiteEditor, openFolderModal } from './folder.js';
import { initContextMenu, initConfirm } from './contextmenu.js';
import { initWallpaper } from './wallpaper.js';
import { initSettings } from './settings.js';
import { initProfile } from './profile.js';
import { initTodo } from './todo.js';
import { openUrl, toast } from './utils.js';

function initSidebar() {
  const tabs = document.querySelectorAll('.side-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      document.getElementById(tab.dataset.panel).classList.add('active');
    });
  });
  /* 折叠按钮切换收起 / 展开（对标原版） */
  const sc = document.getElementById('sidebar-collapse');
  if (sc) sc.addEventListener('click', () => document.body.classList.toggle('sb-collapsed'));
}

function switchToHome() {
  document.querySelectorAll('.side-tab').forEach((t) => t.classList.remove('active'));
  document.getElementById('tab-home').classList.add('active');
  document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
  document.getElementById('panel-home').classList.add('active');
}

/* 四引擎 × 五类别 URL 模板 [源码核验：原版为百度/谷歌/必应/Yahoo + 网页/图片/资讯/视频/地图] */
const ENGINES = {
  baidu: {
    web: 'https://www.baidu.com/s?wd=', image: 'https://image.baidu.com/search/index?tn=baiduimage&word=',
    news: 'https://www.baidu.com/s?tn=news&wd=', video: 'https://www.baidu.com/sf/vsearch?wd=',
    map: 'https://map.baidu.com/?wd=',
  },
  google: {
    web: 'https://www.google.com/search?q=', image: 'https://www.google.com/search?tbm=isch&q=',
    news: 'https://www.google.com/search?tbm=nws&q=', video: 'https://www.google.com/search?tbm=vid&q=',
    map: 'https://www.google.com/maps?q=',
  },
  bing: {
    web: 'https://www.bing.com/search?q=', image: 'https://www.bing.com/images/search?q=',
    news: 'https://www.bing.com/news/search?q=', video: 'https://www.bing.com/videos/search?q=',
    map: 'https://www.bing.com/maps?q=',
  },
  yahoo: {
    web: 'https://search.yahoo.com/search?p=', image: 'https://image.search.yahoo.com/search?p=',
    news: 'https://news.search.yahoo.com/search?p=', video: 'https://video.search.yahoo.com/search?p=',
    map: 'https://maps.yahoo.com/?p=',
  },
};

function initHomeSearch() {
  const input = document.getElementById('home-search');
  const clearBtn = document.getElementById('search-clear');
  const engineSel = document.getElementById('search-engine');
  const catsRow = document.getElementById('search-cats');
  const cfg = loadConfig();

  engineSel.value = cfg.searchEngine;
  if (cfg.keepSearchContent) {
    const meta = loadMeta();
    if (meta.homeSearchText) input.value = meta.homeSearchText;
  }
  clearBtn.classList.toggle('visible', !!input.value);
  catsRow.style.display = cfg.hideSearchCategory ? 'none' : 'flex';
  catsRow.querySelectorAll('.search-cat').forEach((b) => {
    b.classList.toggle('active', b.dataset.cat === cfg.searchCategory);
  });

  engineSel.addEventListener('change', () => saveConfig({ searchEngine: engineSel.value }));
  catsRow.querySelectorAll('.search-cat').forEach((b) => {
    b.addEventListener('click', () => {
      saveConfig({ searchCategory: b.dataset.cat });
      catsRow.querySelectorAll('.search-cat').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      input.focus();
    });
  });

  input.addEventListener('input', () => {
    clearBtn.classList.toggle('visible', !!input.value);
    if (loadConfig().keepSearchContent) saveMeta({ homeSearchText: input.value });
  });
  clearBtn.addEventListener('click', () => {
    input.value = ''; clearBtn.classList.remove('visible');
    if (loadConfig().keepSearchContent) saveMeta({ homeSearchText: '' });
    input.focus();
  });

  const doSearch = () => {
    const q = input.value.trim();
    if (!q) return;
    const engine = ENGINES[loadConfig().searchEngine] || ENGINES.baidu;
    const cat = loadConfig().searchCategory || 'web';
    const url = (engine[cat] || engine.web) + encodeURIComponent(q);
    openUrl(url, { background: false });
    if (!loadConfig().keepSearchContent) { input.value = ''; clearBtn.classList.remove('visible'); }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  document.getElementById('search-btn').addEventListener('click', doSearch);
}

function initPageAdd() {
  document.getElementById('page-add-btn').addEventListener('click', createPageAndGo);
}

/** 空白网格区域右键 → 手动新建站点 */
function initGridContextNewSite() {
  const container = document.getElementById('grid-container');
  container.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.site-card')) return;
    e.preventDefault();
    openSiteEditor(null, { pageId: getCurrentPage().id });
  });
}

function goPage(dir) {
  const { pages } = getState();
  const cur = getCurrentPage();
  const i = pages.findIndex((p) => p.id === cur.id);
  const next = pages[(i + dir + pages.length) % pages.length];
  setCurrentPageId(next.id);
  renderAll();
}

function initPageArrows() {
  document.getElementById('page-prev').addEventListener('click', () => goPage(-1));
  document.getElementById('page-next').addEventListener('click', () => goPage(1));
}

/* 鼠标滚轮在分页间来回切换（对标原版） */
function initPageWheel() {
  const home = document.getElementById('panel-home');
  let last = 0;
  home.addEventListener('wheel', (e) => {
    const now = Date.now(); if (now - last < 260) return; last = now;
    if (Math.abs(e.deltaY) < 20) return;
    goPage(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });
}

async function boot() {
  await initStore();
  const cfg = loadConfig();
  applyConfigToDom(cfg);
  initConfirm();
  initContextMenu();
  initAddTab();
  initFolderModal();
  initSlideEditor();
  initSiteEditor();
  await initWallpaper();
  initSettings();
  initProfile();
  initTodo();
  initSidebar();
  initHomeSearch();
  initPageAdd();
  initGridContextNewSite();
  initPageArrows();
  initPageWheel();
  initGridDragDrop();
  renderAll();
  window.__openFolderModal = openFolderModal;
  window.__openSiteEditor = openSiteEditor;
  window.__APP_BOOTED__ = true;
}

boot().catch((err) => {
  console.error('[新标签页] 启动失败:', err);
  toast('初始化异常：' + (err && err.message ? err.message : '未知错误'));
});
