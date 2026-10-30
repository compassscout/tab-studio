/* drag.js — 主网格拖拽排序 / 拖入文件夹 / 图标互拖建组 */
import {
  getState, getCurrentPage, getSite, getFolder, reorderPageItems,
  addSiteToFolder, addFolder, detachItemFromPages, moveItemToPage,
} from './store.js';
import { renderAll } from './render.js';
import { askText, confirmAction } from './dialog.js';
import { toast } from './utils.js';

let source = null; // { kind:'item', id, pageId }
let indicator = null;

function clearIndicator() {
  if (indicator) {
    indicator.classList.remove('drop-before', 'drop-after', 'drop-into');
    indicator = null;
  }
  document.querySelectorAll('#grid .cell.drop-before, #grid .cell.drop-after, #grid .cell.drop-into')
    .forEach((el) => el.classList.remove('drop-before', 'drop-after', 'drop-into'));
}

function parseDrag(raw) {
  if (!raw) return null;
  if (raw.startsWith('item:')) return { kind: 'item', id: raw.slice(5) };
  return null;
}

export function initDrag() {
  const grid = document.getElementById('grid');
  if (!grid) return;

  grid.addEventListener('dragstart', (e) => {
    const raw = e.dataTransfer?.getData('text/plain') || '';
    source = parseDrag(raw);
    if (source) {
      const page = getCurrentPage();
      source.pageId = page.id;
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  grid.addEventListener('dragend', () => {
    source = null;
    clearIndicator();
    grid.querySelectorAll('.cell.dragging').forEach((el) => el.classList.remove('dragging'));
  });

  grid.addEventListener('dragover', (e) => {
    if (!source && !window.__compassDrag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const cell = e.target.closest('.cell');
    if (!cell || cell === indicator) return;
    clearIndicator();
    const kind = cell.dataset.kind;
    if (kind === 'folder' && getSite(source.id)) {
      cell.classList.add('drop-into');
      indicator = cell;
      return;
    }
    if (kind === 'site' || kind === 'folder' || kind === 'widget') {
      if (cell.dataset.id === source.id) return;
      const rect = cell.getBoundingClientRect();
      const before = e.clientX < rect.left + rect.width / 2;
      cell.classList.add(before ? 'drop-before' : 'drop-after');
      indicator = cell;
    }
  });

  grid.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget || !grid.contains(e.relatedTarget)) clearIndicator();
  });

  grid.addEventListener('drop', async (e) => {
    e.preventDefault();
    const raw = e.dataTransfer?.getData('text/plain') || '';
    if (raw.startsWith('dock:')) {
      window.app?.unpinDock?.(raw.slice(5));
      toast('已从 Dock 移除（站点仍保留）');
      return;
    }
    const drag = parseDrag(raw) || source;
    clearIndicator();
    if (!drag) return;
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const sourceId = drag.id;
    const targetId = cell.dataset.id;
    const targetKind = cell.dataset.kind;
    if (!targetId || sourceId === targetId) return;

    const sourceSite = getSite(sourceId);
    const sourceFolder = getFolder(sourceId);
    const targetFolder = targetKind === 'folder' ? getFolder(targetId) : null;
    const targetSite = targetKind === 'site' ? getSite(targetId) : null;

    /* 站点拖进文件夹 */
    if (sourceSite && targetFolder) {
      await addSiteToFolder(targetFolder.id, sourceId);
      await detachItemFromPages(sourceId);
      renderAll();
      toast(`已放入「${targetFolder.name}」`);
      return;
    }

    /* 站点互拖 → 建组 */
    if (sourceSite && targetSite) {
      const name = await askText({
        title: '新建文件夹',
        placeholder: '给这个分组起个名字',
        value: '新文件夹',
        okText: '创建',
      });
      if (!name) return;
      await addFolder(name, [sourceId, targetId]);
      await detachItemFromPages(sourceId);
      await detachItemFromPages(targetId);
      renderAll();
      toast('已创建文件夹并收纳 2 个站点');
      return;
    }

    /* 同页排序（站点 / 文件夹 / 小组件均可） */
    const isWidget = sourceId.startsWith('widget-');
    if (!sourceFolder && !sourceSite && !isWidget) return;
    const page = getCurrentPage();
    if (!page.siteIds.includes(sourceId)) {
      /* 来自其他分页 */
      await moveItemToPage(sourceId, page.id);
      renderAll();
      return;
    }
    const ids = page.siteIds.filter((id) => id !== sourceId);
    let index = ids.indexOf(targetId);
    if (index < 0) index = ids.length;
    else if (indicator && indicator.classList.contains('drop-after')) index += 1;
    else {
      const rect = cell.getBoundingClientRect();
      if (e.clientX >= rect.left + rect.width / 2) index += 1;
    }
    ids.splice(index, 0, sourceId);
    await reorderPageItems(page.id, ids);
    renderAll();
    source = null;
  });
}
