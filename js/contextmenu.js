/* contextmenu.js — 自定义右键菜单：站点 / 文件夹 / 分页 */
import { getState, getSite, getFolder, moveItemToPage, deleteSite, addFolder, detachItemFromPages, deletePage, renamePage, addPage, setCurrentPage, snapshotSiteLinks, undoDeleteSite } from './store.js';
import { openSiteEditor, renameFolder, openAllFolder, removeFolder, openFolder } from './folder.js';
import { renderAll } from './render.js';
import { confirmAction, askText } from './dialog.js';
import { openUrl, toast, toastAction } from './utils.js';

const menu = document.getElementById('ctx-menu');

function hide() {
  menu.classList.add('hidden');
  menu.innerHTML = '';
}

function place(x, y) {
  menu.classList.remove('hidden');
  menu.style.left = '0px';
  menu.style.top = '0px';
  const rect = menu.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 10)) + 'px';
  menu.style.top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 10)) + 'px';
}

function item(label, onClick, { danger = false, indent = false } = {}) {
  const btn = document.createElement('button');
  btn.textContent = label;
  if (danger) btn.classList.add('danger');
  if (indent) btn.style.paddingLeft = '24px';
  btn.addEventListener('click', async () => { hide(); await onClick?.(); });
  menu.appendChild(btn);
}

function sep() {
  const s = document.createElement('div');
  s.className = 'pop-sep';
  menu.appendChild(s);
}

function title(text) {
  const t = document.createElement('div');
  t.className = 'pop-title';
  t.textContent = text;
  menu.appendChild(t);
}

async function newFolderWith(siteId) {
  const name = await askText({ title: '新建文件夹', placeholder: '文件夹名称', value: '新文件夹', okText: '创建' });
  if (!name) return;
  await addFolder(name, [siteId]);
  await detachItemFromPages(siteId);
  renderAll();
  toast('已新建文件夹并收纳该站点');
}

export function openSiteMenu(e, siteId, { folderId = null } = {}) {
  const site = getSite(siteId);
  if (!site) return;
  menu.innerHTML = '';
  item('打开', () => openUrl(site.url, { newTab: true }));
  item('编辑', () => openSiteEditor(siteId));
  item('复制网址', async () => {
    try { await navigator.clipboard.writeText(site.url); toast('已复制网址'); }
    catch (err) { toast('复制失败'); }
  });
  sep();
  const pages = getState().pages.filter((p) => p.siteIds.includes(siteId));
  const current = pages[0];
  const others = getState().pages.filter((p) => p.id !== current?.id);
  if (others.length) {
    title('移动到分页');
    others.forEach((page) => item(page.name, async () => {
      await moveItemToPage(siteId, page.id);
      renderAll();
      toast(`已移动到「${page.name}」`);
    }, { indent: true }));
    sep();
  }
  item('新建文件夹收纳', () => newFolderWith(siteId));
  item('固定到 Dock', () => window.app?.pinDock?.(siteId));
  if (folderId) {
    item('从文件夹移出', async () => {
      const { removeSiteFromFolder } = await import('./store.js');
      await removeSiteFromFolder(folderId, siteId);
      renderAll();
      toast('已移出文件夹');
    });
  }
  sep();
  item('删除', async () => {
    const ok = await confirmAction(`删除「${site.name}」？会从所有分页和文件夹中移除。`, { okText: '删除' });
    if (!ok) return;
    const snapshot = snapshotSiteLinks();
    await deleteSite(siteId);
    renderAll();
    toastAction('站点已删除', '撤销', async () => {
      await undoDeleteSite(site, snapshot);
      renderAll();
      toast('已恢复');
    });
  }, { danger: true });
  place(e.clientX, e.clientY);
}

export function openFolderMenu(e, folderId) {
  const folder = getFolder(folderId);
  if (!folder) return;
  menu.innerHTML = '';
  item('打开', () => openFolder(folderId));
  item('重命名', () => renameFolder(folderId));
  item('打开全部', () => openAllFolder(folderId));
  item('固定到 Dock', () => window.app?.pinDock?.(folderId));
  sep();
  item('删除文件夹', () => removeFolder(folderId), { danger: true });
  place(e.clientX, e.clientY);
}

export function openPageMenu(e, pageId) {
  const page = getState().pages.find((p) => p.id === pageId);
  if (!page) return;
  menu.innerHTML = '';
  title(`分页：${page.name}`);
  item('切换到这一页', () => { setCurrentPage(pageId); renderAll(); });
  item('重命名', async () => {
    const name = await askText({ title: '重命名分页', value: page.name, okText: '保存' });
    if (!name) return;
    await renamePage(pageId, name);
    renderAll();
  });
  item('新建分页', async () => {
    const p = await addPage();
    setCurrentPage(p.id);
    renderAll();
    toast(`已新建「${p.name}」`);
  });
  sep();
  item('删除分页', async () => {
    if (getState().pages.length <= 1) { toast('至少保留一个分页'); return; }
    const ok = await confirmAction('删除这个分页？页面里的站点会移动到第 1 页，不会丢失。', { okText: '删除' });
    if (!ok) return;
    try {
      await deletePage(pageId);
      renderAll();
      toast('分页已删除，内容已移到第 1 页');
    } catch (err) { toast(err.message || '删除失败'); }
  }, { danger: true });
  place(e.clientX, e.clientY);
}

export function openWidgetMenu(e, widgetId) {
  const map = {
    'widget-weather': '天气', 'widget-todo': '待办事项', 'widget-note': '笔记',
    'widget-folder': '文件夹', 'widget-settings': '设置',
  };
  if (!map[widgetId]) return;
  menu.innerHTML = '';
  title(map[widgetId]);
  item('打开', () => {
    const action = {
      'widget-weather': 'openWeather', 'widget-todo': 'openTodo', 'widget-note': 'openNote',
      'widget-folder': 'openFolders', 'widget-settings': 'openSettings',
    }[widgetId];
    window.app?.[action]?.();
  });
  item('固定到 Dock', () => window.app?.pinDock?.(widgetId));
  const others = getState().pages.filter((p) => p.id !== getCurrentPageId());
  if (others.length) {
    sep();
    title('移动到分页');
    others.forEach((page) => item(page.name, async () => {
      const { moveItemToPage } = await import('./store.js');
      await moveItemToPage(widgetId, page.id);
      renderAll();
      toast(`已移动到「${page.name}」`);
    }, { indent: true }));
  }
  place(e.clientX, e.clientY);
}

function getCurrentPageId() {
  const app = window.app;
  return app?.pageId ? app.pageId() : null;
}

export function initContextMenu() {
  document.addEventListener('click', (e) => { if (!e.target.closest('#ctx-menu')) hide(); });
  document.addEventListener('contextmenu', (e) => {
    if (e.defaultPrevented) return;
    if (!e.target.closest('#ctx-menu')) hide();
  });
  document.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
}
