/* panel.js — 右侧面板：开合 / 添加 / 我的 / 顶部菜单 */
import { getState, addSite, exportAll, importAll, getCurrentPage, addWallpaper } from './store.js';
import { loadConfig, saveConfig, applyConfig, loadMeta, saveMeta } from './config.js';
import { CATEGORIES, PRESET_SITES, presetsByCategory } from './presets.js';
import { paintIcon } from './favicon.js';
import { normalizeUrl, hostNameOf, toast, downloadFile, todayISO, nowISO, debounce, hasTabs, escapeHtml } from './utils.js';
import { renderAll } from './render.js';
import { initSettings, refreshSettingsUI } from './settings.js';
import { confirmAction } from './dialog.js';
import { openHistory, openBookmarks } from './browserdata.js';
import { refreshThumb, seedWallpapers, randomNext } from './wallpaper.js';

let addCategory = 'popular';
let addKeyword = '';
let currentTab = 'add';
let inited = false;

function app() { return window.app || {}; }

/* ---------------- 开合 ---------------- */
export function openPanel(tab = 'add') {
  document.body.classList.add('panel-open');
  document.getElementById('panel')?.classList.add('open');
  document.getElementById('panel-overlay')?.classList.add('open');
  switchTab(tab);
}
export function closePanel() {
  document.body.classList.remove('panel-open');
  document.getElementById('panel')?.classList.remove('open');
  document.getElementById('panel-overlay')?.classList.remove('open');
}
export function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.panel-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.panel-page').forEach((p) => p.classList.toggle('active', p.dataset.page === tab));
  const body = document.getElementById('panel-body');
  if (body) body.scrollTop = 0;
  if (tab === 'me') refreshStats();
  if (tab === 'settings') refreshSettingsUI();
}

/* ---------------- 添加 ---------------- */
function renderCategories() {
  const wrap = document.getElementById('add-cats');
  if (!wrap) return;
  wrap.innerHTML = '';
  const all = document.createElement('button');
  all.className = 'chip' + (addCategory === 'all' ? ' active' : '');
  all.textContent = '全部';
  all.addEventListener('click', () => { addCategory = 'all'; renderCategories(); renderAddList(); });
  wrap.appendChild(all);
  CATEGORIES.forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (addCategory === cat.id ? ' active' : '');
    btn.textContent = cat.label;
    btn.addEventListener('click', () => { addCategory = cat.id; renderCategories(); renderAddList(); });
    wrap.appendChild(btn);
  });
}

function renderAddList() {
  const list = document.getElementById('add-list');
  if (!list) return;
  list.innerHTML = '';
  const items = presetsByCategory(addCategory, addKeyword);
  if (!items.length) {
    list.innerHTML = '<div class="add-empty">没有找到匹配的站点，换个关键词试试。</div>';
    return;
  }
  items.forEach((preset) => {
    const row = document.createElement('div');
    row.className = 'add-item';
    const icon = document.createElement('div');
    icon.className = 'ai-icon';
    paintIcon(icon, { name: preset.name, url: preset.url, color: preset.color, iconType: 'auto' }, { size: 32 });
    const text = document.createElement('div');
    text.className = 'ai-text';
    text.innerHTML = `<div class="ai-name">${escapeHtml(preset.name)}</div><div class="ai-desc">${escapeHtml(preset.desc)}</div>`;
    const add = document.createElement('button');
    add.className = 'ai-add';
    add.title = '添加到当前分页';
    add.innerHTML = '<svg><use href="#i-plus"/></svg>';
    add.addEventListener('click', async () => {
      const result = await addSite({
        name: preset.name, url: preset.url, color: preset.color,
        description: preset.desc, pageId: getCurrentPage().id,
      });
      renderAll();
      toast(result.moved ? `当前页已满，已添加到「${getState().pages.find((p) => p.id === result.pageId)?.name}」` : `已添加「${preset.name}」`);
    });
    row.appendChild(icon); row.appendChild(text); row.appendChild(add);
    list.appendChild(row);
  });
}

async function addCurrentPage() {
  if (!hasTabs()) { toast('请在扩展环境中使用'); return; }
  try {
    const tabs = await new Promise((resolve, reject) => {
      chrome.tabs.query({}, (list) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(list || []);
      });
    });
    const candidates = tabs.filter((t) => /^https?:\/\//i.test(t.url || '') && !t.url.startsWith(chrome.runtime.getURL('')));
    candidates.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    const tab = candidates[0];
    if (!tab) { toast('没有可添加的网页'); return; }
    const result = await addSite({
      name: tab.title || hostNameOf(tab.url),
      url: tab.url,
      color: '#4c8bf5',
      pageId: getCurrentPage().id,
    });
    renderAll();
    toast(`已添加「${tab.title || hostNameOf(tab.url)}」`);
    if (result.moved) toast('当前页已满，已放到下一页');
  } catch (e) {
    toast('获取当前页面失败');
  }
}

/* ---------------- 我的 ---------------- */
function refreshStats() {
  const { sites, folders, pages } = getState();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
  set('stat-sites', sites.length);
  set('stat-folders', folders.length);
  set('stat-pages', pages.length);
}

function refreshProfile() {
  const meta = loadMeta();
  const avatar = document.getElementById('me-avatar');
  const name = document.getElementById('me-name');
  if (name && document.activeElement !== name) name.value = meta.nickname || '';
  if (avatar) {
    if (meta.avatar) {
      avatar.textContent = '';
      avatar.style.backgroundImage = `url("${meta.avatar}")`;
    } else {
      avatar.style.backgroundImage = '';
      avatar.textContent = (meta.nickname || 'C').slice(0, 1).toUpperCase();
    }
  }
}

async function doExport() {
  const data = await exportAll();
  const payload = {
    version: 2,
    app: 'compass-newtab',
    exportedAt: nowISO(),
    data: { ...data, config: loadConfig() },
  };
  downloadFile(`TABSTUDIO-Backup-${todayISO()}.infinity`, JSON.stringify(payload, null, 2));
  saveMeta({ lastBackup: nowISO() });
  toast('备份已导出');
}

function validBackup(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (!obj.data || typeof obj.data !== 'object') return false;
  return ['sites', 'folders', 'pages'].every((k) => Array.isArray(obj.data[k]));
}

async function doImport(file) {
  let text;
  try { text = await file.text(); } catch (e) { toast('文件读取失败'); return; }
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { toast('备份文件解析失败，现有数据未改动'); return; }
  if (!validBackup(parsed)) { toast('备份结构不完整，现有数据未改动'); return; }
  const ok = await confirmAction('导入会覆盖当前站点、文件夹、分页与设置，确定继续？', { okText: '导入', danger: true });
  if (!ok) return;
  try {
    await importAll(parsed.data);
    if (parsed.data.config && typeof parsed.data.config === 'object') {
      saveConfig(parsed.data.config, { silent: true });
      applyConfig(loadConfig());
    }
    if (getState().wallpapers.length === 0) await seedWallpapers();
    renderAll();
    refreshStats();
    refreshSettingsUI();
    refreshProfile();
    refreshThumb();
    if (!getState().wallpapers.some((w) => w.id === loadMeta().wallpaperId)) randomNext();
    toast('导入完成');
  } catch (e) {
    toast('导入失败，数据可能未完整恢复');
  }
}

async function doRepair() {
  const { sites, folders, pages } = getState();
  const summary = [];
  sites.forEach((s) => {
    if (!/^https?:\/\//i.test(s.url || '')) { s.url = 'https://example.com'; summary.push(`修正站点「${s.name}」的网址`); }
    if (!s.color) s.color = '#4c8bf5';
    if (!s.iconType) s.iconType = 'auto';
  });
  pages.forEach((p) => {
    if (!Array.isArray(p.siteIds)) p.siteIds = [];
    p.siteIds = p.siteIds.filter((id) => sites.some((s) => s.id === id) || folders.some((f) => f.id === id));
  });
  const { db } = await import('./db.js');
  await Promise.all(pages.map((p) => db.put('pages', p)));
  await Promise.all(sites.map((s) => db.put('sites', s)));
  renderAll();
  await confirmAction(summary.length ? `修复完成：${summary.slice(0, 6).join('；')}` : '数据检查通过，没有发现需要修复的内容。', { okText: '知道了', danger: false });
}

/* ---------------- 顶部菜单 ---------------- */
function initTopMenu() {
  const btn = document.getElementById('menu-btn');
  const menu = document.getElementById('top-menu');
  if (!btn || !menu) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
    if (!menu.classList.contains('hidden')) {
      const rect = btn.getBoundingClientRect();
      menu.style.left = Math.max(8, rect.right - 176) + 'px';
      menu.style.top = (rect.bottom + 8) + 'px';
    }
  });
  menu.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      menu.classList.add('hidden');
      const act = b.dataset.act;
      if (act === 'add-site') app().openSiteEditor?.(null);
      if (act === 'new-folder') app().newFolder?.();
      if (act === 'wallpaper') app().openWallpaperLibrary?.();
      if (act === 'add-tab') openPanel('add');
      if (act === 'history') openHistory();
      if (act === 'bookmarks') openBookmarks();
      if (act === 'settings') openPanel('settings');
      if (act === 'me') openPanel('me');
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#top-menu') && !e.target.closest('#menu-btn')) menu.classList.add('hidden');
  });
}

/* ---------------- 初始化 ---------------- */
export function initPanel() {
  if (inited) return;
  inited = true;

  document.querySelectorAll('.panel-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  document.getElementById('panel-close')?.addEventListener('click', closePanel);
  document.getElementById('panel-overlay')?.addEventListener('click', closePanel);

  renderCategories();
  renderAddList();
  document.getElementById('add-search')?.addEventListener('input', debounce((e) => {
    addKeyword = e.target.value;
    renderAddList();
  }, 180));
  document.getElementById('add-current')?.addEventListener('click', addCurrentPage);

  refreshProfile();
  refreshStats();
  document.getElementById('me-name')?.addEventListener('input', debounce((e) => {
    saveMeta({ nickname: e.target.value.trim() });
    refreshProfile();
  }, 300));
  document.getElementById('me-avatar')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const { readFileAsDataURL, compressImage } = await import('./utils.js');
      const raw = await readFileAsDataURL(file);
      const data = await compressImage(raw, 160, 0.85);
      saveMeta({ avatar: data });
      refreshProfile();
      toast('头像已更新');
    });
    input.click();
  });
  document.getElementById('export-btn')?.addEventListener('click', doExport);
  document.getElementById('import-btn')?.addEventListener('click', () => document.getElementById('import-file')?.click());
  document.getElementById('import-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) doImport(file);
  });
  document.getElementById('repair-btn')?.addEventListener('click', doRepair);
  document.getElementById('about-btn')?.addEventListener('click', () => {
    toast('快捷键：Ctrl/⌘+T 新标签页 · 输入即搜索 · Enter 打开');
  });

  initSettings();
  initTopMenu();
}

export { refreshProfile, refreshStats };
