/* contextmenu.js — 自定义右键菜单（站点卡 / 文件夹卡）+ 通用确认弹窗 + 跨分页移动 */
import { getState, getSite, moveSiteToPage, deleteSite } from './store.js';
import { db } from './db.js';
import { openSiteEditor, renameFolder, openAllFolderSites, removeFolder, createFolderFromSite } from './folder.js';
import { renderAll } from './render.js';
import { toast, escapeHtml } from './utils.js';

const menu = document.getElementById('context-menu');

function placeMenu(x, y) {
  menu.classList.remove('modal-hidden');
  menu.style.left = '0px'; menu.style.top = '0px';
  const rect = menu.getBoundingClientRect();
  let left = Math.min(x, window.innerWidth - rect.width - 8);
  let top = Math.min(y, window.innerHeight - rect.height - 8);
  menu.style.left = Math.max(4, left) + 'px';
  menu.style.top = Math.max(4, top) + 'px';
}

function hideMenu() { menu.classList.add('modal-hidden'); menu.innerHTML = ''; }

function addItem(label, onClick, opts = {}) {
  const div = document.createElement('div');
  div.className = 'ctx-item' + (opts.sub ? ' ctx-sub' : '');
  div.textContent = label;
  if (opts.submenu) {
    const sub = document.createElement('div');
    sub.className = 'ctx-submenu';
    opts.submenu(sub);
    div.appendChild(sub);
  } else {
    div.addEventListener('click', () => { hideMenu(); onClick && onClick(); });
  }
  menu.appendChild(div);
}
function addSep() { const d = document.createElement('div'); d.className = 'ctx-sep'; menu.appendChild(d); }

function pageSubmenu(container, handler) {
  const pages = getState().pages;
  pages.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'ctx-item';
    item.textContent = p.name;
    item.addEventListener('click', (e) => { e.stopPropagation(); hideMenu(); handler(p); });
    container.appendChild(item);
  });
}

window.__openSiteMenu = function (e, siteId) {
  const site = getSite(siteId);
  if (!site) return;
  menu.innerHTML = '';
  addItem('编辑', () => openSiteEditor(siteId));
  addItem('复制网址', async () => {
    try { await navigator.clipboard.writeText(site.url); toast('已复制网址'); }
    catch (err) { toast('复制失败'); }
  });
  addItem('移动至', null, { sub: true, submenu: (sub) => {
    pageSubmenu(sub, async (page) => {
      await moveSiteToPage(siteId, page.id);
      await db.put('sites', Object.assign(site, { pageId: page.id }));
      renderAll();
      toast(`已移动到「${page.name}」`);
    });
  }});
  addItem('新建文件夹', () => createFolderFromSite(siteId));
  addItem('添加到分页', null, { sub: true, submenu: (sub) => {
    pageSubmenu(sub, async (page) => {
      if (!page.siteIds.includes(siteId)) page.siteIds.push(siteId);
      await db.put('pages', page);
      renderAll();
      toast(`已添加到「${page.name}」（保留原分页）`);
    });
  }});
  addSep();
  addItem('删除', async () => {
    const ok = await window.__confirm(`确认删除「${site.name}」？该操作会从所有分页和文件夹中移除并删除站点本体。`);
    if (!ok) return;
    await deleteSite(siteId);
    renderAll();
    toast('站点已删除');
  }, );
  placeMenu(e.clientX, e.clientY);
};

window.__openFolderMenu = function (e, folderId) {
  menu.innerHTML = '';
  addItem('编辑文件夹', () => renameFolder(folderId));
  addItem('打开全部', () => openAllFolderSites(folderId));
  addItem('重命名', () => renameFolder(folderId));
  addSep();
  addItem('删除文件夹', () => removeFolder(folderId));
  placeMenu(e.clientX, e.clientY);
};

export function initContextMenu() {
  document.addEventListener('click', () => hideMenu());
  document.addEventListener('scroll', () => hideMenu(), true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideMenu(); });
  window.addEventListener('resize', hideMenu);
}

let confirmResolver = null;
export function initConfirm() {
  const modal = document.getElementById('confirm-modal');
  document.getElementById('confirm-ok').addEventListener('click', () => {
    modal.classList.add('modal-hidden');
    confirmResolver && confirmResolver(true); confirmResolver = null;
  });
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    modal.classList.add('modal-hidden');
    confirmResolver && confirmResolver(false); confirmResolver = null;
  });
  document.getElementById('folder-overlay').addEventListener('click', () => {});
}

window.__confirm = function (text) {
  return new Promise((resolve) => {
    confirmResolver = resolve;
    document.getElementById('confirm-text').textContent = text;
    document.getElementById('confirm-modal').classList.remove('modal-hidden');
  });
};
