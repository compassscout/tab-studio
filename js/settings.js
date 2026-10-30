/* settings.js — 设置面板（动态构建 + 双向同步） */
import { loadConfig, saveConfig, resetConfig, LAYOUTS } from './config.js';
import { renderAll } from './render.js';
import { reflowPages, syncWidgetSlots } from './store.js';
import { currentWallpaper, openLibrary, refreshThumb, startAutoRotate, stopAutoRotate } from './wallpaper.js';
import { updateWallpaper } from './store.js';
import { toast } from './utils.js';
import { confirmAction, askText } from './dialog.js';

let root = null;
let built = false;

const RANGE_SPECS = {
  wallMask: { label: '遮罩浓度', min: 0, max: 100, step: 1, unit: '%' },
  wallBlur: { label: '模糊度', min: 0, max: 20, step: 1, unit: 'px' },
  iconRadius: { label: '图标圆角', min: 0, max: 50, step: 1, unit: '%' },
  iconOpacity: { label: '图标不透明度', min: 0.2, max: 1, step: 0.05, unit: '%', percent: true },
  iconScale: { label: '图标大小', min: 0.7, max: 1.25, step: 0.05, unit: '%', percent: true },
  fontSize: { label: '字体大小', min: 11, max: 18, step: 1, unit: 'px' },
  searchScale: { label: '搜索框大小', min: 0.7, max: 1.3, step: 0.05, unit: '%', percent: true },
  searchRadius: { label: '搜索框圆角', min: 0, max: 30, step: 1, unit: 'px' },
  searchOpacity: { label: '搜索框不透明度', min: 0.3, max: 1, step: 0.05, unit: '%', percent: true },
  dockSize: { label: 'Dock 图标大小', min: 36, max: 64, step: 2, unit: 'px' },
};

const FONT_COLORS = ['rgb(255, 255, 255)', 'rgb(221, 221, 221)', 'rgb(255, 214, 10)', 'rgb(255, 149, 0)',
  'rgb(255, 78, 80)', 'rgb(52, 199, 89)', 'rgb(100, 210, 255)', 'rgb(10, 132, 255)'];

function el(tag, cls, html) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function group(id, title, sub = '') {
  const sec = el('section', 'sgroup');
  sec.dataset.group = id;
  const head = el('button', 'sgroup-head');
  head.innerHTML = `<span>${title}</span>${sub ? `<span class="sgroup-sub">${sub}</span>` : ''}<svg class="chev"><use href="#i-arrow-right"/></svg>`;
  head.addEventListener('click', () => sec.classList.toggle('collapsed'));
  const body = el('div', 'sgroup-body');
  sec.appendChild(head); sec.appendChild(body);
  root.appendChild(sec);
  return body;
}

function row(label, control, hint = '') {
  const r = el('div', 'srow');
  const left = el('span', 'slabel');
  left.textContent = label;
  if (hint) {
    const h = el('span', 'hint');
    h.textContent = hint;
    left.appendChild(h);
  }
  const ctrl = el('span', 'scontrol');
  ctrl.appendChild(control);
  r.appendChild(left); r.appendChild(ctrl);
  return r;
}

function makeSwitch(key) {
  const label = el('label', 'switch');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.dataset.key = key;
  const span = document.createElement('span');
  label.appendChild(input); label.appendChild(span);
  input.addEventListener('change', () => {
    saveConfig({ [key]: input.checked });
    if (key === 'wallAuto') { if (input.checked) startAutoRotate(); else stopAutoRotate(); }
    if (key === 'showWidgets') { syncWidgetSlots().then(() => reflowPages()).then(() => renderAll()); }
  });
  return label;
}

function makeRange(key) {
  const spec = RANGE_SPECS[key];
  const wrap = el('span', 'scontrol');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = spec.min; input.max = spec.max; input.step = spec.step;
  input.dataset.key = key;
  const val = el('span', 'range-val');
  val.dataset.val = key;
  wrap.appendChild(input); wrap.appendChild(val);
  const update = () => {
    const v = parseFloat(input.value);
    val.textContent = spec.percent ? Math.round(v * 100) + '%' : Math.round(v) + spec.unit;
  };
  input.addEventListener('input', () => {
    const raw = parseFloat(input.value);
    saveConfig({ [key]: raw });
    update();
    if (key === 'wallMask' || key === 'wallBlur') refreshThumb();
  });
  return { wrap, input, update };
}

function badge(text) { return el('span', 'badge', text); }

function build() {
  root = document.getElementById('settings-root');
  if (!root) return;
  root.innerHTML = '';

  /* 壁纸 */
  {
    const body = group('wallpaper', '壁纸', '');
    const rowWp = el('div', 'wp-row');
    const thumb = el('div', 'wp-thumb'); thumb.id = 'wp-thumb';
    const info = el('div', 'wp-info', '<b id="wp-name">—</b><span id="wp-type">本地壁纸</span>');
    rowWp.appendChild(thumb); rowWp.appendChild(info);
    body.appendChild(rowWp);
    const actions = el('div', 'wp-actions-row');
    const change = el('button', 'btn primary small', '更换壁纸');
    change.addEventListener('click', () => { closePanelForModal(); openLibrary('all'); });
    const fav = el('button', 'btn small ghost', '收藏当前');
    fav.addEventListener('click', async () => {
      const wp = currentWallpaper();
      if (!wp) return;
      await updateWallpaper(wp.id, { favorite: !wp.favorite });
      toast(wp.favorite ? '已取消收藏' : '已加入收藏');
      syncWpInfo();
    });
    actions.appendChild(change); actions.appendChild(fav);
    body.appendChild(actions);

    const mask = makeRange('wallMask');
    body.appendChild(row('遮罩浓度', mask.wrap));
    const blur = makeRange('wallBlur');
    body.appendChild(row('模糊度', blur.wrap));

    body.appendChild(row('定时轮换', makeSwitch('wallAuto')));
    body.appendChild(row('随机时只挑收藏壁纸', makeSwitch('wallFavoriteOnly')));
    const sel = el('select');
    [['1h', '1 小时'], ['6h', '6 小时'], ['12h', '12 小时'], ['24h', '24 小时'], ['session', '每次打开新标签页']].forEach(([v, l]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = l; sel.appendChild(o);
    });
    sel.dataset.key = 'wallInterval';
    sel.addEventListener('change', () => {
      saveConfig({ wallInterval: sel.value });
      if (loadConfig().wallAuto) startAutoRotate();
    });
    body.appendChild(row('轮换频率', sel));
  }

  /* 打开方式 */
  {
    const body = group('open', '目标打开方式', '仅站内');
    body.appendChild(row('在新标签页打开网站', makeSwitch('openSiteNewTab')));
    body.appendChild(row('在新标签页打开第三方搜索结果', makeSwitch('openSearchNewTab')));
    body.appendChild(row('在新标签页打开书签链接', makeSwitch('openBookmarkNewTab')));
    body.appendChild(row('在新标签页打开历史记录', makeSwitch('openHistoryNewTab')));
  }

  /* 视图 */
  {
    const body = group('view', '视图');
    body.appendChild(row('右下角随机壁纸按钮', makeSwitch('showWindmill')));
    body.appendChild(row('左右翻页按钮', makeSwitch('showPageArrows')));
    body.appendChild(row('显示内置小组件（天气 / 待办 / 笔记 / 文件夹 / 设置）', makeSwitch('showWidgets')));
  }

  /* Dock */
  {
    const body = group('dock', 'Dock（底部程序坞）');
    body.appendChild(row('显示 Dock', makeSwitch('showDock')));
    body.appendChild(row('悬停放大', makeSwitch('dockMagnify')));
    body.appendChild(row('图标大小', makeRange('dockSize').wrap));
    body.appendChild(row('提示', el('span', 'hint', '把网格图标拖到底部即可固定；右键 Dock 图标可移除'), ''));
  }

  /* 布局 */
  {
    const body = group('layout', '布局');
    const grid = el('div', 'layout-grid');
    LAYOUTS.forEach((l) => {
      const chip = el('button', 'layout-chip');
      chip.dataset.layout = l.id;
      const preview = el('div', 'lg');
      preview.style.gridTemplateColumns = `repeat(${l.cols}, 1fr)`;
      for (let i = 0; i < l.rows * l.cols; i++) preview.appendChild(el('i'));
      const label = el('span', 'lt', l.label);
      chip.appendChild(preview); chip.appendChild(label);
      chip.addEventListener('click', async () => {
        saveConfig({ layoutId: l.id });
        await reflowPages();
        renderAll();
        syncActiveLayout();
        toast(`布局已切换为 ${l.label}`);
      });
      grid.appendChild(chip);
    });
    body.appendChild(grid);
  }

  /* 图标 */
  {
    const body = group('icon', '图标');
    body.appendChild(row('隐藏图标名称', makeSwitch('hideIconName')));
    body.appendChild(row('图标阴影', makeSwitch('iconShadow')));
    body.appendChild(row('启动动画', makeSwitch('startAnimation')));
    body.appendChild(row('图标圆角', makeRange('iconRadius').wrap));
    body.appendChild(row('图标不透明度', makeRange('iconOpacity').wrap));
    body.appendChild(row('图标大小', makeRange('iconScale').wrap));
  }

  /* 搜索 */
  {
    const body = group('search', '搜索框');
    body.appendChild(row('隐藏搜索框', makeSwitch('hideSearch')));
    body.appendChild(row('显示搜索建议（需联网）', makeSwitch('searchSuggest')));
    body.appendChild(row('保留搜索框内容', makeSwitch('keepSearchInput')));
    body.appendChild(row('隐藏搜索类别', makeSwitch('hideSearchCategory')));
    body.appendChild(row('隐藏搜索按钮', makeSwitch('hideSearchButton')));
    body.appendChild(row('搜索框大小', makeRange('searchScale').wrap));
    body.appendChild(row('搜索框圆角', makeRange('searchRadius').wrap));
    body.appendChild(row('搜索框不透明度', makeRange('searchOpacity').wrap));
  }

  /* 字体 */
  {
    const body = group('font', '字体');
    body.appendChild(row('字体阴影', makeSwitch('fontShadow')));
    body.appendChild(row('字体大小', makeRange('fontSize').wrap));
    const swatches = el('div', 'swatches');
    FONT_COLORS.forEach((color) => {
      const sw = el('button', 'swatch');
      sw.style.background = color;
      sw.dataset.color = color;
      sw.addEventListener('click', () => {
        saveConfig({ fontColor: color });
        syncSwatches();
      });
      swatches.appendChild(sw);
    });
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.id = 'font-color-picker';
    picker.addEventListener('input', () => {
      saveConfig({ fontColor: picker.value });
      syncSwatches();
    });
    swatches.appendChild(picker);
    body.appendChild(row('字体颜色', swatches));
  }

  /* 动画 */
  {
    const body = group('anim', '动画');
    const seg = el('div', 'seg');
    seg.id = 'anim-seg';
    [['default', '默认'], ['bounce', '回弹'], ['fade', '淡入']].forEach(([v, l]) => {
      const b = el('button', '', l);
      b.dataset.anim = v;
      b.addEventListener('click', () => { saveConfig({ animType: v }); syncAnim(); });
      seg.appendChild(b);
    });
    body.appendChild(row('切换动画', seg));
  }

  /* 搜索引擎 */
  {
    const body = group('engines', '搜索引擎');
    body.appendChild(row('内置', el('span', 'hint', '百度 / Google / 必应 / Yahoo'), ''));
    const list = el('div', 'engine-list');
    const renderList = () => {
      list.innerHTML = '';
      const cfg = loadConfig();
      const custom = cfg.customEngines || [];
      if (!custom.length) {
        list.innerHTML = '<div class="engine-empty">还没有自定义引擎。点下方按钮添加，例如知乎、B 站、淘宝。</div>';
        return;
      }
      custom.forEach((engine) => {
        const item = el('div', 'engine-item');
        const dot = el('span', 'engine-dot');
        dot.textContent = engine.letter || (engine.name || '自').slice(0, 1);
        dot.style.background = engine.color || '#2d6bfe';
        const text = el('div', 'engine-item-text');
        text.innerHTML = `<b></b><span></span>`;
        text.querySelector('b').textContent = engine.name;
        text.querySelector('span').textContent = engine.template;
        const del = el('button', 'btn small danger-ghost', '删除');
        del.addEventListener('click', async () => {
          const ok = await confirmAction(`删除搜索引擎「${engine.name}」？`, { okText: '删除' });
          if (!ok) return;
          const next = (loadConfig().customEngines || []).filter((x) => x.id !== engine.id);
          const patch = { customEngines: next };
          if (loadConfig().searchEngine === engine.id) patch.searchEngine = 'baidu';
          saveConfig(patch);
          renderList();
          toast('已删除');
        });
        item.appendChild(dot); item.appendChild(text); item.appendChild(del);
        list.appendChild(item);
      });
    };
    renderList();
    const add = el('button', 'btn small', '＋ 添加搜索引擎');
    add.addEventListener('click', async () => {
      const name = await askText({ title: '添加搜索引擎', placeholder: '名称，例如 知乎', okText: '下一步' });
      if (!name) return;
      const template = await askText({
        title: `「${name}」的搜索地址`,
        placeholder: 'https://www.zhihu.com/search?q=%s',
        value: 'https://www.baidu.com/s?wd=%s',
        okText: '保存',
      });
      if (!template) return;
      if (!template.includes('%s')) { toast('地址里需要用 %s 表示关键词位置'); return; }
      const palette = ['#2d6bfe', '#e1251b', '#0066ff', '#00a6a0', '#8e44ad', '#ff6a00'];
      const engine = {
        id: 'custom-' + Date.now().toString(36),
        name,
        letter: name.slice(0, 1),
        color: palette[Math.floor(Math.random() * palette.length)],
        template,
      };
      saveConfig({ customEngines: [...(loadConfig().customEngines || []), engine] });
      renderList();
      toast('已添加，可在搜索框左侧引擎菜单中切换');
    });
    body.appendChild(list);
    body.appendChild(row('自定义', add, '用 %s 代表关键词'));
  }

  /* 通用 */
  {
    const body = group('general', '通用');
    body.appendChild(row('允许可选联网（在线壁纸 / 搜索建议 / 天气）', makeSwitch('network'), '关闭后全部走本地'));
    const reset = el('button', 'btn small danger-ghost', '还原所有设置');
    reset.addEventListener('click', async () => {
      const ok = await confirmAction('还原所有外观设置？站点、文件夹、分页、壁纸与待办不会删除。', { okText: '还原' });
      if (!ok) return;
      resetConfig();
      renderAll();
      refreshThumb();
      applyAll();
      toast('设置已还原（数据未删除）');
    });
    body.appendChild(row('重置设置', reset, '仅样式，不动数据'));
  }

  built = true;
  applyAll();
}

function applyAll() {
  const cfg = loadConfig();
  root?.querySelectorAll('[data-key]').forEach((input) => {
    const key = input.dataset.key;
    if (!(key in cfg)) return;
    if (input.type === 'checkbox') input.checked = !!cfg[key];
    else input.value = cfg[key];
    if (input.type === 'range') {
      const val = root.querySelector(`[data-val="${key}"]`);
      const spec = RANGE_SPECS[key];
      if (val && spec) {
        const v = parseFloat(input.value);
        val.textContent = spec.percent ? Math.round(v * 100) + '%' : Math.round(v) + spec.unit;
      }
    }
  });
  syncActiveLayout();
  syncAnim();
  syncSwatches();
  syncWpInfo();
  syncModeButtons();
}

function syncActiveLayout() {
  const cfg = loadConfig();
  root?.querySelectorAll('.layout-chip').forEach((c) => c.classList.toggle('active', c.dataset.layout === cfg.layoutId));
}
function syncAnim() {
  const cfg = loadConfig();
  root?.querySelectorAll('#anim-seg button').forEach((b) => b.classList.toggle('active', b.dataset.anim === cfg.animType));
}
function syncSwatches() {
  const cfg = loadConfig();
  root?.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('selected', s.dataset.color === cfg.fontColor));
  const picker = document.getElementById('font-color-picker');
  if (picker && /^#[0-9a-f]{6}$/i.test(cfg.fontColor)) picker.value = cfg.fontColor;
  if (picker && /^rgb/.test(cfg.fontColor)) {
    const m = cfg.fontColor.match(/\d+/g);
    if (m) picker.value = '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  }
}
function syncWpInfo() {
  const wp = currentWallpaper();
  const name = document.getElementById('wp-name');
  const type = document.getElementById('wp-type');
  if (name) name.textContent = wp ? (wp.name || '未命名壁纸') : '暂无壁纸';
  if (type) type.textContent = wp ? (wp.favorite ? '已收藏' : '本地壁纸') : '';
}
function syncModeButtons() {
  const cfg = loadConfig();
  document.getElementById('mode-standard')?.classList.toggle('active', !cfg.minimal);
  document.getElementById('mode-minimal')?.classList.toggle('active', !!cfg.minimal);
}

function closePanelForModal() {
  window.app?.closePanel?.();
}

export function initSettings() {
  if (!built) {
    build();
    document.getElementById('mode-standard')?.addEventListener('click', () => {
      saveConfig({ minimal: false });
      syncModeButtons();
    });
    document.getElementById('mode-minimal')?.addEventListener('click', () => {
      saveConfig({ minimal: true });
      syncModeButtons();
    });
  }
}

export function refreshSettingsUI() {
  if (!root) return;
  if (!built) build();
  applyAll();
}

