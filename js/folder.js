/* folder.js — 文件夹浮窗（网格 / 编辑模式红叉 / 内部排序）+ 右侧滑出编辑面板 + 通用站点编辑弹窗 */
import { getFolder, getSite, addSiteToFolder, removeSiteFromFolder, reorderFolder,
         updateSite, updateFolder, deleteFolder, addFolder, getState, getCurrentPage } from './store.js';
import { db } from './db.js';
import { normalizeUrl, toast, escapeHtml, readFileAsDataURL, compressImageToDataURL, openUrl } from './utils.js';
import { PRESET_ICONS } from './presets.js';
import { PRESET_COLORS, iconInner, renderGrid, renderAll } from './render.js';

let currentFolderId = null;
let folderEditMode = false;
let editingSiteId = null;

export function openFolderModal(folderId) {
  currentFolderId = folderId;
  folderEditMode = false;
  const folder = getFolder(folderId);
  if (!folder) return;
  document.getElementById('folder-title').textContent = folder.name;
  document.getElementById('folder-modal').classList.remove('modal-hidden');
  document.getElementById('folder-overlay').classList.remove('modal-hidden');
  document.getElementById('folder-edit-mode-btn').textContent = '编辑模式';
  renderFolderGrid();
}

function closeFolderModal() {
  document.getElementById('folder-modal').classList.add('modal-hidden');
  document.getElementById('folder-overlay').classList.add('modal-hidden');
  document.getElementById('folder-edit-panel').classList.remove('open');
  currentFolderId = null;
  folderEditMode = false;
  renderGrid();
}

function renderFolderGrid() {
  const folder = getFolder(currentFolderId);
  const grid = document.getElementById('folder-grid');
  const empty = document.getElementById('folder-empty-tip');
  grid.innerHTML = '';
  const members = folder.iconIds.map(getSite).filter(Boolean);
  empty.classList.toggle('modal-hidden', members.length > 0);
  members.forEach((site) => {
    const card = document.createElement('div');
    card.className = 'site-card';
    card.draggable = true;
    card.dataset.id = site.id;
    card.innerHTML = `
      <span class="folder-del-tag">×</span>
      ${iconInner(site)}
      <div class="icon-name">${escapeHtml(site.name || '未命名')}</div>`;
    card.addEventListener('click', () => {
      if (folderEditMode) return;
      openSlideEditor(site.id);
    });
    card.querySelector('.folder-del-tag').addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeSiteFromFolder(currentFolderId, site.id);
      toast('已移出文件夹（站点未删除）');
      renderFolderGrid();
    });
    card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', site.id); });
    grid.appendChild(card);
  });
  grid.ondragover = (e) => e.preventDefault();
  grid.ondrop = async (e) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    const afterEl = e.target.closest('.site-card');
    const order = [...grid.querySelectorAll('.site-card')].map((n) => n.dataset.id);
    if (draggedId) {
      const idx = order.indexOf(draggedId);
      if (idx >= 0) order.splice(idx, 1);
      let targetIdx = afterEl ? order.indexOf(afterEl.dataset.id) : order.length;
      if (targetIdx < 0) targetIdx = order.length;
      order.splice(targetIdx, 0, draggedId);
      await reorderFolder(currentFolderId, order);
      renderFolderGrid();
    }
  };
}

export function initFolderModal() {
  document.getElementById('folder-close').addEventListener('click', closeFolderModal);
  document.getElementById('folder-overlay').addEventListener('click', closeFolderModal);
  document.getElementById('folder-edit-mode-btn').addEventListener('click', () => {
    folderEditMode = !folderEditMode;
    document.getElementById('folder-grid').classList.toggle('edit-mode', folderEditMode);
    document.getElementById('folder-edit-mode-btn').textContent = folderEditMode ? '完成编辑' : '编辑模式';
  });
}

function fillColorRow(containerId, selected, onPick) {
  const row = document.getElementById(containerId);
  row.innerHTML = '';
  PRESET_COLORS.forEach((c) => {
    const sw = document.createElement('span');
    sw.className = 'color-swatch' + (c === selected ? ' selected' : '');
    sw.style.background = c;
    sw.addEventListener('click', () => {
      row.querySelectorAll('.color-swatch').forEach((x) => x.classList.remove('selected'));
      sw.classList.add('selected');
      onPick(c);
    });
    row.appendChild(sw);
  });
}

function fillPresetRow(containerId, selected, onPick) {
  const row = document.getElementById(containerId);
  row.innerHTML = '';
  Object.entries(PRESET_ICONS).forEach(([key, ch]) => {
    const cell = document.createElement('span');
    cell.className = 'preset-cell' + (key === selected ? ' selected' : '');
    cell.textContent = ch;
    cell.title = key;
    cell.addEventListener('click', () => {
      row.querySelectorAll('.preset-cell').forEach((x) => x.classList.remove('selected'));
      cell.classList.add('selected');
      onPick(key);
    });
    row.appendChild(cell);
  });
}

let feColor = '#4c8bf5', fePreset = '';
function openSlideEditor(siteId) {
  const site = getSite(siteId);
  if (!site) return;
  editingSiteId = siteId;
  document.getElementById('fe-panel-title').textContent = '编辑站点';
  document.getElementById('fe-url').value = site.url;
  document.getElementById('fe-name').value = site.name;
  document.getElementById('fe-error').textContent = '';
  feColor = site.color || '#4c8bf5';
  fePreset = site.iconValue || '';
  fillColorRow('fe-color-row', feColor, (c) => { feColor = c; refreshFePreview(); });
  fillPresetRow('fe-preset-row', fePreset, (k) => { fePreset = k; refreshFePreview(); });
  refreshFePreview();
  document.getElementById('folder-edit-panel').classList.add('open');
}

function refreshFePreview() {
  const site = getSite(editingSiteId);
  if (!site) return;
  const probe = { ...site, color: feColor, iconType: fePreset ? 'preset' : 'color', iconValue: fePreset };
  document.getElementById('fe-preview').innerHTML = iconInner(probe);
}

export function initSlideEditor() {
  document.getElementById('fe-cancel').addEventListener('click', () => {
    document.getElementById('folder-edit-panel').classList.remove('open');
  });
  document.getElementById('fe-ok').addEventListener('click', async () => {
    if (!editingSiteId) return;
    const urlCheck = normalizeUrl(document.getElementById('fe-url').value);
    if (!urlCheck.ok) { document.getElementById('fe-error').textContent = urlCheck.reason; return; }
    const name = document.getElementById('fe-name').value.trim() || urlCheck.url;
    await updateSite(editingSiteId, {
      url: urlCheck.ok ? urlCheck.url : undefined,
      name, color: feColor,
      iconType: fePreset ? 'preset' : 'color', iconValue: fePreset,
    });
    document.getElementById('folder-edit-panel').classList.remove('open');
    renderFolderGrid();
    renderGrid();
    toast('已保存');
  });
}

let seState = { mode: 'color', color: '#4c8bf5', preset: '', uploadData: '' };

export function openSiteEditor(siteId, { pageId } = {}) {
  const site = siteId ? getSite(siteId) : null;
  editingSiteId = siteId || null;
  document.getElementById('se-title').textContent = site ? '编辑站点' : '新建站点';
  document.getElementById('se-url').value = site ? site.url : '';
  document.getElementById('se-name').value = site ? site.name : '';
  document.getElementById('se-error').textContent = '';
  seState = {
    mode: site ? site.iconType : 'color',
    color: site ? site.color || '#4c8bf5' : '#4c8bf5',
    preset: site ? site.iconValue || '' : '',
    uploadData: site && site.iconType === 'upload' ? site.iconValue : '',
    pageId,
  };
  document.querySelector('input[name=se-icon-type][value="' + seState.mode + '"]').checked = true;
  syncEditorModePanels();
  fillColorRow('se-color-row', seState.color, (c) => { seState.color = c; refreshSePreview(); });
  fillPresetRow('se-preset-row', seState.preset, (k) => { seState.preset = k; refreshSePreview(); });
  refreshSePreview();
  document.getElementById('site-editor-modal').classList.remove('modal-hidden');
}

function syncEditorModePanels() {
  document.getElementById('se-color-row-wrap').classList.toggle('modal-hidden', seState.mode !== 'color');
  document.getElementById('se-preset-row-wrap').classList.toggle('modal-hidden', seState.mode !== 'preset');
  document.getElementById('se-upload-row-wrap').classList.toggle('modal-hidden', seState.mode !== 'upload');
}

function refreshSePreview() {
  const probe = {
    name: document.getElementById('se-name').value || '?',
    url: '', color: seState.color, iconType: seState.mode,
    iconValue: seState.mode === 'upload' ? seState.uploadData : seState.preset,
  };
  document.getElementById('se-preview').innerHTML = iconInner(probe);
}

export function initSiteEditor() {
  document.querySelectorAll('input[name=se-icon-type]').forEach((r) => {
    r.addEventListener('change', () => { seState.mode = r.value; syncEditorModePanels(); refreshSePreview(); });
  });
  document.getElementById('se-name').addEventListener('input', refreshSePreview);
  document.getElementById('se-upload-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const raw = await readFileAsDataURL(file);
    seState.uploadData = await compressImageToDataURL(raw, 640, 0.72);
    refreshSePreview();
  });
  document.getElementById('se-cancel').addEventListener('click', () => {
    document.getElementById('site-editor-modal').classList.add('modal-hidden');
  });
  document.getElementById('se-ok').addEventListener('click', async () => {
    const urlCheck = normalizeUrl(document.getElementById('se-url').value);
    if (!urlCheck.ok) { document.getElementById('se-error').textContent = urlCheck.reason; return; }
    const name = document.getElementById('se-name').value.trim() || urlCheck.url;
    if (editingSiteId) {
      await updateSite(editingSiteId, {
        url: urlCheck.url, name, color: seState.color,
        iconType: seState.mode, iconValue: seState.mode === 'upload' ? seState.uploadData : seState.preset,
      });
    } else {
      const { addSite, getCurrentPage } = await import('./store.js');
      await addSite({
        url: urlCheck.url, name, color: seState.color,
        iconType: seState.mode, iconValue: seState.mode === 'upload' ? seState.uploadData : seState.preset,
        pageId: seState.pageId || getCurrentPage().id,
      });
    }
    document.getElementById('site-editor-modal').classList.add('modal-hidden');
    renderGrid();
    toast('已保存');
  });
}

export async function renameFolder(folderId) {
  const folder = getFolder(folderId);
  if (!folder) return;
  const name = window.prompt('文件夹名称', folder.name);
  if (name === null) return;
  await updateFolder(folderId, { name: name.trim() || folder.name });
  renderAll();
  toast('已重命名');
}

export async function openAllFolderSites(folderId) {
  const folder = getFolder(folderId);
  if (!folder) return;
  const members = folder.iconIds.map(getSite).filter((s) => s.url);
  members.forEach((s, i) => setTimeout(() => openUrl(s.url, { background: true }), i * 60));
  toast(`正在打开 ${members.length} 个站点`);
}

export async function removeFolder(folderId) {
  const folder = getFolder(folderId);
  if (!folder) return;
  const ok = await window.__confirm(`确认删除文件夹「${folder.name}」？仅删除收纳关系，站点本体保留。`);
  if (!ok) return;
  getState().pages.forEach((p) => { p.siteIds = p.siteIds.filter((x) => x !== folderId); });
  await Promise.all(getState().pages.map((p) => db.put('pages', p)));
  await deleteFolder(folderId);
  renderAll();
  toast('文件夹已删除，站点保留');
}

export async function createFolderFromSite(siteId) {
  const name = window.prompt('新建文件夹名称', '新文件夹');
  if (name === null) return null;
  const folder = await addFolder(name.trim() || '新文件夹', [siteId]);
  const page = getCurrentPage();
  if (!page.siteIds.includes(folder.id)) page.siteIds.push(folder.id);
  await db.put('pages', page);
  renderAll();
  toast('已新建文件夹并收纳该站点');
  return folder;
}
