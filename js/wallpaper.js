/* wallpaper.js — 本地壁纸库 / 收藏 / 上传 / 在线源 / 随机与定时轮换 */
import { getState, addWallpaper, updateWallpaper, deleteWallpaper, getWallpaper } from './store.js';
import { loadConfig, saveConfig, loadMeta, saveMeta } from './config.js';
import { toast, readFileAsDataURL, compressImage, downloadFile } from './utils.js';
import { confirmAction } from './dialog.js';

const BUILTINS = [
  { id: 'builtin-01', name: '高地晨雾', file: 'images/wallpapers/wp01.jpg' },
  { id: 'builtin-02', name: '林间光束', file: 'images/wallpapers/wp02.jpg' },
  { id: 'builtin-03', name: '湖光山色', file: 'images/wallpapers/wp03.jpg' },
  { id: 'builtin-04', name: '山谷湖泊', file: 'images/wallpapers/wp04.jpg' },
  { id: 'builtin-05', name: '雪山星空', file: 'images/wallpapers/wp05.jpg' },
  { id: 'builtin-06', name: '落日群山', file: 'images/wallpapers/wp06.jpg' },
  { id: 'builtin-07', name: '海岸线', file: 'images/wallpapers/wp07.jpg' },
  { id: 'builtin-08', name: '绿色丘陵', file: 'images/wallpapers/wp08.jpg' },
  { id: 'builtin-09', name: '瀑布', file: 'images/wallpapers/wp09.jpg' },
  { id: 'builtin-10', name: '森林小径', file: 'images/wallpapers/wp10.jpg' },
  { id: 'builtin-11', name: '雪山湖泊', file: 'images/wallpapers/wp11.jpg' },
  { id: 'builtin-12', name: '原野', file: 'images/wallpapers/wp12.jpg' },
];

let currentId = null;
let activeLayer = 'a';
let autoTimer = null;
let libraryTab = 'all';

function layers() {
  return [document.getElementById('wp-layer-a'), document.getElementById('wp-layer-b')];
}

function paint(layer, wp) {
  if (!layer || !wp) return;
  if (wp.src.startsWith('gradient:')) {
    layer.style.backgroundImage = wp.src.slice(9);
    layer.style.backgroundColor = 'transparent';
  } else {
    layer.style.backgroundImage = `url("${wp.src.replace(/"/g, '%22')}")`;
  }
}

/** 300ms 交叉淡入淡出 */
function applyWallpaper(wp, { instant = false } = {}) {
  if (!wp) return;
  const [a, b] = layers();
  const incoming = activeLayer === 'a' ? b : a;
  const outgoing = activeLayer === 'a' ? a : b;
  paint(incoming, wp);
  if (instant) {
    incoming.style.transition = 'none';
    incoming.classList.add('visible');
    outgoing.style.transition = 'none';
    outgoing.classList.remove('visible');
    requestAnimationFrame(() => {
      incoming.style.transition = '';
      outgoing.style.transition = '';
    });
  } else {
    incoming.classList.add('visible');
    outgoing.classList.remove('visible');
  }
  activeLayer = activeLayer === 'a' ? 'b' : 'a';
  currentId = wp.id;
  saveMeta({ wallpaperId: wp.id });
  refreshThumb();
  const modal = document.getElementById('wallpaper-modal');
  if (modal?.classList.contains('open')) renderLibrary();
}

export function currentWallpaper() { return getWallpaper(currentId); }

export function pool() {
  const cfg = loadConfig();
  const all = getState().wallpapers;
  const favorites = all.filter((w) => w.favorite);
  if (cfg.wallFavoriteOnly && favorites.length) return favorites;
  return all;
}

export function randomNext() {
  const list = pool();
  if (!list.length) return null;
  const candidates = list.length > 1 ? list.filter((w) => w.id !== currentId) : list;
  const next = candidates[Math.floor(Math.random() * candidates.length)] || list[0];
  applyWallpaper(next);
  return next;
}

export function refreshThumb() {
  const thumb = document.getElementById('wp-thumb');
  const wp = currentWallpaper();
  if (!thumb) return;
  if (!wp) { thumb.style.backgroundImage = 'none'; return; }
  if (wp.src.startsWith('gradient:')) {
    thumb.style.background = wp.src.slice(9);
    thumb.style.backgroundImage = 'none';
  } else {
    thumb.style.backgroundImage = `url("${wp.src}")`;
  }
}

export function refreshWindmill() {
  const btn = document.getElementById('windmill');
  if (!btn) return;
  const empty = getState().wallpapers.length === 0;
  btn.classList.toggle('disabled', empty);
}

export async function seedWallpapers() {
  const existing = new Set(getState().wallpapers.map((w) => w.id));
  for (const item of BUILTINS) {
    if (!existing.has(item.id)) {
      await addWallpaper({ id: item.id, src: item.file, type: 'builtin', name: item.name });
    }
  }
}

const ROTATE_MS = { '1h': 3600e3, '6h': 6 * 3600e3, '12h': 12 * 3600e3, '24h': 24 * 3600e3 };

export function startAutoRotate() {
  stopAutoRotate();
  const cfg = loadConfig();
  if (!cfg.wallAuto) return;
  if (cfg.wallInterval === 'session') return;
  const ms = ROTATE_MS[cfg.wallInterval] || ROTATE_MS['1h'];
  autoTimer = setInterval(() => randomNext(), ms);
}
export function stopAutoRotate() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
}

/* ---------------- 壁纸库 ---------------- */
function tile(wp) {
  const el = document.createElement('div');
  el.className = 'wp-tile' + (wp.id === currentId ? ' active' : '');
  el.style.backgroundImage = wp.src.startsWith('gradient:') ? wp.src.slice(9) : `url("${wp.src}")`;
  el.title = wp.name || '';

  const tag = document.createElement('span');
  tag.className = 'wp-tag';
  tag.textContent = wp.type === 'upload' ? '我的' : wp.type === 'online' ? '在线' : (wp.name || '精选');
  el.appendChild(tag);

  const actions = document.createElement('div');
  actions.className = 'wp-tile-actions';

  const favBtn = document.createElement('button');
  favBtn.className = wp.favorite ? 'on' : '';
  favBtn.title = wp.favorite ? '取消收藏' : '收藏';
  favBtn.innerHTML = '<svg><use href="#i-star"/></svg>';
  favBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await updateWallpaper(wp.id, { favorite: !wp.favorite });
    renderLibrary();
  });
  actions.appendChild(favBtn);

  const dlBtn = document.createElement('button');
  dlBtn.title = '下载';
  dlBtn.innerHTML = '<svg><use href="#i-download"/></svg>';
  dlBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      const res = await fetch(wp.src);
      const blob = await res.blob();
      downloadFile(`wallpaper-${wp.id}.jpg`, blob, 'image/jpeg');
    } catch (err) { toast('下载失败'); }
  });
  actions.appendChild(dlBtn);

  if (wp.type === 'upload') {
    const delBtn = document.createElement('button');
    delBtn.title = '删除';
    delBtn.innerHTML = '<svg><use href="#i-trash"/></svg>';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirmAction('删除这张壁纸？', { okText: '删除' });
      if (!ok) return;
      await deleteWallpaper(wp.id);
      if (currentId === wp.id) randomNext();
      renderLibrary();
      toast('已删除');
    });
    actions.appendChild(delBtn);
  }

  el.appendChild(actions);
  el.addEventListener('click', () => {
    applyWallpaper(wp);
    toast(`已切换壁纸：${wp.name || '自定义'}`);
  });
  return el;
}

export function renderLibrary() {
  const grid = document.getElementById('wp-grid');
  if (!grid) return;
  const all = getState().wallpapers;
  let list = all;
  if (libraryTab === 'fav') list = all.filter((w) => w.favorite);
  if (libraryTab === 'mine') list = all.filter((w) => w.type === 'upload');
  grid.innerHTML = '';
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'wp-empty';
    empty.textContent = libraryTab === 'fav' ? '还没有收藏，把鼠标移到壁纸上点星标即可。' : '还没有上传过壁纸。';
    grid.appendChild(empty);
    return;
  }
  list.forEach((wp) => grid.appendChild(tile(wp)));
  document.querySelectorAll('#wp-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === libraryTab));
}

export function openLibrary(tab = 'all') {
  libraryTab = tab;
  const modal = document.getElementById('wallpaper-modal');
  const backdrop = document.querySelector('[data-close="wallpaper-modal"]');
  modal?.classList.add('open');
  backdrop?.classList.add('open');
  renderLibrary();
}

function closeLibrary() {
  document.getElementById('wallpaper-modal')?.classList.remove('open');
  document.querySelector('[data-close="wallpaper-modal"]')?.classList.remove('open');
}

async function uploadWallpaper(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('请选择图片文件'); return; }
  const raw = await readFileAsDataURL(file);
  const compressed = await compressImage(raw, 1920, 0.84);
  const wp = await addWallpaper({ src: compressed, type: 'upload', name: file.name.replace(/\.[^.]+$/, '') });
  applyWallpaper(wp);
  libraryTab = 'mine';
  renderLibrary();
  toast('壁纸已添加并应用');
}

async function fetchBingWallpapers() {
  const cfg = loadConfig();
  if (!cfg.network) { toast('已关闭联网，无法获取在线壁纸'); return; }
  toast('正在获取必应每日壁纸…');
  try {
    const res = await fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=zh-CN');
    const data = await res.json();
    const images = data?.images || [];
    const existing = new Set(getState().wallpapers.map((w) => w.id));
    let added = 0;
    for (const img of images) {
      const id = 'bing-' + img.startdate;
      if (existing.has(id)) continue;
      const src = 'https://www.bing.com' + img.url;
      await addWallpaper({ id, src, type: 'online', name: img.title || '必应每日' });
      added++;
    }
    renderLibrary();
    toast(added ? `已加入 ${added} 张必应壁纸` : '必应壁纸已是最新');
  } catch (e) {
    toast('在线壁纸获取失败，请检查网络');
  }
}

export function initWallpaper() {
  seedWallpapers().then(() => {
    const meta = loadMeta();
    const saved = getWallpaper(meta.wallpaperId);
    const list = getState().wallpapers;
    const wp = saved || list[Math.floor(Math.random() * list.length)];
    if (wp) applyWallpaper(wp, { instant: true });
    refreshWindmill();

    const cfg = loadConfig();
    if (cfg.wallAuto) {
      if (cfg.wallInterval === 'session') randomNext();
      else startAutoRotate();
    }
  });

  document.getElementById('windmill')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.classList.add('spinning');
    setTimeout(() => btn.classList.remove('spinning'), 380);
    if (!randomNext()) toast('壁纸库是空的');
  });

  document.querySelector('[data-close="wallpaper-modal"]')?.addEventListener('click', closeLibrary);
  document.querySelectorAll('#wp-tabs button').forEach((btn) => {
    btn.addEventListener('click', () => { libraryTab = btn.dataset.tab; renderLibrary(); });
  });
  document.getElementById('wp-upload-btn')?.addEventListener('click', () => document.getElementById('wp-file')?.click());
  document.getElementById('wp-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    uploadWallpaper(file);
  });
  document.getElementById('wp-online-bing')?.addEventListener('click', fetchBingWallpapers);
  const onlineToggle = document.getElementById('wp-online-toggle');
  if (onlineToggle) {
    onlineToggle.checked = !!loadConfig().network;
    onlineToggle.addEventListener('change', () => {
      saveConfig({ network: onlineToggle.checked });
      toast(onlineToggle.checked ? '已开启可选联网' : '已关闭联网，仅使用本地内容');
    });
  }
  document.addEventListener('configchange', (e) => {
    if (!e.detail) return;
    if ('wallAuto' in e.detail || 'wallInterval' in e.detail) {
      if (loadConfig().wallAuto) startAutoRotate(); else stopAutoRotate();
    }
  });
}

export { closeLibrary };
