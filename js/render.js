/* render.js — 首页网格：小组件 / 站点 / 文件夹 / 添加卡 + 分页圆点 */
import {
  getState, getCurrentPage, currentPageIndex, getSite, getFolder,
  capacityOfPage, setCurrentPage, addPage, deletePage, reorderPages, pendingTodoCount, recordVisit,
} from './store.js';
import { loadConfig, loadMeta } from './config.js';
import { chromeFaviconUrl, paintIcon } from './favicon.js';
import { escapeHtml, firstChar, toast, openUrl, debounce } from './utils.js';

const WIDGETS = [
  { key: 'weather', label: '天气', icon: 'i-weather', cls: 'widget-weather' },
  { key: 'todo', label: '待办事项', icon: 'i-todo', cls: 'widget-todo' },
  { key: 'note', label: '笔记', icon: 'i-note', cls: 'widget-note' },
  { key: 'folder', label: '文件夹', icon: 'i-folder', cls: 'widget-folder' },
  { key: 'walls', label: '壁纸库', icon: 'i-picture', cls: 'widget-walls' },
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
  /* 键盘可达：Enter / 空格等同点击 */
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    el.click();
  });
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
  el.setAttribute('aria-label', site.name || '未命名网站');
  const icon = document.createElement('span');
  icon.className = 'icon';
  paintIcon(icon, site, { size: 64 });
  el.appendChild(icon);
  addLabel(el, site.name || '未命名');
  addMenuButton(el, 'site', site.id);
  el.addEventListener('click', (e) => {
    const cfg = loadConfig();
    recordVisit(site.id);
    openUrl(site.url, { newTab: cfg.openSiteNewTab || e.ctrlKey || e.metaKey });
  });
  /* 中键在新标签页打开 */
  el.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
  el.addEventListener('auxclick', (e) => {
    if (e.button !== 1) return;
    e.preventDefault();
    recordVisit(site.id);
    openUrl(site.url, { newTab: true });
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
      folder: 'openFolders', walls: 'openWallpaperLibrary', settings: 'openSettings',
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

let animPageId = null;

/** 收集一页要渲染的条目（站点 / 文件夹 / 小组件），含频率排序 */
function collectItems(page) {
  const cfg = loadConfig();
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

  /* 按使用频率排序：站点在原有站点槽位内重排，文件夹与小组件位置不动 */
  if (cfg.sortByFrequency) {
    const slots = items.map((it, i) => (it.kind === 'site' ? i : -1)).filter((i) => i >= 0);
    const ranked = slots.map((i) => items[i].data)
      .sort((a, b) => Number(b.clicks || 0) - Number(a.clicks || 0));
    slots.forEach((slot, i) => { items[slot] = { kind: 'site', data: ranked[i] }; });
  }
  return items;
}

/** 把一页内容构建进指定层（当前层或相邻层通用） */
function buildGridInto(layer, page, animate = false) {
  layer.innerHTML = '';
  layer.dataset.pageId = page.id;
  const items = collectItems(page);
  const nodes = [];
  items.forEach((item) => {
    if (item.kind === 'site') nodes.push(siteCell(item.data));
    else if (item.kind === 'folder') nodes.push(folderCell(item.data));
    else nodes.push(widgetCell(item.data));
  });
  const capacity = capacityOfPage(page.id);
  if (items.length < capacity) nodes.push(addCell());

  nodes.forEach((node, i) => {
    if (animate) {
      node.classList.add('start-animate');
      node.style.animationDelay = (i * 22) + 'ms';
    }
    layer.appendChild(node);
  });
}

export function renderGrid() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  const page = getCurrentPage();
  if (!page) return;
  /* 入场动画只在首次进入分页时播放一次；翻页本身已有滑动过渡，重排也不再重播 */
  const cfg = loadConfig();
  const shouldAnimate = cfg.startAnimation && animPageId !== page.id && !paging;
  animPageId = page.id;
  buildGridInto(grid, page, shouldAnimate);
}

/* ---------------- 分页圆点 ---------------- */
export function renderDots() {
  const wrap = document.getElementById('dots');
  if (!wrap) return;
  const { pages } = getState();
  const current = getCurrentPage();
  if (!current) return;
  /* 对标 Infinity：纯小圆点、不带「3/4」数字 */
  const num = document.getElementById('page-num');
  if (num) num.style.display = 'none';
  wrap.innerHTML = '';
  pages.forEach((page) => {
    const dot = document.createElement('button');
    dot.className = 'page-dot' + (page.id === current.id ? ' active' : '');
    dot.title = page.name;
    dot.addEventListener('click', () => {
      if (page.id === current.id) return;
      goToPage(page.id);
    });
    dot.addEventListener('contextmenu', (e) => { e.preventDefault(); app().openPageMenu?.(e, page.id); });
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
  /* 只有一页时圆点没有导航意义，底部只留「+」新建，视觉更干净 */
  wrap.style.display = pages.length > 1 ? '' : 'none';
}

export async function createPage() {
  const page = await addPage();
  setCurrentPage(page.id);
  renderAll();
  toast(`已新建「${page.name}」，右键圆点可重命名`);
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

/* ---------------- 翻页（三层轮播轨道） ---------------- */
let paging = false;
let swipeActive = false; /* 手势进行中（拖动未松手），此时 renderAll 不复位轨道 */

const trackEl = () => document.getElementById('pager-track');
const layerOf = (role) => document.querySelector(`#pager-track .page-layer[data-role="${role}"]`);
const currentLayer = () => layerOf('current');
const trackW = () => trackEl()?.clientWidth || 0;
const idleX = () => -trackW();

/** 轨道位移。transition 传空字符串时清除过渡（瞬移） */
function setTrackX(x, transition = '') {
  const t = trackEl();
  if (!t) return;
  t.style.transition = transition;
  t.style.transform = `translate3d(${x}px, 0, 0)`;
}

/** 带过渡的轨道滑动，返回动画完成 Promise（transitionend + 超时双保险） */
function trackSlide(x, { duration = 300, ease = 'cubic-bezier(0.32, 0.72, 0, 1)' } = {}) {
  return new Promise((resolve) => {
    const t = trackEl();
    if (!t) { resolve(); return; }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      t.removeEventListener('transitionend', finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, duration + 80);
    t.addEventListener('transitionend', finish);
    t.style.transition = `transform ${duration}ms ${ease}`;
    t.style.transform = `translate3d(${x}px, 0, 0)`;
  });
}

/** 重新指定三层角色并把 id="grid" 钉在当前层（order = [prev, current, next]） */
function assignRoles(order) {
  const t = trackEl();
  const roles = ['prev', 'current', 'next'];
  order.forEach((el, i) => {
    el.dataset.role = roles[i];
    t.appendChild(el); /* appendChild 移动既有节点，按序重排 */
  });
  order.forEach((el) => { if (el.id === 'grid' && el !== order[1]) el.removeAttribute('id'); });
  order[1].id = 'grid';
}

/** 换页提交后的 DOM 轮转：把已可见的邻层移到中间位，可见层内容零重建 */
function rotateCommit(dir) {
  const prev = layerOf('prev');
  const cur = layerOf('current');
  const next = layerOf('next');
  if (dir > 0) assignRoles([cur, next, prev]);
  else assignRoles([next, prev, cur]);
}

/**
 * 渲染两个离屏邻层（无邻页时清空该层，拖动时走橡皮筋）。
 * force=true 时无条件重建：页面 id 不变但内容可能已变（图标拖进相邻页等），
 * 离屏层重建无闪白代价；换页提交路径用 force=false 走 id 缓存。
 */
function renderNeighbors(force = false) {
  const cur = getCurrentPage();
  if (!cur) return;
  const { pages } = getState();
  const idx = pages.findIndex((p) => p.id === cur.id);
  const pairs = [
    [layerOf('prev'), idx > 0 ? pages[idx - 1] : null],
    [layerOf('next'), idx < pages.length - 1 ? pages[idx + 1] : null],
  ];
  pairs.forEach(([layer, page]) => {
    if (!layer) return;
    if (page) {
      if (force || layer.dataset.pageId !== page.id) buildGridInto(layer, page);
    } else {
      layer.innerHTML = '';
      delete layer.dataset.pageId;
    }
  });
}

/** 可达性：离屏层 inert + aria-hidden，防止 Tab 键与读屏进入未显示的页 */
function syncLayerA11y() {
  document.querySelectorAll('#pager-track .page-layer').forEach((layer) => {
    const off = layer.dataset.role !== 'current';
    layer.inert = off;
    if (off) layer.setAttribute('aria-hidden', 'true');
    else layer.removeAttribute('aria-hidden');
  });
}

/** 轨道高度同步为当前层内容高度，避免空页/满页切换导致布局跳动 */
function syncTrackHeight() {
  const t = trackEl();
  const cur = currentLayer();
  if (t && cur) t.style.height = cur.offsetHeight + 'px';
}

/**
 * 滑动换页：入场层先保证是目标页内容，动画结束后轮转 DOM + 瞬移复位。
 * 可见层全程不重建，图标不重新加载，无闪白。
 */
async function animateToPage(targetId, dir, opts = {}) {
  if (paging) return;
  const cur = getCurrentPage();
  if (!cur || targetId === cur.id) return;
  const t = trackEl();
  if (!t) { setCurrentPage(targetId); renderAll(); return; }
  const pages = getState().pages;
  const tIdx = pages.findIndex((p) => p.id === targetId);
  if (tIdx < 0) return;
  const cIdx = currentPageIndex();
  const step = dir ?? (tIdx > cIdx ? 1 : -1);
  paging = true;
  document.body.classList.add('swiping');
  /* 入场层内容必须就是目标页（跨多页跳转时邻层内容不对，需先构建） */
  const incoming = step > 0 ? layerOf('next') : layerOf('prev');
  if (incoming && incoming.dataset.pageId !== targetId) buildGridInto(incoming, pages[tIdx]);
  const w = t.clientWidth;
  await trackSlide(step > 0 ? -2 * w : 0, opts);
  t.style.transition = 'none';
  rotateCommit(step);
  setCurrentPage(targetId);
  const curL = currentLayer();
  if (curL && curL.dataset.pageId !== targetId) buildGridInto(curL, pages[tIdx]); /* 跨多页兜底 */
  setTrackX(idleX());
  void t.offsetWidth;
  t.style.transition = '';
  renderDots();
  renderNeighbors();
  syncTrackHeight();
  syncLayerA11y();
  paging = false;
  document.body.classList.remove('swiping');
  document.dispatchEvent(new CustomEvent('app-render'));
}

export function goToPage(pageId) {
  const pages = getState().pages;
  const idx = currentPageIndex();
  const target = pages.findIndex((p) => p.id === pageId);
  if (target < 0 || target === idx) return;
  animateToPage(pageId, target > idx ? 1 : -1);
}

/** 翻页：循环（对标 Infinity）——末页再向后回到首页、首页再向前回到末页；不自动新建空页 */
export async function goPage(delta) {
  const { pages } = getState();
  if (!pages.length) return;
  const idx = currentPageIndex();
  const n = pages.length;
  const targetIdx = ((idx + delta) % n + n) % n;
  if (targetIdx === idx) return;
  animateToPage(pages[targetIdx].id, delta >= 0 ? 1 : -1);
}

/** 网格方向键导航：监听挂在轨道上做委托，层轮转后依然有效 */
export function initGridKeys() {
  const t = trackEl();
  if (!t) return;
  t.addEventListener('keydown', (e) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!keys.includes(e.key)) return;
    const layer = e.target.closest?.('.page-layer');
    if (!layer || layer.dataset.role !== 'current') return;
    const cells = [...layer.querySelectorAll('.cell')];
    const idx = cells.indexOf(document.activeElement);
    if (idx < 0) return;
    e.preventDefault();
    const cols = Number(getComputedStyle(layer).gridTemplateColumns.split(' ').length) || 1;
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? cols : -cols;
    const target = cells[Math.max(0, Math.min(cells.length - 1, idx + step))];
    target?.focus();
  });
}

export function renderAll() {
  renderDots();
  renderGrid();
  renderNeighbors(true); /* 离屏层无条件重建：id 未变但内容可能已变 */
  syncTrackHeight();
  syncLayerA11y();
  if (!paging && !swipeActive) setTrackX(idleX()); /* 手势/动画进行中不打断轨道 */
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
    if (e.ctrlKey || e.metaKey) return;
    if (e.target.closest('#dock, #pager')) return;
    const now = Date.now();
    if (now - last < 520) return;
    /* 最后一页继续下滑时由 goPage 自动新建分页 */
    if (Math.abs(e.deltaY) < 18) return;
    e.preventDefault();
    last = now;
    goPage(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
}

/** 轨道高度自适应：任何层内容尺寸变化都重新同步（层元素常驻，观察一次即可） */
function initTrackResize() {
  const t = trackEl();
  if (!t) return;
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => syncTrackHeight());
    t.querySelectorAll('.page-layer').forEach((layer) => ro.observe(layer));
  }
  /* 窗口尺寸变化（全屏/窗口化/缩放）时重算轨道高度，避免布局偏离；用 rAF 等布局 reflow 完成再读 offsetHeight，防止读到旧值 */
  window.addEventListener('resize', () => {
    requestAnimationFrame(() => requestAnimationFrame(() => syncTrackHeight()));
  });
}

/**
 * 空白处按住左键左右拖动翻页（三层轮播）：
 * 当前页跟手横移、邻页同步露出；松手按「位移阈值 + 甩动速度」提交；
 * 首/末页超拉为 Apple 风格橡皮筋；全程只用 transform，无淡出。
 */
export function initSwipePaging() {
  const home = document.getElementById('home');
  const t = trackEl();
  if (!home || !t) return;
  initTrackResize();

  const blocked = (el) => el.closest('.cell, #dock, #pager, #search-wrap, #windmill, #topbar, .modal, #panel, .page-drop, .popover');
  /* Apple 风格橡皮筋：越拉越沉，视觉上限约为视口宽度的 1/3 */
  const rubber = (over, w, C = 0.55) => (over * w * C) / (w + C * Math.abs(over));

  let pid = null, startX = 0, startY = 0, dx = 0, appliedX = 0, decided = false, active = false;
  let samples = []; /* {t, x} 最近 120ms 位移采样，用于估算甩动速度 */

  const W = () => t.clientWidth;

  /* 拖动过的松手，吞掉紧随其后的 click，防止误开站点 */
  const suppressNextClick = () => {
    const kill = (e) => { e.preventDefault(); e.stopPropagation(); };
    document.addEventListener('click', kill, { capture: true, once: true });
    setTimeout(() => document.removeEventListener('click', kill, { capture: true }), 450);
  };

  /* 用松手时刻重新过滤采样：最后一段位移距松手 >80ms 视为已停住，速度按 0，
     避免「快拖一下 → 停住 → 再松手」被误判成甩动翻页 */
  const velocity = (now) => {
    const recent = samples.filter((s) => now - s.t <= 100);
    if (recent.length < 2 || now - recent[recent.length - 1].t > 80) return 0;
    const a = recent[0];
    const b = recent[recent.length - 1];
    if (b.t === a.t) return 0;
    return Math.max(-1.2, Math.min(1.2, (b.x - a.x) / (b.t - a.t)));
  };

  const springBack = () => trackSlide(idleX(), { duration: 260, ease: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });

  home.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || active || paging) return;
    if (document.body.classList.contains('panel-open')) return;
    if (document.querySelector('.modal.open')) return;
    if (blocked(e.target)) return;
    /* 空白处按下即拦掉原生拖拽：轨道跟手横移后，原本在右侧的 .cell 会滑到指针下方，
       Chrome 会把那个 draggable 图标当成拖拽源，抢走手势并把图标拖到别的页 */
    e.preventDefault();
    pid = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    decided = false;
    active = true;
    samples = [{ t: e.timeStamp, x: 0 }];
  });

  window.addEventListener('pointermove', (e) => {
    if (!active || e.pointerId !== pid) return;
    const moveX = e.clientX - startX;
    const moveY = e.clientY - startY;
    if (!decided) {
      /* 方向锁：明显竖向拖动交给页面其它手势 */
      if (Math.abs(moveY) > Math.abs(moveX) * 1.2 && Math.abs(moveY) > 10) { active = false; return; }
      if (Math.abs(moveX) < 8) return; /* 死区 */
      decided = true;
      swipeActive = true;
      document.body.classList.add('swiping');
    }
    dx = moveX;
    const w = W();
    const pages = getState().pages;
    const idx = currentPageIndex();
    /* 无邻页方向 → 橡皮筋阻尼；有邻页 → 纯跟手 */
    if (moveX < 0 && idx >= pages.length - 1) appliedX = -rubber(-moveX, w);
    else if (moveX > 0 && idx <= 0) appliedX = rubber(moveX, w);
    else appliedX = moveX;
    t.style.transition = 'none';
    t.style.transform = `translate3d(${idleX() + appliedX}px, 0, 0)`;
    samples.push({ t: e.timeStamp, x: moveX });
    const now = e.timeStamp;
    samples = samples.filter((s) => now - s.t <= 120);
    e.preventDefault();
  }, { passive: false });

  const end = (e) => {
    if (!active || (e.pointerId !== pid && e.type !== 'pointercancel')) return;
    active = false;
    swipeActive = false;
    pid = null;
    document.body.classList.remove('swiping');
    if (!decided) return;
    decided = false;
    if (Math.abs(dx) >= 8) suppressNextClick();
    const w = W();
    const pages = getState().pages;
    const idx = currentPageIndex();
    const v = velocity(e.timeStamp);
    const threshold = Math.min(0.22 * w, 160);
    const canNext = idx < pages.length - 1;
    const canPrev = idx > 0;
    const flick = Math.abs(v) >= 0.35 && Math.abs(dx) >= 12;
    if (dx < 0 && canNext && (Math.abs(dx) >= threshold || (v <= -0.35 && flick))) {
      animateToPage(pages[idx + 1].id, 1, { duration: Math.abs(v) > 0.6 ? 240 : 300 });
    } else if (dx > 0 && canPrev && (Math.abs(dx) >= threshold || (v >= 0.35 && flick))) {
      animateToPage(pages[idx - 1].id, -1, { duration: Math.abs(v) > 0.6 ? 240 : 300 });
    } else {
      springBack(); /* 含首/末页超拉：橡皮筋回弹 */
    }
    dx = 0;
  };

  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

export function refreshWeatherLabel() { renderGrid(); }

export { WIDGETS };
