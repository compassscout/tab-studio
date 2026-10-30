/* addtab.js — 添加面板：分类树 + 预设站点列表 + 搜索过滤 + 添加到当前分页 */
import { CATEGORIES, presetsByCategory, PRESET_ICONS } from './presets.js';
import { addSite, getCurrentPage } from './store.js';
import { normalizeUrl, openUrl, toast, escapeHtml, hasChromeTabs } from './utils.js';
import { renderGrid } from './render.js';

let activeCat = 'all';
let keyword = '';

function renderTree() {
  const tree = document.getElementById('add-cat-tree');
  tree.innerHTML = '';
  const all = document.createElement('li');
  all.textContent = '全部';
  all.dataset.cat = 'all';
  if (activeCat === 'all') all.classList.add('active');
  all.addEventListener('click', () => { activeCat = 'all'; renderTree(); renderList(); });
  tree.appendChild(all);
  CATEGORIES.forEach((c) => {
    const li = document.createElement('li');
    li.textContent = c.label;
    li.dataset.cat = c.id;
    if (activeCat === c.id) li.classList.add('active');
    li.addEventListener('click', () => { activeCat = c.id; renderTree(); renderList(); });
    tree.appendChild(li);
  });
}

function renderList() {
  const list = document.getElementById('add-preview-list');
  list.innerHTML = '';
  const items = presetsByCategory(activeCat, keyword);
  if (items.length === 0) {
    list.innerHTML = '<div class="empty-grid-tip" style="color:#666;">没有匹配的站点</div>';
    return;
  }
  items.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'preset-card';
    const icon = p.iconType === 'preset' && p.iconValue
      ? (PRESET_ICONS[p.iconValue] || '🌐')
      : escapeHtml(p.name.slice(0, 1).toUpperCase());
    card.innerHTML = `
      <div class="pc-head">
        <div class="pc-icon" style="background:${escapeHtml(p.color || '#4c8bf5')};">${icon}</div>
        <div class="pc-name">${escapeHtml(p.name)}</div>
      </div>
      <div class="pc-desc">${escapeHtml(p.desc || '')}</div>
      <button class="btn btn-primary pc-add">添加</button>`;
    card.querySelector('.pc-add').addEventListener('click', async () => {
      const page = getCurrentPage();
      await addSite({
        name: p.name, url: p.url, iconType: p.iconType || 'color',
        iconValue: p.iconValue || '', color: p.color || '#4c8bf5',
        description: p.desc || '', pageId: page.id,
      });
      renderGrid();
      toast(`已添加「${p.name}」到当前分页`);
    });
    list.appendChild(card);
  });
}

export function initAddTab() {
  renderTree();
  renderList();
  const search = document.getElementById('add-search');
  const clear = document.getElementById('add-clear');
  search.addEventListener('input', () => {
    keyword = search.value;
    clear.classList.toggle('visible', !!keyword);
    renderList();
  });
  clear.addEventListener('click', () => { search.value = ''; keyword = ''; clear.classList.remove('visible'); renderList(); });

  const curBtn = document.getElementById('add-current-site-btn');
  if (!hasChromeTabs()) { curBtn.style.display = 'none'; return; }
  curBtn.addEventListener('click', async () => {
    try {
      const tabs = await new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
      const tab = tabs && tabs[0];
      if (!tab || !tab.url) { toast('未获取到当前页面'); return; }
      const check = normalizeUrl(tab.url);
      if (!check.ok) { toast('当前页面地址不支持添加'); return; }
      const page = getCurrentPage();
      await addSite({
        name: tab.title || check.url, url: check.url,
        iconType: 'color', color: '#4c8bf5', pageId: page.id,
      });
      renderGrid();
      toast('已添加当前页面');
    } catch (e) { toast('添加当前页面失败'); }
  });
}
