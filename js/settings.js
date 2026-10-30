/* settings.js — 设置面板：标准/极简切换 + 全部分组真实生效 + 重置（仅样式，不碰业务数据） */
import { loadConfig, saveConfig, applyConfigToDom, resetStyleConfig, LAYOUTS } from './config.js';
import { renderAll } from './render.js';
import { refreshAfterConfigChange, startAutoRotate, stopAutoRotate } from './wallpaper.js';
import { toast } from './utils.js';

function bindSwitch(id, key) {
  const el = document.getElementById(id);
  el.checked = !!loadConfig()[key];
  el.addEventListener('change', () => saveConfig({ [key]: el.checked }));
}

function bindRange(id, key, fmt = (v) => v, scale = 1) {
  const el = document.getElementById(id);
  const label = document.getElementById(id + '-v');
  el.value = loadConfig()[key];
  if (label) label.textContent = fmt(loadConfig()[key]);
  el.addEventListener('input', () => {
    const raw = parseFloat(el.value);
    saveConfig({ [key]: raw });
    if (label) label.textContent = fmt(raw);
    refreshAfterConfigChange();
  });
}

function buildLayoutChips() {
  const wrap = document.getElementById('layout-options');
  wrap.innerHTML = '';
  Object.entries(LAYOUTS).forEach(([id, l]) => {
    const chip = document.createElement('button');
    chip.className = 'layout-chip' + (loadConfig().layoutId === id ? ' active' : '');
    chip.textContent = l.label;
    chip.addEventListener('click', () => {
      saveConfig({ layoutId: id });
      wrap.querySelectorAll('.layout-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      renderAll();
    });
    wrap.appendChild(chip);
  });
}

function buildAnimButtons() {
  const wrap = document.getElementById('anim-options');
  wrap.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', loadConfig().animType === b.dataset.anim);
    b.addEventListener('click', () => {
      saveConfig({ animType: b.dataset.anim });
      wrap.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    });
  });
}

function buildFontColors() {
  const wrap = document.getElementById('font-colors');
  const current = loadConfig().fontColor;
  wrap.querySelectorAll('.font-color-swatch').forEach((sw) => {
    sw.classList.toggle('selected', sw.dataset.color === current);
    sw.addEventListener('click', () => {
      saveConfig({ fontColor: sw.dataset.color });
      wrap.querySelectorAll('.font-color-swatch').forEach((x) => x.classList.remove('selected'));
      sw.classList.add('selected');
    });
  });
  const picker = document.getElementById('custom-font-color');
  picker.value = /^#[0-9a-fA-F]{6}$/.test(current) ? current : '#ffffff';
  picker.addEventListener('input', () => saveConfig({ fontColor: picker.value }));
}

export function initSettings() {
  bindRange('cfg-mask', 'wallpaperMaskAlpha', (v) => Math.round(v) + '%');
  bindRange('cfg-blur', 'wallpaperBlur', (v) => Math.round(v) + 'px');
  const autoEl = document.getElementById('cfg-wp-auto');
  autoEl.checked = !!loadConfig().wallpaperAutoRotate;
  autoEl.addEventListener('change', () => {
    saveConfig({ wallpaperAutoRotate: autoEl.checked });
    if (autoEl.checked) startAutoRotate(); else stopAutoRotate();
  });
  const intervalEl = document.getElementById('cfg-rotate-interval');
  intervalEl.value = loadConfig().wallpaperRotateInterval;
  intervalEl.addEventListener('change', () => {
    saveConfig({ wallpaperRotateInterval: intervalEl.value });
    if (loadConfig().wallpaperAutoRotate) startAutoRotate();
  });
  bindSwitch('cfg-open-site', 'openSiteNewTab');
  bindSwitch('cfg-open-search', 'openSearchNewTab');
  bindSwitch('cfg-open-bookmark', 'openBookmarkNewTab');
  bindSwitch('cfg-open-history', 'openHistoryNewTab');
  bindSwitch('cfg-gmail', 'gmailNotify');
  bindSwitch('cfg-ring', 'ringtone');
  bindSwitch('cfg-gmail-badge', 'gmailBadge');
  bindSwitch('cfg-todo-badge', 'todoBadge');
  bindRange('cfg-screen-scale', 'screenScale', (v) => Math.round(v * 100) + '%');
  bindRange('cfg-sidebar-scale', 'sidebarScale', (v) => Math.round(v * 100) + '%');
  bindSwitch('cfg-windmill', 'showWindmill');
  bindSwitch('cfg-topsites', 'showTopSites');
  bindSwitch('cfg-topbookmarks', 'showTopBookmarks');
  bindSwitch('cfg-pagebtns', 'showPageButtons');
  bindSwitch('cfg-hideai', 'hideAiIcon');
  buildLayoutChips();
  bindSwitch('cfg-hide-name', 'hideIconName');
  bindSwitch('cfg-icon-shadow', 'iconShadow');
  bindSwitch('cfg-start-anim', 'startAnimation');
  bindRange('cfg-icon-radius', 'iconRadius', (v) => Math.round(v) + 'px');
  bindRange('cfg-icon-opacity', 'iconOpacity', (v) => Math.round(v * 100) + '%');
  bindRange('cfg-icon-size', 'iconSize', (v) => Math.round(v) + 'px');
  bindSwitch('cfg-hide-search', 'hideSearch');
  bindSwitch('cfg-suggest', 'showSuggestions');
  bindSwitch('cfg-keep-input', 'keepSearchContent');
  bindSwitch('cfg-hide-cat', 'hideSearchCategory');
  document.getElementById('cfg-hide-cat').addEventListener('change', (e) => {
    const catsRow = document.getElementById('search-cats');
    if (catsRow) catsRow.style.display = e.target.checked ? 'none' : 'flex';
  });
  bindSwitch('cfg-hide-search-btn', 'hideSearchButton');
  bindRange('cfg-search-size', 'searchSize', (v) => Math.round(v * 100) + '%');
  bindRange('cfg-search-radius', 'searchRadius', (v) => Math.round(v) + 'px');
  bindRange('cfg-search-opacity', 'searchOpacity', (v) => Math.round(v * 100) + '%');
  bindSwitch('cfg-font-shadow', 'fontShadow');
  bindRange('cfg-font-size', 'fontSize', (v) => Math.round(v) + 'px');
  buildFontColors();
  buildAnimButtons();

  const stdBtn = document.getElementById('mode-standard');
  const minBtn = document.getElementById('mode-minimal');
  const syncMode = () => {
    stdBtn.classList.toggle('active', !loadConfig().settingsMinimal);
    minBtn.classList.toggle('active', !!loadConfig().settingsMinimal);
  };
  stdBtn.addEventListener('click', () => { saveConfig({ settingsMinimal: false }); syncMode(); });
  minBtn.addEventListener('click', () => { saveConfig({ settingsMinimal: true }); syncMode(); });
  syncMode();

  document.getElementById('reset-btn').addEventListener('click', async () => {
    const ok = await window.__confirm('确认还原全部设置为默认值？仅恢复样式/外观配置，不会删除站点、文件夹、分页、壁纸与待办数据。');
    if (!ok) return;
    resetStyleConfig();
    applyConfigToDom(loadConfig());
    syncMode();
    buildLayoutChips(); buildAnimButtons(); buildFontColors();
    renderAll();
    toast('设置已恢复默认（业务数据保留）');
  });
}
