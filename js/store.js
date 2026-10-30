/* store.js — 数据层：站点 / 文件夹 / 分页 / 壁纸 / 待办 / 笔记（id 引用模型） */
import { db } from './db.js';
import { uid } from './utils.js';
import { loadConfig, saveConfig, loadMeta, saveMeta, currentLayout } from './config.js';
import { DEFAULT_SITES } from './presets.js';

export const WIDGET_IDS = ['widget-weather', 'widget-todo', 'widget-note', 'widget-folder', 'widget-walls', 'widget-settings'];

const state = {
  sites: [], folders: [], pages: [], wallpapers: [], todos: [],
  note: { id: 'main', text: '' },
  currentPageId: null,
};

function purgeDock(id) {
  const cfg = loadConfig();
  if (Array.isArray(cfg.dockIds) && cfg.dockIds.includes(id)) {
    saveConfig({ dockIds: cfg.dockIds.filter((x) => x !== id) }, { silent: true });
  }
}

async function hydrate() {
  const [sites, folders, pages, wallpapers, todos, notes] = await Promise.all([
    db.getAll('sites'), db.getAll('folders'), db.getAll('pages'),
    db.getAll('wallpapers'), db.getAll('todos'), db.getAll('notes'),
  ]);
  state.sites = sites; state.folders = folders;
  state.pages = pages.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  state.wallpapers = wallpapers;
  state.todos = todos.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  state.note = notes.find((n) => n.id === 'main') || { id: 'main', text: '' };
}

async function seed() {
  const meta = loadMeta();
  if (state.pages.length === 0) {
    const page = { id: uid('page'), name: '第 1 页', siteIds: [], sortOrder: 0 };
    await db.put('pages', page);
    state.pages.push(page);
  }
  if (!state.currentPageId) state.currentPageId = state.pages[0].id;
  if (!meta.seeded && state.sites.length === 0) {
    const page = state.pages[0];
    for (const item of DEFAULT_SITES) {
      const site = makeSite(item, page.id);
      await db.put('sites', site);
      state.sites.push(site);
      if (page.siteIds.length < capacityOfPage(page.id)) page.siteIds.push(site.id);
    }
    await db.put('pages', page);
    saveMeta({ seeded: true });
  }
}

function makeSite(data, pageId) {
  return {
    id: uid('site'),
    name: data.name || '',
    url: data.url,
    color: data.color || '#4c8bf5',
    iconType: data.iconType || 'auto',
    iconValue: data.iconValue || '',
    description: data.description || data.desc || '',
    pageId: pageId || state.currentPageId,
    createdAt: Date.now(),
  };
}

export async function initStore() {
  await hydrate();
  const migrated = await migrateFromV1();
  if (!migrated) await seed();
  return state;
}

/** 从 v1（豆包版）数据库/配置迁移，保证老用户数据不丢 */
async function migrateFromV1() {
  const meta = loadMeta();
  if (meta.migrated || meta.seeded) return false;
  let old = null;
  try {
    old = await new Promise((resolve) => {
      let created = false;
      const req = indexedDB.open('infinity_newtab', 1);
      req.onerror = () => resolve(null);
      req.onupgradeneeded = () => { created = true; };
      req.onsuccess = () => {
        const d = req.result;
        if (created || !d.objectStoreNames.contains('sites')) { d.close(); resolve(null); return; }
        resolve(d);
      };
    });
    if (!old) return false;
    const names = ['sites', 'folders', 'pages', 'wallpapers', 'todos'].filter((n) => old.objectStoreNames.contains(n));
    const tx = old.transaction(names, 'readonly');
    const data = {};
    await Promise.all(names.map((n) => new Promise((resolve) => {
      const r = tx.objectStore(n).getAll();
      r.onsuccess = () => { data[n] = r.result || []; resolve(); };
      r.onerror = () => { data[n] = []; resolve(); };
    })));
    if (!(data.sites || []).length && !(data.pages || []).length) {
      old.close();
      return false;
    }
    await db.replaceAll({
      sites: data.sites || [], folders: data.folders || [], pages: data.pages || [],
      wallpapers: data.wallpapers || [], todos: data.todos || [], notes: [],
    });
    let oldCfg = {};
    try { oldCfg = JSON.parse(localStorage.getItem('infinity_config_v1') || '{}') || {}; } catch (e) { oldCfg = {}; }
    const map = {
      wallpaperMaskAlpha: 'wallMask', wallpaperBlur: 'wallBlur', wallpaperAutoRotate: 'wallAuto',
      wallpaperRotateInterval: 'wallInterval', wallpaperFavoriteOnly: 'wallFavoriteOnly',
      openSiteNewTab: 'openSiteNewTab', openSearchNewTab: 'openSearchNewTab',
      openBookmarkNewTab: 'openBookmarkNewTab', openHistoryNewTab: 'openHistoryNewTab',
      searchEngine: 'searchEngine', searchCategory: 'searchCategory',
      hideSearch: 'hideSearch', showSuggestions: 'searchSuggest', keepSearchContent: 'keepSearchInput',
      hideSearchCategory: 'hideSearchCategory', hideSearchButton: 'hideSearchButton',
      searchSize: 'searchScale', searchRadius: 'searchRadius', searchOpacity: 'searchOpacity',
      iconRadius: 'iconRadius', iconOpacity: 'iconOpacity', iconSize: 'iconScale',
      hideIconName: 'hideIconName', iconShadow: 'iconShadow', startAnimation: 'startAnimation',
      fontSize: 'fontSize', fontColor: 'fontColor', fontShadow: 'fontShadow',
      showWindmill: 'showWindmill', showPageButtons: 'showPageArrows', layoutId: 'layoutId',
    };
    const patch = {};
    Object.entries(map).forEach(([from, to]) => {
      if (oldCfg[from] !== undefined) patch[to] = oldCfg[from];
    });
    if (patch.iconRadius !== undefined && patch.iconRadius <= 20) patch.iconRadius = Math.min(50, Math.round(patch.iconRadius * 2.5));
    if (patch.iconSize !== undefined && patch.iconSize > 2) patch.iconScale = 1;
    if (Object.keys(patch).length) saveConfig(patch, { silent: true });
    await hydrate();
    state.currentPageId = state.pages[0]?.id || null;
    saveMeta({ migrated: true, seeded: true });
    old.close();
    return true;
  } catch (e) {
    try { old?.close(); } catch (err) { /* ignore */ }
    return false;
  }
}

export function getState() { return state; }
export function getCurrentPage() {
  return state.pages.find((p) => p.id === state.currentPageId) || state.pages[0];
}
export function currentPageIndex() {
  const page = getCurrentPage();
  return Math.max(0, state.pages.findIndex((p) => p.id === page.id));
}
export function setCurrentPage(id) {
  if (state.pages.some((p) => p.id === id)) state.currentPageId = id;
}
export function getSite(id) { return state.sites.find((s) => s.id === id) || null; }
export function getFolder(id) { return state.folders.find((f) => f.id === id) || null; }
export function getPage(id) { return state.pages.find((p) => p.id === id) || null; }

/* ---------------- 容量 ---------------- */
/** 小组件作为“虚拟条目”放进分页，才能和站点一起拖拽/排序 */
export async function syncWidgetSlots() {
  const cfg = loadConfig();
  const present = new Set();
  let changed = false;
  state.pages.forEach((page) => {
    const before = page.siteIds.length;
    page.siteIds = page.siteIds.filter((id) => {
      if (!WIDGET_IDS.includes(id)) return true;
      if (!cfg.showWidgets) return false;
      if (present.has(id)) return false;
      present.add(id);
      return true;
    });
    if (page.siteIds.length !== before) changed = true;
  });
  if (cfg.showWidgets && state.pages[0]) {
    const missing = WIDGET_IDS.filter((id) => !present.has(id));
    if (missing.length) {
      state.pages[0].siteIds = [...missing, ...state.pages[0].siteIds];
      changed = true;
    }
  }
  if (changed) await Promise.all(state.pages.map((p) => db.put('pages', p)));
}

export function capacityOfPage(pageId) {
  const layout = currentLayout();
  return Math.max(1, layout.rows * layout.cols);
}

/** 从指定分页开始找有空间的分页；都满则新建一页 */
async function findSpace(startPageId, extra = 1) {
  const start = Math.max(0, state.pages.findIndex((p) => p.id === startPageId));
  for (let i = start; i < state.pages.length; i++) {
    const p = state.pages[i];
    if (p.siteIds.length + extra <= capacityOfPage(p.id)) return p.id;
  }
  const page = await addPage();
  return page.id;
}

/* ---------------- 站点 ---------------- */
export async function addSite(data) {
  const startPage = data.pageId || state.currentPageId;
  const targetId = await findSpace(startPage, 1);
  const site = makeSite(data, targetId);
  await db.put('sites', site);
  state.sites.push(site);
  const page = getPage(targetId);
  if (page && !page.siteIds.includes(site.id)) {
    page.siteIds.push(site.id);
    await db.put('pages', page);
  }
  return { site, pageId: targetId, moved: targetId !== startPage };
}

/** 记录一次打开，用于「按使用频率排序」 */
export function recordVisit(id) {
  const site = getSite(id);
  if (!site) return;
  site.clicks = Number(site.clicks || 0) + 1;
  site.lastOpenedAt = Date.now();
  db.put('sites', site).catch(() => {});
}

export async function updateSite(id, patch) {
  const site = getSite(id);
  if (!site) return null;
  Object.assign(site, patch);
  await db.put('sites', site);
  return site;
}

/** 其他新标签页改库后重新读取，保留当前浏览的分页 */
export async function reloadFromDB() {
  await hydrate();
  if (!state.pages.some((p) => p.id === state.currentPageId)) {
    state.currentPageId = state.pages[0]?.id || null;
  }
}

export async function deleteSite(id) {
  state.sites = state.sites.filter((s) => s.id !== id);
  purgeDock(id);
  state.pages.forEach((p) => { p.siteIds = p.siteIds.filter((x) => x !== id); });
  state.folders.forEach((f) => { f.iconIds = f.iconIds.filter((x) => x !== id); });
  await db.delete('sites', id);
  await Promise.all(state.pages.map((p) => db.put('pages', p)));
  await Promise.all(state.folders.map((f) => db.put('folders', f)));
}

/** 删除前记录归属关系，供撤销使用 */
export function snapshotSiteLinks() {
  return {
    pages: state.pages.map((p) => ({ id: p.id, siteIds: [...p.siteIds] })),
    folders: state.folders.map((f) => ({ id: f.id, iconIds: [...f.iconIds] })),
  };
}

/** 撤销删除站点：恢复站点本体及其分页 / 文件夹归属 */
export async function undoDeleteSite(site, snapshot) {
  if (!site) return false;
  await db.put('sites', site);
  if (!getSite(site.id)) state.sites.push(site);
  for (const p of snapshot.pages) {
    const page = getPage(p.id);
    if (!page) continue;
    page.siteIds = [...p.siteIds];
    await db.put('pages', page);
  }
  for (const f of snapshot.folders) {
    const folder = getFolder(f.id);
    if (!folder) continue;
    folder.iconIds = [...f.iconIds];
    await db.put('folders', folder);
  }
  await reflowPages();
  return true;
}

/** 把条目从所有分页里移除（用于收纳进文件夹，站点本体保留） */
export async function detachItemFromPages(itemId) {
  state.pages.forEach((p) => { p.siteIds = p.siteIds.filter((x) => x !== itemId); });
  await Promise.all(state.pages.map((p) => db.put('pages', p)));
}

export async function moveItemToPage(itemId, targetPageId) {
  state.pages.forEach((p) => { p.siteIds = p.siteIds.filter((x) => x !== itemId); });
  const target = getPage(targetPageId);
  if (target && !target.siteIds.includes(itemId)) target.siteIds.push(itemId);
  if (target) {
    const site = getSite(itemId);
    if (site) { site.pageId = targetPageId; await db.put('sites', site); }
  }
  await Promise.all(state.pages.map((p) => db.put('pages', p)));
}

/* ---------------- 分页 ---------------- */
export async function addPage(name) {
  const maxOrder = state.pages.reduce((m, p) => Math.max(m, p.sortOrder || 0), -1);
  const page = {
    id: uid('page'),
    name: name || `第 ${state.pages.length + 1} 页`,
    siteIds: [],
    sortOrder: maxOrder + 1,
  };
  await db.put('pages', page);
  state.pages.push(page);
  return page;
}

/** 删除分页：把该页内容迁到第一个分页，绝不丢站点 */
export async function deletePage(id) {
  if (state.pages.length <= 1) throw new Error('至少保留一个分页');
  const idx = state.pages.findIndex((p) => p.id === id);
  if (idx < 0) return;
  const leaving = state.pages[idx];
  state.pages.splice(idx, 1);
  const target = state.pages[0];
  leaving.siteIds.forEach((itemId) => {
    if (!target.siteIds.includes(itemId)) target.siteIds.push(itemId);
    const site = getSite(itemId);
    if (site) { site.pageId = target.id; db.put('sites', site); }
  });
  await db.put('pages', target);
  await db.delete('pages', id);
  if (state.currentPageId === id) state.currentPageId = target.id;
  /* 合并后第 1 页可能超容量，重排到后续分页 */
  await reflowPages();
}

export async function renamePage(id, name) {
  const page = getPage(id);
  if (!page) return;
  page.name = String(name || '').trim() || page.name;
  await db.put('pages', page);
}

export async function reorderPages(orderIds) {
  const byId = new Map(state.pages.map((p) => [p.id, p]));
  const next = orderIds.map((id) => byId.get(id)).filter(Boolean);
  next.forEach((p, i) => { p.sortOrder = i; });
  state.pages = next;
  await Promise.all(state.pages.map((p) => db.put('pages', p)));
}

export async function reorderPageItems(pageId, orderedIds) {
  const page = getPage(pageId);
  if (!page) return;
  page.siteIds = orderedIds;
  await db.put('pages', page);
}

/** 布局变化后重排：把每页超出的图标顺延到后面的分页，必要时新建分页 */
export async function reflowPages() {
  let i = 0;
  let guard = 0;
  while (i < state.pages.length && guard < 200) {
    guard++;
    const page = state.pages[i];
    const cap = capacityOfPage(page.id);
    if (page.siteIds.length > cap) {
      const overflow = page.siteIds.splice(cap);
      let j = i + 1;
      while (overflow.length) {
        if (j >= state.pages.length) await addPage();
        const target = state.pages[j];
        const room = Math.max(0, capacityOfPage(target.id) - target.siteIds.length);
        if (room > 0) {
          target.siteIds.push(...overflow.splice(0, room));
          await db.put('pages', target);
        }
        j++;
        if (j > 300) break;
      }
      await db.put('pages', page);
    }
    i++;
  }
  // 布局变大时把后面分页的内容回收，避免留下空分页
  for (let a = 0; a < state.pages.length; a++) {
    const page = state.pages[a];
    let room = capacityOfPage(page.id) - page.siteIds.length;
    let b = a + 1;
    while (room > 0 && b < state.pages.length) {
      const target = state.pages[b];
      if (target.siteIds.length) {
        const take = target.siteIds.splice(0, room);
        page.siteIds.push(...take);
        room -= take.length;
        take.forEach((id) => { const site = getSite(id); if (site) { site.pageId = page.id; db.put('sites', site); } });
        await db.put('pages', target);
        await db.put('pages', page);
      }
      b++;
    }
  }
  for (let a = state.pages.length - 1; a >= 1; a--) {
    if (state.pages[a].siteIds.length === 0) {
      const id = state.pages[a].id;
      state.pages.splice(a, 1);
      await db.delete('pages', id);
    }
  }
}

/* ---------------- 文件夹 ---------------- */
export async function addFolder(name, iconIds = [], { placeOnPage = true } = {}) {
  const folder = { id: uid('folder'), name: String(name || '新建文件夹').trim() || '新建文件夹', iconIds: [...iconIds], createdAt: Date.now() };
  await db.put('folders', folder);
  state.folders.push(folder);
  if (placeOnPage) {
    const targetId = await findSpace(state.currentPageId, 1);
    const page = getPage(targetId);
    page.siteIds.push(folder.id);
    await db.put('pages', page);
  }
  return folder;
}

export async function updateFolder(id, patch) {
  const folder = getFolder(id);
  if (!folder) return null;
  Object.assign(folder, patch);
  await db.put('folders', folder);
  return folder;
}

/** 删除文件夹：成员站点释放回第一页，不删除站点 */
export async function deleteFolder(id) {
  const folder = getFolder(id);
  if (!folder) return;
  state.folders = state.folders.filter((f) => f.id !== id);
  purgeDock(id);
  state.pages.forEach((p) => { p.siteIds = p.siteIds.filter((x) => x !== id); });
  const first = state.pages[0];
  folder.iconIds.forEach((siteId) => {
    if (getSite(siteId) && !state.pages.some((p) => p.siteIds.includes(siteId))) {
      first.siteIds.push(siteId);
    }
  });
  await db.delete('folders', id);
  await Promise.all(state.pages.map((p) => db.put('pages', p)));
  /* 成员站点回填第 1 页后可能超容量，重排到后续分页 */
  await reflowPages();
}

export async function addSiteToFolder(folderId, siteId) {
  const folder = getFolder(folderId);
  if (folder && !folder.iconIds.includes(siteId)) {
    folder.iconIds.push(siteId);
    await db.put('folders', folder);
  }
}

export async function removeSiteFromFolder(folderId, siteId) {
  const folder = getFolder(folderId);
  if (!folder) return;
  folder.iconIds = folder.iconIds.filter((x) => x !== siteId);
  await db.put('folders', folder);
  const first = state.pages[0];
  if (getSite(siteId) && !state.pages.some((p) => p.siteIds.includes(siteId))) {
    first.siteIds.push(siteId);
    await db.put('pages', first);
    await reflowPages();
  }
}

export async function reorderFolder(folderId, iconIds) {
  const folder = getFolder(folderId);
  if (!folder) return;
  folder.iconIds = iconIds;
  await db.put('folders', folder);
}

/* ---------------- 壁纸 ---------------- */
export async function addWallpaper(data) {
  const wp = {
    id: data.id || uid('wp'),
    src: data.src,
    type: data.type || 'builtin',
    name: data.name || '',
    favorite: !!data.favorite,
    addedAt: data.addedAt || Date.now(),
  };
  await db.put('wallpapers', wp);
  state.wallpapers.push(wp);
  return wp;
}
export async function updateWallpaper(id, patch) {
  const wp = state.wallpapers.find((w) => w.id === id);
  if (!wp) return null;
  Object.assign(wp, patch);
  await db.put('wallpapers', wp);
  return wp;
}
export async function deleteWallpaper(id) {
  state.wallpapers = state.wallpapers.filter((w) => w.id !== id);
  await db.delete('wallpapers', id);
}
export function getWallpaper(id) { return state.wallpapers.find((w) => w.id === id) || null; }

/* ---------------- 待办 ---------------- */
export async function addTodo(text) {
  const todo = { id: uid('todo'), text: String(text || '').trim(), done: false, createdAt: Date.now() };
  if (!todo.text) return null;
  await db.put('todos', todo);
  state.todos.push(todo);
  return todo;
}
export async function toggleTodo(id, done) {
  const todo = state.todos.find((t) => t.id === id);
  if (!todo) return;
  todo.done = done;
  await db.put('todos', todo);
}
export async function deleteTodo(id) {
  state.todos = state.todos.filter((t) => t.id !== id);
  await db.delete('todos', id);
}
export function pendingTodoCount() { return state.todos.filter((t) => !t.done).length; }

/* ---------------- 笔记 ---------------- */
export async function saveNote(text) {
  state.note = { id: 'main', text: String(text || ''), updatedAt: Date.now() };
  await db.put('notes', state.note);
  return state.note;
}
export function getNote() { return state.note; }

/* ---------------- 备份 ---------------- */
export async function exportAll() {
  return {
    sites: await db.getAll('sites'),
    folders: await db.getAll('folders'),
    pages: await db.getAll('pages'),
    wallpapers: await db.getAll('wallpapers'),
    todos: await db.getAll('todos'),
    notes: await db.getAll('notes'),
  };
}

export async function importAll(data) {
  await db.replaceAll({
    sites: data.sites || [],
    folders: data.folders || [],
    pages: data.pages || [],
    wallpapers: data.wallpapers || [],
    todos: data.todos || [],
    notes: data.notes || [],
  });
  await hydrate();
  if (state.pages.length === 0) await seed();
  state.currentPageId = state.pages[0].id;
  return state;
}
