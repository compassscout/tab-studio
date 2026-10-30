/* render.js — 主页网格 / 站点卡 / 文件夹卡 / 分页圆点渲染 */
import { getState, getCurrentPage, getSite, getFolder, setCurrentPageId, addPage, removePage, reorderPage, reorderPages, addFolder, addSiteToFolder } from './store.js';
import { db } from './db.js';
import { openUrl, escapeHtml, firstCharOf, toast } from './utils.js';
import { PRESET_ICONS } from './presets.js';
import { loadConfig } from './config.js';

export const PRESET_COLORS = ['#4c8bf5', '#ff6b6b', '#f5a623', '#34c759', '#9b59b6', '#16a085', '#e67e22', '#5b8def'];

/** 渲染单个图标（站点卡 / 文件夹缩略共用），返回 HTML 字符串（已转义） */
export function iconInner(site, sizeClass = '') {
  if (!site) return '';
  if (site.iconType === 'upload' && site.iconValue) {
    return `<div class="icon-content ${sizeClass}" style="background-image:url('${site.iconValue}');background-size:cover;"></div>`;
  }
  if (site.iconType === 'preset' && PRESET_ICONS[site.iconValue]) {
    return `<div class="icon-content ${sizeClass}" style="background:${escapeHtml(site.color || '#4c8bf5')};">${PRESET_ICONS[site.iconValue]}</div>`;
  }
  return `<div class="icon-content ${sizeClass}" style="background:${escapeHtml(site.color || '#4c8bf5')};">${escapeHtml(firstCharOf(site.name))}</div>`;
}

function siteCardEl(site, { anim = false } = {}) {
  const el = document.createElement('div');
  el.className = 'site-card' + (anim ? ' start-animate' : '');
  el.dataset.type = 'site';
  el.dataset.id = site.id;
  el.innerHTML = `
    ${iconInner(site)}
    <div class="icon-name">${escapeHtml(site.name || '未命名')}</div>`;
  el.addEventListener('click', () => onSiteClick(site));
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); window.__openSiteMenu(e, site.id); });
  el.draggable = true;
  el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', site.id); e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); });
  el.addEventListener('dragend', () => { el.classList.remove('dragging'); });
  return el;
}

function folderCardEl(folder, { anim = false } = {}) {
  const el = document.createElement('div');
  el.className = 'site-card folder-card' + (anim ? ' start-animate' : '');
  el.dataset.type = 'folder';
  el.dataset.id = folder.id;
  const members = folder.iconIds.map(getSite).filter(Boolean).slice(0, 9);
  let minis = '';
  members.forEach((m) => {
    if (m.iconType === 'upload' && m.iconValue) {
      minis += `<div class="mini-icon" style="background-image:url('${m.iconValue}');background-size:cover;"></div>`;
    } else {
      const bg = m.iconType === 'preset' && PRESET_ICONS[m.iconValue]
        ? PRESET_ICONS[m.iconValue] : firstCharOf(m.name);
      minis += `<div class="mini-icon" style="background:${escapeHtml(m.color || '#888')};">${escapeHtml(bg)}</div>`;
    }
  });
  el.innerHTML = `
    <div class="icon-content">${minis || '<span style="color:#888;font-size:16px;">📁</span>'}</div>
    <div class="icon-name">${escapeHtml(folder.name || '未命名文件夹')}</div>`;
  el.addEventListener('click', () => window.__openFolderModal(folder.id));
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); window.__openFolderMenu(e, folder.id); });
  return el;
}

function onSiteClick(site) {
  const cfg = loadConfig();
  if (!site.url) return;
  if (cfg.openSiteNewTab) { openUrl(site.url, { background: false }); }
  else if (typeof chrome !== 'undefined' && chrome.tabs) { chrome.tabs.update({ url: site.url }); }
  else { location.href = site.url; }
}

export function renderGrid() {
  const container = document.getElementById('grid-container');
  container.innerHTML = '';
  const page = getCurrentPage();
  if (!page) return;
  const cfg = loadConfig();
  const items = page.siteIds.map((id) => {
    const site = getSite(id);
    if (site) return { type: 'site', data: site };
    const folder = getFolder(id);
    if (folder) return { type: 'folder', data: folder };
    return null;
  }).filter(Boolean);

  if (items.length === 0) {
    const tip = document.createElement('div');
    tip.className = 'empty-grid-tip';
    tip.textContent = '当前分页暂无站点，点击左侧「添加」或下方 ＋ 添加网站。';
    container.appendChild(tip);
  } else {
    items.forEach((item, i) => {
      const el = item.type === 'site' ? siteCardEl(item.data, { anim: cfg.startAnimation })
                                     : folderCardEl(item.data, { anim: cfg.startAnimation });
      if (cfg.startAnimation) el.style.animationDelay = (i * 30) + 'ms';
      container.appendChild(el);
    });
  }
  container.appendChild(makeAddCard());
}

function makeAddCard() {
  const add = document.createElement('div');
  add.className = 'site-card add-card';
  add.innerHTML = '<div class="icon-content">+</div><div class="icon-name">添加</div>';
  add.addEventListener('click', () => {
    if (window.__openSiteEditor) window.__openSiteEditor(null, { pageId: getCurrentPage().id });
  });
  return add;
}

/** 网格拖拽：站点→站点建组 / 站点→文件夹加入（boot 时调用一次） */
export function initGridDragDrop() {
  const container = document.getElementById('grid-container');
  let lastTarget = null;
  function clearTarget() { if (lastTarget) { lastTarget.classList.remove('drop-target'); lastTarget = null; } }
  container.addEventListener('dragover', (e) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    const t = e.target.closest('.site-card');
    if (t !== lastTarget) { clearTarget(); if (t) t.classList.add('drop-target'); lastTarget = t; }
  });
  container.addEventListener('dragleave', (e) => { if (!e.target.closest('.site-card')) clearTarget(); });
  container.addEventListener('drop', async (e) => {
    e.preventDefault(); clearTarget();
    const sourceId = e.dataTransfer.getData('text/plain'); if (!sourceId) return;
    const target = e.target.closest('.site-card'); if (!target || target.dataset.type === 'add') return;
    const tId = target.dataset.id; if (sourceId === tId) return;
    const page = getCurrentPage();
    try {
      if (target.dataset.type === 'folder') {
        await addSiteToFolder(tId, sourceId);
        page.siteIds = page.siteIds.filter((x) => x !== sourceId);
        await db.put('pages', page);
        renderAll(); toast('已把站点加入文件夹');
      } else if (target.dataset.type === 'site') {
        const name = window.prompt('新建文件夹名称', '新文件夹');
        if (name === null) return;
        const folder = await addFolder(name.trim() || '新文件夹', [sourceId, tId]);
        page.siteIds = page.siteIds.filter((x) => x !== sourceId && x !== tId);
        page.siteIds.push(folder.id);
        await db.put('pages', page);
        renderAll(); toast('已创建文件夹并收纳 2 个站点');
      }
    } catch (err) { toast('操作失败：' + (err && err.message ? err.message : '未知错误')); }
  });
}

/* ---------------- 分页圆点 ---------------- */
export function renderDots() {
  const wrap = document.getElementById('dots');
  wrap.innerHTML = '';
  const { pages } = getState();
  pages.forEach((page, idx) => {
    const dot = document.createElement('div');
    dot.className = 'page-dot' + (page.id === getCurrentPage().id ? ' active' : '');
    dot.title = page.name;
    dot.innerHTML = `<span class="dot-del" title="删除分页（不删除站点）">×</span>`;
    dot.addEventListener('click', (e) => {
      if (e.target.classList.contains('dot-del')) return;
      setCurrentPageId(page.id);
      renderAll();
    });
    dot.draggable = true;
    dot.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', 'page:' + page.id); e.dataTransfer.effectAllowed = 'move'; dot.classList.add('dragging'); });
    dot.addEventListener('dragend', () => { dot.classList.remove('dragging'); });
    dot.addEventListener('dragover', (e) => { e.preventDefault(); dot.classList.add('drop-target'); });
    dot.addEventListener('dragleave', () => { dot.classList.remove('drop-target'); });
    dot.addEventListener('drop', async (e) => {
      e.preventDefault(); e.stopPropagation();
      dot.classList.remove('drop-target');
      const raw = e.dataTransfer.getData('text/plain');
      if (!raw || !raw.startsWith('page:')) return;
      const srcId = raw.slice(5);
      if (srcId === page.id) return;
      const order = getState().pages.map((p) => p.id);
      const si = order.indexOf(srcId); if (si < 0) return;
      order.splice(si, 1);
      order.splice(order.indexOf(page.id), 0, srcId);
      await reorderPages(order);
      renderAll();
      toast('分页已重新排序');
    });
    dot.querySelector('.dot-del').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (pages.length <= 1) { toast('至少保留一个分页'); return; }
      const ok = await window.__confirm(`删除「${page.name}」？站点本体不会被删除，仅移出该分页。`);
      if (!ok) return;
      try { await removePage(page.id); renderAll(); toast('分页已删除，站点仍保留在站点库'); }
      catch (err) { toast(err.message || '删除失败'); }
    });
    wrap.appendChild(dot);
  });
}

export async function createPageAndGo() {
  const page = await addPage();
  setCurrentPageId(page.id);
  renderAll();
  toast(`已新建「${page.name}」`);
}

export function renderAll() { renderDots(); renderGrid(); }
