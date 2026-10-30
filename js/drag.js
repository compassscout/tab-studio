/* drag.js — 主网格拖拽排序 / 拖入文件夹 / 图标互拖建组 */
import {
  getState, getCurrentPage, getSite, getFolder, reorderPageItems, reorderPages,
  addSiteToFolder, addFolder, detachItemFromPages, moveItemToPage, addPage, addSite,
} from './store.js';
import { renderAll, goToPage, goPage } from './render.js';
import { askText, confirmAction } from './dialog.js';
import { toast, normalizeUrl, hostNameOf } from './utils.js';

let source = null; // { kind:'item', id, pageId }
let indicator = null;

/** 从拖拽数据里取外部网址（浏览器拖链接 / 拖书签） */
function pickDroppedUrl(uriList, plain) {
  const fromList = String(uriList || '').split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
  if (fromList.length) return fromList[0];
  const text = String(plain || '').trim();
  if (/^https?:\/\//i.test(text)) return text;
  return '';
}

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
  /* 监听挂在轨道上做事件委托：层轮转后监听不失效；
     每次事件里实时取当前层（id="grid" 会随轮转移动，不能缓存元素引用） */
  const track = document.getElementById('pager-track');
  if (!track) return;
  const inCurrentLayer = (e) => {
    const layer = e.target.closest?.('.page-layer');
    return !!layer && layer.dataset.role === 'current';
  };
  const currentLayerEl = () => document.querySelector('#pager-track .page-layer[data-role="current"]');

  track.addEventListener('dragstart', (e) => {
    if (!inCurrentLayer(e)) return;
    const raw = e.dataTransfer?.getData('text/plain') || '';
    source = parseDrag(raw);
    if (source) {
      const page = getCurrentPage();
      source.pageId = page.id;
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  track.addEventListener('dragend', () => {
    source = null;
    clearIndicator();
    track.querySelectorAll('.cell.dragging').forEach((el) => el.classList.remove('dragging'));
  });

  /* 允许在网格外松手（窗口边缘），否则浏览器会取消这次拖拽 */
  document.addEventListener('dragover', (e) => {
    if (!(source || parseDrag(window.__compassDrag || ''))) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }, true);

  /* 在窗口边缘松手（落在网格外）也按“放到当前分页末尾”处理 */
  document.addEventListener('drop', (e) => {
    if (e.defaultPrevented) return;
    const drag = source || parseDrag(window.__compassDrag || '');
    if (!drag) return;
    const page = getCurrentPage();
    if (!page) return;
    e.preventDefault();
    moveItemToPage(drag.id, page.id).then(() => {
      renderAll();
      toast(`已移到「${page.name}」`);
    });
  });

  /* 拖到左右翻页箭头上也能翻页（箭头不在窗口边缘时更稳） */
  let arrowTimer = null;
  let arrowDir = 0;
  const bindArrowFlip = (el, dir) => {
    if (!el) return;
    el.addEventListener('dragover', (e) => {
      const drag = source || parseDrag(window.__compassDrag || '');
      if (!drag) return;
      e.preventDefault();
      e.stopPropagation();
      if (arrowDir === dir && arrowTimer) return;
      clearTimeout(arrowTimer);
      arrowDir = dir;
      arrowTimer = setTimeout(() => { arrowTimer = null; clearIndicator(); goPage(dir); }, 300);
    });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearTimeout(arrowTimer); arrowTimer = null;
      const drag = source || parseDrag(window.__compassDrag || '');
      if (!drag) return;
      const page = getCurrentPage();
      if (!page) return;
      moveItemToPage(drag.id, page.id).then(() => {
        renderAll();
        toast(`已移到「${page.name}」`);
      });
    });
  };
  bindArrowFlip(document.getElementById('page-prev'), -1);
  bindArrowFlip(document.getElementById('page-next'), 1);

  track.addEventListener('dragover', (e) => {
    if (!inCurrentLayer(e)) return;
    /* 从 Dock 拖来的条目不会触发网格的 dragstart，source 为空，需回退到 text/plain */
    const drag = source || parseDrag(window.__compassDrag || '');
    if (!drag) {
      /* 外部拖入链接 / 书签：允许放置，用于快速建站 */
      const types = Array.from(e.dataTransfer?.types || []);
      if (types.includes('text/uri-list') || types.includes('text/plain')) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        currentLayerEl()?.classList.add('drop-url');
      }
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const cell = e.target.closest('.cell');
    if (!cell || cell === indicator) return;
    clearIndicator();
    const kind = cell.dataset.kind;
    if (kind === 'folder' && getSite(drag.id)) {
      cell.classList.add('drop-into');
      indicator = cell;
      return;
    }
    if (kind === 'site' || kind === 'folder' || kind === 'widget') {
      if (cell.dataset.id === drag.id) return;
      const rect = cell.getBoundingClientRect();
      const before = e.clientX < rect.left + rect.width / 2;
      cell.classList.add(before ? 'drop-before' : 'drop-after');
      indicator = cell;
    }
  });

  track.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget || !track.contains(e.relatedTarget)) {
      clearIndicator();
      currentLayerEl()?.classList.remove('drop-url');
    }
  });

  track.addEventListener('drop', async (e) => {
    if (!inCurrentLayer(e)) return;
    const grid = currentLayerEl();
    e.preventDefault();
    grid?.classList.remove('drop-url');
    const raw = e.dataTransfer?.getData('text/plain') || '';
    /* 外部拖入的网址：直接建站（拖到文件夹上则同时放进文件夹） */
    if (!raw.startsWith('dock:') && !parseDrag(raw)) {
      const dropped = pickDroppedUrl(e.dataTransfer?.getData('text/uri-list'), raw);
      if (dropped) {
        clearIndicator();
        const norm = normalizeUrl(dropped);
        if (!norm.ok) { toast(norm.reason); return; }
        const host = hostNameOf(norm.url);
        const name = host.replace(/^www\./, '').split('.')[0] || host;
        const { site, moved } = await addSite({ name, url: norm.url });
        const cell = e.target.closest('.cell');
        if (cell && cell.dataset.kind === 'folder') {
          await addSiteToFolder(cell.dataset.id, site.id);
          await detachItemFromPages(site.id);
        }
        renderAll();
        toast(moved ? `已添加「${name}」，本页已满，已顺延到后续分页` : `已添加「${name}」，可在编辑里改名`);
        return;
      }
    }
    if (raw.startsWith('dock:')) {
      window.app?.unpinDock?.(raw.slice(5));
      toast('已从 Dock 移除（站点仍保留）');
      return;
    }
    const drag = parseDrag(raw) || source;
    clearIndicator();
    if (!drag) return;
    const cell = e.target.closest('.cell');
    /* 放到空白处 → 移到当前分页末尾（配合边缘自动翻页，跨页拖拽更顺手） */
    if (!cell) {
      const page = getCurrentPage();
      if (page) {
        await moveItemToPage(drag.id, page.id);
        renderAll();
        toast(`已移到「${page.name}」`);
      }
      return;
    }
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

  /* 拖拽到左右边缘：停留 550ms 或直接松手，移到相邻分页并翻页 */
  let edgeTimer = null;
  let edgeSwitched = false;
  let lastEdgeAt = 0;
  const zones = [...document.querySelectorAll('.page-drop')];
  const dragItemId = () => { const raw = window.__compassDrag || ''; return raw.startsWith('item:') ? raw.slice(5) : null; };
  const clearEdge = () => {
    clearTimeout(edgeTimer); edgeTimer = null;
    zones.forEach((z) => z.classList.remove('active'));
  };
  const moveEdge = async (dir) => {
    /* 一次拖拽只翻一次；再补 900ms 冷却，避免边缘连续 dragover 重复建页 */
    if (edgeSwitched || Date.now() - lastEdgeAt < 900) return;
    const id = dragItemId();
    if (!id) return;
    lastEdgeAt = Date.now();
    const pages = getState().pages;
    const from = pages.find((p) => p.siteIds.includes(id)) || getCurrentPage();
    if (!from) return;
    const idx = pages.findIndex((p) => p.id === from.id);
    let target = pages[idx + dir];
    /* 走到边界时：向左没有上一页就在最前面新建一页，向右没有下一页就在末尾新建 */
    if (!target) {
      edgeSwitched = true;
      clearEdge();
      const created = await addPage();
      if (dir < 0) {
        const order = getState().pages.map((p) => p.id).filter((pid) => pid !== created.id);
        order.unshift(created.id);
        await reorderPages(order);
      }
      await moveItemToPage(id, created.id);
      goToPage(created.id);
      toast(`已新建「${created.name}」并移入`);
      setTimeout(() => document.body.classList.remove('dragging'), 420);
      return;
    }
    if (target.id === from.id) return;
    edgeSwitched = true;
    clearEdge();
    await moveItemToPage(id, target.id);
    goToPage(target.id);
    toast(`已移到「${target.name}」`);
    setTimeout(() => document.body.classList.remove('dragging'), 420);
  };
  document.addEventListener('dragstart', () => {
    edgeSwitched = false;
    clearEdge();
    setTimeout(() => {
      if (dragItemId()) {
        document.body.classList.add('dragging');
        document.body.classList.toggle('single-page', getState().pages.length < 2);
      }
    }, 0);
  });
  document.addEventListener('dragend', () => {
    document.body.classList.remove('dragging');
    document.body.classList.remove('single-page');
    clearEdge();
    edgeSwitched = false;
  });
  zones.forEach((zone) => {
    const dir = Number(zone.dataset.dir);
    zone.addEventListener('dragover', (e) => {
      if (!dragItemId()) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('active');
      if (!edgeTimer) edgeTimer = setTimeout(() => { edgeTimer = null; moveEdge(dir); }, 550);
    });
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('active');
      clearTimeout(edgeTimer);
      edgeTimer = null;
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearEdge();
      moveEdge(dir);
    });
  });
}