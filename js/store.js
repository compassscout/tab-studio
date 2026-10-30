/* store.js — 数据层 CRUD：站点 / 文件夹 / 分页 / 壁纸 / 待办（id 引用模型） */
import { db } from './db.js';
import { uid } from './utils.js';

const state = {
  sites: [], folders: [], pages: [], wallpapers: [], todos: [],
  currentPageId: null,
};

async function hydrate() {
  [state.sites, state.folders, state.pages, state.wallpapers, state.todos] = await Promise.all([
    db.getAll('sites'), db.getAll('folders'), db.getAll('pages'), db.getAll('wallpapers'), db.getAll('todos'),
  ]);
}

async function ensureSeeded() {
  if (state.pages.length === 0) {
    const page = { id: uid(), name: '第 1 页', siteIds: [], sortOrder: 0 };
    await db.put('pages', page);
    state.pages.push(page);
  }
  if (!state.currentPageId) state.currentPageId = state.pages[0].id;
}

export async function initStore() {
  await hydrate();
  await ensureSeeded();
  return state;
}

export function getState() { return state; }
export function getCurrentPage() { return state.pages.find((p) => p.id === state.currentPageId) || state.pages[0]; }
export function setCurrentPageId(id) { state.currentPageId = id; }
export function getSite(id) { return state.sites.find((s) => s.id === id); }
export function getFolder(id) { return state.folders.find((f) => f.id === id); }

export async function addSite({ name, url, iconType, iconValue, color, description, pageId }) {
  const site = {
    id: uid(), name: name || '', url,
    iconType: iconType || 'color',
    iconValue: iconValue || '',
    color: color || '#4c8bf5',
    description: description || '',
    pageId: pageId || state.currentPageId,
  };
  await db.put('sites', site);
  state.sites.push(site);
  const page = state.pages.find((p) => p.id === site.pageId);
  if (page && !page.siteIds.includes(site.id)) {
    page.siteIds.push(site.id);
    await db.put('pages', page);
  }
  return site;
}

export async function updateSite(id, patch) {
  const site = getSite(id);
  if (!site) return null;
  Object.assign(site, patch);
  await db.put('sites', site);
  return site;
}

export async function deleteSite(id) {
  state.sites = state.sites.filter((s) => s.id !== id);
  state.pages.forEach((p) => { p.siteIds = p.siteIds.filter((x) => x !== id); });
  state.folders.forEach((f) => { f.iconIds = f.iconIds.filter((x) => x !== id); });
  await db.delete('sites', id);
  await Promise.all(state.pages.map((p) => db.put('pages', p)));
  await Promise.all(state.folders.map((f) => db.put('folders', f)));
}

export async function addPage(name) {
  const maxOrder = state.pages.reduce((m, p) => Math.max(m, p.sortOrder || 0), -1);
  const page = { id: uid(), name: name || `第 ${state.pages.length + 1} 页`, siteIds: [], sortOrder: maxOrder + 1 };
  await db.put('pages', page);
  state.pages.push(page);
  return page;
}

export async function removePage(id) {
  const idx = state.pages.findIndex((p) => p.id === id);
  if (idx < 0) return;
  if (state.pages.length <= 1) { throw new Error('至少保留一个分页'); }
  state.pages.splice(idx, 1);
  await db.delete('pages', id);
  if (state.currentPageId === id) state.currentPageId = state.pages[Math.min(idx, state.pages.length - 1)].id;
}

export async function moveSiteToPage(siteId, targetPageId) {
  state.pages.forEach((p) => { p.siteIds = p.siteIds.filter((x) => x !== siteId); });
  const target = state.pages.find((p) => p.id === targetPageId);
  if (target && !target.siteIds.includes(siteId)) target.siteIds.push(siteId);
  await Promise.all(state.pages.map((p) => db.put('pages', p)));
}

export async function reorderPage(pageId, siteIds) {
  const page = state.pages.find((p) => p.id === pageId);
  if (!page) return;
  page.siteIds = siteIds;
  await db.put('pages', page);
}

export async function addFolder(name, iconIds = []) {
  const folder = { id: uid(), name, iconIds: [...iconIds] };
  await db.put('folders', folder);
  state.folders.push(folder);
  return folder;
}

export async function updateFolder(id, patch) {
  const folder = getFolder(id);
  if (!folder) return null;
  Object.assign(folder, patch);
  await db.put('folders', folder);
  return folder;
}

export async function deleteFolder(id) {
  state.folders = state.folders.filter((f) => f.id !== id);
  await db.delete('folders', id);
}

export async function addSiteToFolder(folderId, siteId) {
  const f = getFolder(folderId);
  if (f && !f.iconIds.includes(siteId)) { f.iconIds.push(siteId); await db.put('folders', f); }
}

export async function removeSiteFromFolder(folderId, siteId) {
  const f = getFolder(folderId);
  if (f) { f.iconIds = f.iconIds.filter((x) => x !== siteId); await db.put('folders', f); }
}

export async function reorderFolder(folderId, iconIds) {
  const f = getFolder(folderId);
  if (f) { f.iconIds = iconIds; await db.put('folders', f); }
}

export async function addWallpaper({ src, favorite = false }) {
  const wp = { id: uid(), src, favorite: !!favorite, addedAt: Date.now() };
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

export async function saveTodoText(text) {
  let todo = state.todos[0];
  if (!todo) {
    todo = { id: uid(), text: '', done: false, createdAt: Date.now(), updatedAt: Date.now() };
    state.todos.push(todo);
  }
  todo.text = text;
  todo.updatedAt = Date.now();
  await db.put('todos', todo);
  return todo;
}

export async function exportAll() {
  return {
    sites: await db.getAll('sites'),
    folders: await db.getAll('folders'),
    pages: await db.getAll('pages'),
    wallpapers: await db.getAll('wallpapers'),
    todos: await db.getAll('todos'),
  };
}

export async function importAll(data) {
  await db.clear('sites'); await db.clear('folders'); await db.clear('pages');
  await db.clear('wallpapers'); await db.clear('todos');
  state.sites = data.sites || [];
  state.folders = data.folders || [];
  state.pages = data.pages || [];
  state.wallpapers = data.wallpapers || [];
  state.todos = data.todos || [];
  await Promise.all([
    db.bulkPut('sites', state.sites), db.bulkPut('folders', state.folders),
    db.bulkPut('pages', state.pages), db.bulkPut('wallpapers', state.wallpapers),
    db.bulkPut('todos', state.todos),
  ]);
  if (state.pages.length === 0) await ensureSeeded();
  state.currentPageId = state.pages[0].id;
}
