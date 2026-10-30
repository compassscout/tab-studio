/* render.js — 首页网格：小组件 / 站点 / 文件夹 / 添加卡 + 分页圆点 */
import {
  getState, getCurrentPage, currentPageIndex, getSite, getFolder,
  capacityOfPage, setCurrentPage, addPage, deletePage, reorderPages, pendingTodoCount,
} from './store.js';
import { loadConfig, loadMeta } from './config.js';
import { chromeFaviconUrl, paintIcon } from './favicon.js';
import { escapeHtml, firstChar, toast, openUrl, debounce } from './utils.js';

const WIDGETS = [
  { key: 'weather', label: '天气', icon: 'i-weather', cls: 'widget-weather' },
  { key: 'todo', label: '待办事项', icon: 'i-todo', cls: 'widget-todo' },
  { key: 'note', label: '笔记', icon: 'i-note', cls: 'widget-note' },
  { key: 'folder', label: '文件夹', icon: 'i-folder', cls: 'widget-folder' },
  { key: 'settings', label: '设置', icon: 'i-gear', cls: 'widget-settings' },
];

function app() { return window.app || {}; }

function makeCell(kind, id, extraClass = '') {
  const el = document.createElement('div');
  el.className = `cell ${kind}${extraClass ? ' ' + extraClass : ''}`;
  el.dataset.kind = kind;
  if (id) el.dataset.id = id;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  return el;
}

function addLabel(el, text) {
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = text;
  label.title = text;
  el.appendChild(label);
}

function addMenuButton(el, kind, id) {
  const btn = document.createElement('button');
  btn.className = 'cell-menu';
  btn.title = '更多';
  btn.innerHTML = '<svg style="width:14px;height:14px"><use href="#i-gear"/></svg>';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = btn.getBoundingClientRect();
    if (kind === 'site') app().openSiteMenu?.({ clientX: rect.left, clientY: rect.bottom + 4, preventDefault() {} }, id);
    else if (kind === 'folder') app().openFolderMenu?.({ clientX: rect.left, clientY: rect.bottom + 4, preventDefault() {} }, id);
  });
  el.appendChild(btn);
}

/* ---------------- 站点卡片 ---------------- */
function siteCell(site) {
  const el = makeCell('site', site.id);
  const icon = document.createElement('span');
  icon.className = 'icon';
  paintIcon(icon, site, { size: 64 });
  el.appendChild(icon);
  addLabel(el, site.name || '未命名');
  addMenuButton(el, 'site', site.id);
  el.addEventListener('click', () => {
    const cfg = loadConfig();
    openUrl(site.url, { newTab: cfg.openSiteNewTab });
  });
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); app().openSiteMenu?.(e, site.id); });
  el.draggable = true;
  el.addEventListener('dragstart', (e) => {
    window.__compassDrag = 'item:' + site.id;
    e.dataTransfer.setData('text/plain', window.__compassDrag);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => { el.classList.remove('dragging'); window.__compassDrag = ''; });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.click(); });
  return el;
}

/* ---------------- 文件夹卡片 ---------------- */
function folderCell(folder) {
  const el = makeCell('folder', folder.id);
  const icon = document.createElement('span');
  icon.className = 'icon folder-icon';
  const members = folder.iconIds.map(getSite).filter(Boolean).slice(0, 4);
  if (members.length === 0) {
    icon.innerHTML = '<svg class="folder-empty-ico"><use href="#i-folder"/></svg>';
  } else {
    members.forEach((site) => {
      const mini = document.createElement('span');
      mini.className = 'folder-mini';
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
      icon.appendChild(mini);
    });
  }
  el.appendChild(icon);
  addLabel(el, folder.name || '文件夹');
  addMenuButton(el, 'folder', folder.id);
  el.addEventListener('click', () => app().openFolder?.(folder.id));
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); app().openFolderMenu?.(e, folder.id); });
  el.draggable = true;
  el.addEventListener('dragstart', (e) => {
    window.__compassDrag = 'item:' + folder.id;
    e.dataTransfer.setData('text/plain', window.__compassDrag);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => { el.classList.remove('dragging'); window.__compassDrag = ''; });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.click(); });
  return el;
}

/* ---------------- 小组件 ---------------- */
function widgetCell(widget) {
  const el = makeCell('widget', 'widget-' + widget.key, widget.cls);
  const icon = document.createElement('span');
  icon.className = 'icon widget-icon';
  icon.innerHTML = `<svg><use href="#${widget.icon}"/></svg>`;
  el.appendChild(icon);

  let label = widget.label;
  if (widget.key === 'weather') {
    const weather = loadMeta().weather;
    if (weather && weather.temp !== undefined && weather.temp !== null) label = `${Math.round(weather.temp)}°C`;
  }
  if (widget.key === 'todo') {
    const count = pendingTodoCount();
    if (count > 0) {
      label = '待办事项';
      const badge = document.createElement('span');
      badge.className = 'widget-badge';
      badge.textContent = count > 99 ? '99+' : String(count);
      el.appendChild(badge);
    }
  }
  addLabel(el, label);

  el.addEventListener('click', () => {
    const map = {
      weather: 'openWeather', todo: 'openTodo', note: 'openNote',
      folder: 'openFolders', settings: 'openSettings',
    };
    app()[map[widget.key]]?.();
  });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.click(); });
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    app().openWidgetMenu?.(e, el.dataset.id);
  });
  el.draggable = true;
  el.addEventListener('dragstart', (e) => {
    window.__compassDrag = 'item:' + el.dataset.id;
    e.dataTransfer.setData('text/plain', window.__compassDrag);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => { el.classList.remove('dragging'); window.__compassDrag = ''; });
  return el;
}

function addCell() {
  const el = makeCell('add-cell');
  const icon = document.createElement('span');
  icon.className = 'icon';
  icon.innerHTML = '<svg><use href="#i-plus"/></svg>';
  el.appendChild(icon);
  addLabel(el, '添加');
  el.addEventListener('click', () => app().openPanel?.('add'));
  return el;
}

export function renderGrid() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  const page = getCurrentPage();
  if (!page) return;
  const cfg = loadConfig();
  grid.innerHTML = '';

  const items = page.siteIds.map((id) => {
    if (id.startsWith('widget-')) {
      const widget = WIDGETS.find((w) => 'widget-' + w.key === id);
      return widget ? { kind: 'widget', data: widget } : null;
    }
    const site = getSite(id);
    if (site) return { kind: 'site', data: site };
    const folder = getFolder(id);
    if (folder) return { kind: 'folder', data: folder };
    return null;
  }).filter(Boolean);

  const nodes = [];
  items.forEach((item) => {
    if (item.kind === 'site') nodes.push(siteCell(item.data));
    else if (item.kind === 'folder') nodes.push(folderCell(item.data));
    else nodes.push(widgetCell(item.data));
  });
  const capacity = capacityOfPage(page.id);
  if (items.length < capacity) nodes.push(addCell());

  nodes.forEach((node, i) => {
    if (cfg.startAnimation) {
      node.classList.add('start-animate');
      node.style.animationDelay = (i * 22) + 'ms';
    }
    grid.appendChild(node);
  });

  if (items.length === 0) {
    const tip = document.createElement('div');
    tip.className = 'grid-empty';
    tip.textContent = '这一页还没有内容，点「＋」添加，或把图标拖到下方圆点换页。';
    grid.appendChild(tip);
  }
}

/* ---------------- 分页圆点 ---------------- */
export function renderDots() {
  const wrap = document.getElementById('dots');
  if (!wrap) return;
  const { pages } = getState();
  const current = getCurrentPage();
  wrap.innerHTML = '';
  pages.forEach((page) => {
    const dot = document.createElement('button');
    dot.className = 'page-dot' + (page.id === current.id ? ' active' : '');
    dot.title = page.name;
    dot.addEventListener('click', () => {
      if (page.id === current.id) return;
      setCurrentPage(page.id);
      renderAll();
    });
    dot.addEventListener('contextmenu', (e) => { e.preventDefault(); app().openPageMenu?.(e, page.id); });
    dot.addEventListener('dblclick', (e) => { e.preventDefault(); app().openPageMenu?.(e, page.id); });
    dot.draggable = true;
    dot.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', 'page:' + page.id);
      e.dataTransfer.effectAllowed = 'move';
      dot.classList.add('dragging');
    });
    dot.addEventListener('dragend', () => dot.classList.remove('dragging'));
    dot.addEventListener('dragover', (e) => { e.preventDefault(); dot.classList.add('drop-target'); });
    dot.addEventListener('dragleave', () => dot.classList.remove('drop-target'));
    dot.addEventListener('drop', async (e) => {
      e.preventDefault(); e.stopPropagation();
      dot.classList.remove('drop-target');
      const raw = e.dataTransfer.getData('text/plain') || '';
      if (raw.startsWith('page:')) {
        const srcId = raw.slice(5);
        if (srcId === page.id) return;
        const order = getState().pages.map((p) => p.id);
        const from = order.indexOf(srcId);
        if (from < 0) return;
        order.splice(from, 1);
        order.splice(order.indexOf(page.id), 0, srcId);
        await reorderPages(order);
        renderAll();
        return;
      }
      if (raw.startsWith('item:')) {
        const itemId = raw.slice(5);
        const fromPage = getState().pages.find((p) => p.siteIds.includes(itemId));
        if (fromPage && fromPage.id !== page.id) {
          await (await import('./store.js')).moveItemToPage(itemId, page.id);
          renderAll();
          toast(`已移动到「${page.name}」`);
        }
      }
    });
    wrap.appendChild(dot);
  });
}

export async function createPage() {
  const page = await addPage();
  setCurrentPage(page.id);
  renderAll();
  toast(`已新建「${page.name}」，双击圆点可重命名`);
}

export async function removeCurrentPage() {
  const page = getCurrentPage();
  if (getState().pages.length <= 1) { toast('至少保留一个分页'); return; }
  const ok = await (window.app?.confirm?.('删除这个分页？页面里的站点会移动到第 1 页，不会丢失。') ?? Promise.resolve(true));
  if (!ok) return;
  try {
    await deletePage(page.id);
    renderAll();
    toast('分页已删除，内容已移到第 1 页');
  } catch (e) { toast(e.message || '删除失败'); }
}

/* ---------------- 翻页 ---------------- */
export function goPage(delta) {
  const { pages } = getState();
  if (pages.length < 2) return;
  const idx = currentPageIndex();
  const next = pages[(idx + delta + pages.length) % pages.length];
  setCurrentPage(next.id);
  renderAll();
}

export function renderAll() {
  renderDots();
  renderGrid();
  document.dispatchEvent(new CustomEvent('app-render'));
}

export function initPager() {
  document.getElementById('page-add')?.addEventListener('click', createPage);
  document.getElementById('page-prev')?.addEventListener('click', () => goPage(-1));
  document.getElementById('page-next')?.addEventListener('click', () => goPage(1));
}

/** 滚轮翻页：只在首页、无面板、无弹窗时生效 */
export function initWheelPaging() {
  const home = document.getElementById('home');
  let last = 0;
  home?.addEventListener('wheel', (e) => {
    if (document.body.classList.contains('panel-open')) return;
    if (document.querySelector('.modal.open')) return;
    const now = Date.now();
    if (now - last < 700) return;
    if (Math.abs(e.deltaY) < 18) return;
    if (getState().pages.length < 2) return;
    last = now;
    goPage(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });
}

export function refreshWeatherLabel() { renderGrid(); }

export { WIDGETS };
