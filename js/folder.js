/* folder.js — 站点编辑弹窗 + 文件夹弹窗（收纳/移出/排序/打开全部） */
import {
  getState, getSite, getFolder, addSite, updateSite, addSiteToFolder,
  removeSiteFromFolder, reorderFolder, updateFolder, deleteFolder, getCurrentPage,
} from './store.js';
import { normalizeUrl, hostNameOf, toast, openUrl, readFileAsDataURL, compressImage, firstChar } from './utils.js';
import { paintIcon } from './favicon.js';
import { renderAll, renderGrid } from './render.js';
import { openModal, closeModal, confirmAction, askText } from './dialog.js';

const COLORS = ['#4c8bf5', '#ff6b6b', '#f5a623', '#34c759', '#9b59b6', '#16a085', '#e67e22', '#24292f',
  '#e1251b', '#ff5000', '#0066ff', '#fb7299', '#00a6a0', '#8e44ad', '#2c3e50', '#7f8c8d'];

let editor = { siteId: null, pageId: null, folderId: null, mode: 'auto', color: COLORS[0], upload: '' };
let currentFolderId = null;
let folderEditMode = false;

/* ---------------- 站点编辑 ---------------- */
function syncModePanels() {
  document.querySelectorAll('#se-icon-tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === editor.mode);
  });
  document.getElementById('se-color-row')?.classList.toggle('hidden', editor.mode !== 'color');
  document.getElementById('se-upload-row')?.classList.toggle('hidden', editor.mode !== 'upload');
}

function paintPreview() {
  const preview = document.getElementById('se-preview');
  if (!preview) return;
  const name = document.getElementById('se-name')?.value?.trim() || '站点';
  paintIcon(preview, {
    name,
    url: document.getElementById('se-url')?.value?.trim() || '',
    color: editor.color,
    iconType: editor.mode,
    iconValue: editor.upload,
  }, { size: 64 });
}

function fillColors() {
  const wrap = document.getElementById('se-colors');
  if (!wrap) return;
  wrap.innerHTML = '';
  COLORS.forEach((color) => {
    const btn = document.createElement('button');
    btn.className = 'swatch' + (color === editor.color ? ' selected' : '');
    btn.style.background = color;
    btn.title = color;
    btn.addEventListener('click', () => {
      editor.color = color;
      fillColors();
      paintPreview();
    });
    wrap.appendChild(btn);
  });
}

export function openSiteEditor(siteId = null, { pageId = null, folderId = null } = {}) {
  const site = siteId ? getSite(siteId) : null;
  editor = {
    siteId,
    pageId: pageId || getCurrentPage()?.id || null,
    folderId,
    mode: site?.iconType || 'auto',
    color: site?.color || COLORS[0],
    upload: site?.iconType === 'upload' ? site.iconValue : '',
  };
  document.getElementById('se-title').textContent = site ? '编辑站点' : '新建站点';
  const urlInput = document.getElementById('se-url');
  const nameInput = document.getElementById('se-name');
  urlInput.value = site?.url || '';
  nameInput.value = site?.name || '';
  document.getElementById('se-error').textContent = '';
  document.getElementById('se-upload-name').textContent = editor.upload ? '已选择图片' : '未选择';
  syncModePanels();
  fillColors();
  paintPreview();
  openModal('site-editor');
  setTimeout(() => urlInput.focus(), 120);
}

export async function saveSiteEditor() {
  const error = document.getElementById('se-error');
  const check = normalizeUrl(document.getElementById('se-url').value);
  if (!check.ok) { error.textContent = check.reason; return; }
  const name = document.getElementById('se-name').value.trim() || hostNameOf(check.url);
  const patch = {
    name,
    url: check.url,
    color: editor.color,
    iconType: editor.mode,
    iconValue: editor.mode === 'upload' ? editor.upload : '',
  };
  if (editor.siteId) {
    await updateSite(editor.siteId, patch);
  } else {
    const { site } = await addSite({ ...patch, pageId: editor.pageId });
    if (editor.folderId) await addSiteToFolder(editor.folderId, site.id);
    if (editor.folderId) {
      // 新建后不重复占用主页格子（文件夹内展示）
      const page = getCurrentPage();
      page.siteIds = page.siteIds.filter((id) => id !== site.id);
    }
  }
  closeModal('site-editor');
  renderAll();
  if (currentFolderId) renderFolderGrid();
  toast('已保存');
}

export function initSiteEditor() {
  document.querySelectorAll('#se-icon-tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      editor.mode = btn.dataset.mode;
      syncModePanels();
      paintPreview();
    });
  });
  document.getElementById('se-url')?.addEventListener('input', paintPreview);
  document.getElementById('se-name')?.addEventListener('input', paintPreview);
  document.getElementById('se-upload-btn')?.addEventListener('click', () => document.getElementById('se-file')?.click());
  document.getElementById('se-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const raw = await readFileAsDataURL(file);
    editor.upload = await compressImage(raw, 256, 0.86);
    document.getElementById('se-upload-name').textContent = file.name;
    paintPreview();
  });
  document.getElementById('se-save')?.addEventListener('click', saveSiteEditor);
  document.getElementById('se-url')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveSiteEditor(); });
}

/* ---------------- 文件夹 ---------------- */
export function openFolder(folderId) {
  const folder = getFolder(folderId);
  if (!folder) return;
  currentFolderId = folderId;
  folderEditMode = false;
  document.getElementById('folder-title').textContent = folder.name;
  document.getElementById('folder-edit').textContent = '编辑';
  document.getElementById('folder-grid').classList.remove('edit-mode');
  renderFolderGrid();
  openModal('folder-modal');
}

function renderFolderGrid() {
  const folder = getFolder(currentFolderId);
  if (!folder) return;
  const grid = document.getElementById('folder-grid');
  const empty = document.getElementById('folder-empty');
  grid.innerHTML = '';
  const members = folder.iconIds.map(getSite).filter(Boolean);
  empty?.classList.toggle('hidden', members.length > 0);
  members.forEach((site) => {
    const el = document.createElement('div');
    el.className = 'cell site';
    el.dataset.id = site.id;
    el.draggable = true;
    el.tabIndex = 0;
    const icon = document.createElement('span');
    icon.className = 'icon';
    paintIcon(icon, site, { size: 64 });
    el.appendChild(icon);
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = site.name;
    el.appendChild(label);
    el.addEventListener('click', () => openUrl(site.url, { newTab: true }));
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      window.app?.openSiteMenu?.(e, site.id, { folderId: currentFolderId });
    });
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', 'folder-item:' + site.id);
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    grid.appendChild(el);
  });

  grid.ondragover = (e) => { e.preventDefault(); };
  grid.ondrop = async (e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain') || '';
    if (!raw.startsWith('folder-item:')) return;
    const dragged = raw.slice('folder-item:'.length);
    const after = e.target.closest('.cell')?.dataset.id;
    const order = members.map((m) => m.id).filter((id) => id !== dragged);
    let idx = after ? order.indexOf(after) : order.length;
    if (idx < 0) idx = order.length;
    order.splice(idx, 0, dragged);
    await reorderFolder(currentFolderId, order);
    renderFolderGrid();
  };
}

export function initFolderModal() {
  document.getElementById('folder-edit')?.addEventListener('click', () => {
    folderEditMode = !folderEditMode;
    document.getElementById('folder-grid').classList.toggle('edit-mode', folderEditMode);
    document.getElementById('folder-edit').textContent = folderEditMode ? '完成' : '编辑';
  });
  document.getElementById('folder-grid')?.addEventListener('click', async (e) => {
    if (!folderEditMode) return;
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const siteId = cell.dataset.id;
    await removeSiteFromFolder(currentFolderId, siteId);
    renderFolderGrid();
    renderGrid();
    toast('已移出文件夹，站点仍在');
  });
  document.getElementById('folder-add')?.addEventListener('click', () => {
    openSiteEditor(null, { folderId: currentFolderId });
  });
  document.getElementById('folder-open-all')?.addEventListener('click', () => {
    const folder = getFolder(currentFolderId);
    if (!folder) return;
    folder.iconIds.map(getSite).filter(Boolean).forEach((site) => {
      setTimeout(() => openUrl(site.url, { newTab: true }), 80);
    });
    toast(`正在打开 ${folder.iconIds.length} 个站点`);
  });
  document.getElementById('folder-delete')?.addEventListener('click', async () => {
    const folder = getFolder(currentFolderId);
    if (!folder) return;
    const ok = await confirmAction(`删除文件夹「${folder.name}」？里面的站点会移回第 1 页，不会删除。`, { okText: '删除' });
    if (!ok) return;
    await deleteFolder(folder.id);
    closeModal('folder-modal');
    currentFolderId = null;
    renderAll();
    toast('文件夹已删除，站点已移回第 1 页');
  });
  document.getElementById('folder-title')?.addEventListener('dblclick', async () => {
    const folder = getFolder(currentFolderId);
    if (!folder) return;
    const name = await askText({ title: '重命名文件夹', value: folder.name, okText: '保存' });
    if (!name) return;
    await updateFolder(folder.id, { name });
    document.getElementById('folder-title').textContent = name;
    renderAll();
  });
}

export function closeFolder() {
  closeModal('folder-modal');
  currentFolderId = null;
  renderAll();
}

export async function renameFolder(folderId) {
  const folder = getFolder(folderId);
  if (!folder) return;
  const name = await askText({ title: '重命名文件夹', value: folder.name, okText: '保存' });
  if (!name) return;
  await updateFolder(folderId, { name });
  renderAll();
  toast('已重命名');
}

export async function openAllFolder(folderId) {
  const folder = getFolder(folderId);
  if (!folder) return;
  const sites = folder.iconIds.map(getSite).filter(Boolean);
  sites.forEach((site, i) => setTimeout(() => openUrl(site.url, { newTab: true }), i * 80));
  toast(`正在打开 ${sites.length} 个站点`);
}

export async function removeFolder(folderId) {
  const folder = getFolder(folderId);
  if (!folder) return;
  const ok = await confirmAction(`删除文件夹「${folder.name}」？里面的站点会移回第 1 页，不会删除。`, { okText: '删除' });
  if (!ok) return;
  await deleteFolder(folderId);
  renderAll();
  toast('文件夹已删除，站点已移回第 1 页');
}

export { currentFolderId };
