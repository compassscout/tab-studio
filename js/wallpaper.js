/* wallpaper.js — 本地壁纸库 / 风车随机（收藏池优先）/ 300ms 淡入淡出 / 定时轮换骨架 / 预览收藏下载 */
import { getState, addWallpaper, updateWallpaper } from './store.js';
import { saveMeta, loadMeta, loadConfig } from './config.js';
import { toast } from './utils.js';

const SEED_GRADIENTS = [
  'gradient:linear-gradient(135deg,#2b5876 0%,#4e4376 100%)',
  'gradient:linear-gradient(135deg,#0f2027 0%,#203a43 50%,#2c5364 100%)',
  'gradient:linear-gradient(135deg,#42275a 0%,#734b6d 100%)',
  'gradient:linear-gradient(135deg,#134e5e 0%,#71b280 100%)',
  'gradient:linear-gradient(135deg,#3a1c71 0%,#d76d77 50%,#ffaf7b 100%)',
  'gradient:linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)',
];

let currentId = null;

function resolveSrc(wp) { return wp ? wp.src : ''; }

function paint(src) {
  const bg = document.getElementById('wallpaper-bg');
  if (src.startsWith('gradient:')) bg.style.background = src.slice(9);
  else bg.style.backgroundImage = `url("${src}")`;
}

function applyWithFade(wp) {
  const bg = document.getElementById('wallpaper-bg');
  bg.style.opacity = '0';
  bg.style.transition = 'opacity 150ms ease';
  setTimeout(() => {
    paint(resolveSrc(wp));
    bg.style.opacity = '1';
  }, 150);
}

function pool() {
  const favorites = getState().wallpapers.filter((w) => w.favorite);
  return favorites.length ? favorites : getState().wallpapers;
}

export function randomNext() {
  const list = pool();
  if (list.length === 0) return null;
  let next;
  do { next = list[Math.floor(Math.random() * list.length)]; }
  while (list.length > 1 && next.id === currentId);
  currentId = next.id;
  saveMeta({ currentWallpaperId: currentId });
  applyWithFade(next);
  refreshWindmillState();
  refreshPreviewThumb();
  return next;
}

export function refreshWindmillState() {
  const btn = document.getElementById('windmill-btn');
  const empty = getState().wallpapers.length === 0;
  btn.classList.toggle('disabled', empty);
  btn.title = empty ? '壁纸库为空' : '随机换壁纸';
}

export function refreshPreviewThumb() {
  const thumb = document.getElementById('wp-thumb');
  const wp = getState().wallpapers.find((w) => w.id === currentId) || getState().wallpapers[0];
  if (!wp) { thumb.style.background = '#888'; return; }
  if (wp.src.startsWith('gradient:')) thumb.style.background = wp.src.slice(9);
  else thumb.style.backgroundImage = `url("${wp.src}")`;
}

export async function seedIfEmpty() {
  if (getState().wallpapers.length === 0) {
    for (const g of SEED_GRADIENTS) await addWallpaper({ src: g, favorite: false });
  }
}

const ROTATE_MS = {
  '1h': 1 * 3600 * 1000,
  '12h': 12 * 3600 * 1000,
  '24h': 24 * 3600 * 1000,
};

export async function initWallpaper() {
  await seedIfEmpty();
  const meta = loadMeta();
  const saved = getState().wallpapers.find((w) => w.id === meta.currentWallpaperId);
  currentId = saved ? saved.id : (getState().wallpapers[0] || {}).id;
  const cur = getState().wallpapers.find((w) => w.id === currentId);
  if (cur) paint(resolveSrc(cur));
  refreshWindmillState();
  refreshPreviewThumb();

  const btn = document.getElementById('windmill-btn');
  btn.addEventListener('click', () => {
    btn.classList.add('spinning');
    setTimeout(() => btn.classList.remove('spinning'), 500);
    randomNext();
  });

  const cfg = loadConfig();
  if (cfg.wallpaperAutoRotate) {
    if (cfg.wallpaperRotateInterval === 'session') randomNext();
    else startAutoRotate();
  }

  bindPreviewModal();
}

let autoTimer = null;
export function startAutoRotate() {
  stopAutoRotate();
  const ms = ROTATE_MS[loadConfig().wallpaperRotateInterval] || ROTATE_MS['12h'];
  autoTimer = setInterval(() => {
    const onlineSrc = fetchOnlineWallpaperSafe();
    if (!onlineSrc) randomNext();
  }, ms);
}
export function stopAutoRotate() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } }

function fetchOnlineWallpaperSafe() { return null; }

function currentWp() {
  return getState().wallpapers.find((w) => w.id === currentId) || null;
}

function bindPreviewModal() {
  const modal = document.getElementById('wp-preview-modal');
  const img = document.getElementById('wp-preview-img');
  const favBtn = document.getElementById('wp-fav-btn');
  document.getElementById('wp-close').addEventListener('click', () => modal.classList.add('modal-hidden'));
  document.getElementById('settings-wp-download').addEventListener('click', openPreviewModal);
  document.getElementById('wp-download-btn').addEventListener('click', () => {
    const wp = currentWp();
    if (!wp) return;
    if (wp.src.startsWith('gradient:')) { toast('内置渐变壁纸为本地纯色方案，无需下载'); return; }
    fetch(wp.src).then((r) => r.blob()).then((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `wallpaper-${wp.id}.jpg`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }).catch(() => toast('下载失败'));
  });
  favBtn.addEventListener('click', async () => {
    const wp = currentWp();
    if (!wp) return;
    await updateWallpaper(wp.id, { favorite: !wp.favorite });
    favBtn.textContent = wp.favorite ? '取消收藏' : '收藏';
    toast(wp.favorite ? '已取消收藏' : '已加入收藏');
    refreshWindmillState();
  });
}

export function openPreviewModal() {
  const modal = document.getElementById('wp-preview-modal');
  const wp = currentWp();
  if (!wp) { toast('暂无壁纸可预览'); return; }
  const img = document.getElementById('wp-preview-img');
  if (wp.src.startsWith('gradient:')) { img.style.background = wp.src.slice(9); img.style.backgroundImage = 'none'; }
  else { img.style.backgroundImage = `url("${wp.src}")`; img.style.background = '#ccc'; }
  document.getElementById('wp-fav-btn').textContent = wp.favorite ? '取消收藏' : '收藏';
  modal.classList.remove('modal-hidden');
}

export function refreshAfterConfigChange() { refreshPreviewThumb(); }
