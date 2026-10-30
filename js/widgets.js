/* widgets.js — 待办 / 笔记 / 天气 / 文件夹总览 */
import {
  getState, addTodo, toggleTodo, deleteTodo, pendingTodoCount,
  getNote, saveNote, getFolder, deleteFolder, addFolder,
} from './store.js';
import { loadConfig, loadMeta, saveMeta } from './config.js';
import { openModal, closeModal, confirmAction, askText } from './dialog.js';
import { escapeHtml, debounce, toast } from './utils.js';
import { renderGrid, refreshWeatherLabel } from './render.js';

/* ---------------- 待办 ---------------- */
function renderTodos() {
  const list = document.getElementById('todo-list');
  const empty = document.getElementById('todo-empty');
  if (!list) return;
  const todos = getState().todos;
  list.innerHTML = '';
  empty?.classList.toggle('hidden', todos.length > 0);
  todos.forEach((todo) => {
    const row = document.createElement('div');
    row.className = 'todo-item' + (todo.done ? ' done' : '');
    row.innerHTML = `
      <button class="todo-check" title="完成"><svg><use href="#i-plus"/></svg></button>
      <span class="todo-text"></span>
      <button class="todo-del" title="删除"><svg><use href="#i-trash"/></svg></button>`;
    row.querySelector('.todo-text').textContent = todo.text;
    row.querySelector('.todo-check').addEventListener('click', async () => {
      await toggleTodo(todo.id, !todo.done);
      renderTodos();
      renderGrid();
    });
    row.querySelector('.todo-del').addEventListener('click', async () => {
      await deleteTodo(todo.id);
      renderTodos();
      renderGrid();
    });
    list.appendChild(row);
  });
}

async function addNewTodo() {
  const input = document.getElementById('todo-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  await addTodo(text);
  input.value = '';
  renderTodos();
  renderGrid();
}

export function openTodo() {
  renderTodos();
  openModal('todo-modal');
  setTimeout(() => document.getElementById('todo-input')?.focus(), 120);
}

/* ---------------- 笔记 ---------------- */
let noteTimer = null;
export function openNote() {
  const textarea = document.getElementById('note-text');
  const state = document.getElementById('note-state');
  if (textarea) textarea.value = getNote().text || '';
  if (state) state.textContent = '已保存';
  openModal('note-modal');
  setTimeout(() => textarea?.focus(), 120);
}

/* ---------------- 天气 ---------------- */
const DEFAULT_CITY = { name: '北京', latitude: 39.9042, longitude: 116.4074 };
const WMO = {
  0: ['晴', '☀'], 1: ['大部晴朗', '☀'], 2: ['多云', '☁'], 3: ['阴', '☁'],
  45: ['雾', '☁'], 48: ['雾凇', '☁'],
  51: ['小毛毛雨', '🌦'], 53: ['毛毛雨', '🌦'], 55: ['强毛毛雨', '🌦'],
  61: ['小雨', '🌧'], 63: ['中雨', '🌧'], 65: ['大雨', '🌧'],
  66: ['冻雨', '🌧'], 67: ['强冻雨', '🌧'],
  71: ['小雪', '🌨'], 73: ['中雪', '🌨'], 75: ['大雪', '🌨'], 77: ['雪粒', '🌨'],
  80: ['阵雨', '🌦'], 81: ['强阵雨', '🌧'], 82: ['暴雨', '⛈'],
  85: ['阵雪', '🌨'], 86: ['强阵雪', '🌨'],
  95: ['雷阵雨', '⛈'], 96: ['雷阵雨伴冰雹', '⛈'], 99: ['强雷暴', '⛈'],
};

function weatherMeta() {
  const meta = loadMeta();
  return meta.weatherCity || DEFAULT_CITY;
}

async function fetchWeather(cityOverride) {
  const body = document.getElementById('weather-body');
  if (!body) return;
  const cfg = loadConfig();
  if (!cfg.network) {
    body.innerHTML = '<p class="muted">已关闭联网，天气不可用。可在「设置 → 通用」重新开启。</p>';
    return;
  }
  const city = cityOverride || weatherMeta();
  body.innerHTML = '<p class="muted">正在获取天气…</p>';
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}`
      + '&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min'
      + '&timezone=auto&forecast_days=3';
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error('http ' + res.status);
    const data = await res.json();
    const temp = data.current?.temperature_2m;
    const code = data.current?.weather_code;
    const desc = WMO[code] || ['未知', '☁'];
    const daily = data.daily || {};
    const days = (daily.time || []).map((t, i) => ({
      date: t,
      code: daily.weather_code?.[i],
      max: daily.temperature_2m_max?.[i],
      min: daily.temperature_2m_min?.[i],
    }));
    const payload = { city: city.name, temp, code, desc: desc[0], icon: desc[1], days, ts: Date.now() };
    saveMeta({ weather: payload, weatherCity: city });
    renderWeather(payload);
    refreshWeatherLabel();
  } catch (e) {
    body.innerHTML = '<p class="muted">天气获取失败，请稍后重试；离线时不影响其他功能。</p>';
  }
}

function renderWeather(w) {
  const body = document.getElementById('weather-body');
  if (!body || !w) return;
  const dayRows = (w.days || []).slice(1, 3).map((d) => {
    const desc = WMO[d.code] || ['—', '☁'];
    const date = new Date(d.date);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;
    return `<div class="w-day"><b>${label}</b><span>${Math.round(d.max)}° / ${Math.round(d.min)}°</span></div>`;
  }).join('');
  body.innerHTML = `
    <div class="w-now">
      <div class="w-ico"><svg><use href="#i-weather"/></svg></div>
      <div>
        <div class="w-temp">${Math.round(w.temp)}°</div>
        <div class="w-meta"><b>${escapeHtml(w.city || '')}</b><span>${escapeHtml(w.desc || '')}</span></div>
      </div>
    </div>
    <div class="w-days">${dayRows}</div>`;
}

export function openWeather() {
  openModal('weather-modal');
  const meta = loadMeta();
  const w = meta.weather;
  const body = document.getElementById('weather-body');
  if (w && Date.now() - (w.ts || 0) < 15 * 60 * 1000) renderWeather(w);
  else fetchWeather(weatherMeta());
  const input = document.getElementById('weather-city');
  if (input) input.value = weatherMeta().name || '';
}

async function searchCity() {
  const input = document.getElementById('weather-city');
  const name = input?.value.trim();
  if (!name) return;
  const cfg = loadConfig();
  if (!cfg.network) { toast('已关闭联网'); return; }
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=zh&format=json`);
    const data = await res.json();
    const hit = data?.results?.[0];
    if (!hit) { toast('没有找到这个城市'); return; }
    const city = { name: hit.name, latitude: hit.latitude, longitude: hit.longitude };
    saveMeta({ weatherCity: city });
    await fetchWeather(city);
  } catch (e) { toast('城市查询失败'); }
}

/* ---------------- 文件夹总览 ---------------- */
function renderFoldersList() {
  const wrap = document.getElementById('folders-list');
  if (!wrap) return;
  wrap.innerHTML = '';

  const builtin = (title, desc, iconId, onClick) => {
    const row = document.createElement('div');
    row.className = 'folder-row builtin';
    const icon = document.createElement('div');
    icon.className = 'fr-icon single';
    icon.innerHTML = `<svg><use href="#${iconId}"/></svg>`;
    const name = document.createElement('span');
    name.className = 'fr-name';
    name.innerHTML = `${title}<small>${desc}</small>`;
    const arrow = document.createElement('span');
    arrow.className = 'fr-count';
    arrow.textContent = '›';
    row.appendChild(icon); row.appendChild(name); row.appendChild(arrow);
    row.addEventListener('click', onClick);
    wrap.appendChild(row);
  };
  builtin('历史记录', '最近 30 天浏览过的网页', 'i-globe', () => {
    closeModal('folders-modal');
    window.app?.openHistory?.();
  });
  builtin('书签', 'Chrome 书签（需授权）', 'i-star', () => {
    closeModal('folders-modal');
    window.app?.openBookmarks?.();
  });

  const line = document.createElement('div');
  line.className = 'bd-group';
  line.textContent = '我的文件夹';
  wrap.appendChild(line);

  const folders = getState().folders;
  if (!folders.length) {
    const tip = document.createElement('div');
    tip.className = 'empty-tip';
    tip.textContent = '还没有文件夹。点右上角「新建」，或把站点拖到另一个站点上自动建组。';
    wrap.appendChild(tip);
    return;
  }
  folders.forEach((folder) => {
    const row = document.createElement('div');
    row.className = 'folder-row';
    const icon = document.createElement('div');
    icon.className = 'fr-icon';
    folder.iconIds.slice(0, 4).forEach(() => icon.appendChild(document.createElement('i')));
    const name = document.createElement('span');
    name.className = 'fr-name';
    name.textContent = folder.name;
    const count = document.createElement('span');
    count.className = 'fr-count';
    count.textContent = `${folder.iconIds.length} 个图标`;
    const del = document.createElement('button');
    del.className = 'fr-del';
    del.title = '删除文件夹';
    del.innerHTML = '<svg style="width:14px;height:14px"><use href="#i-trash"/></svg>';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirmAction(`删除文件夹「${folder.name}」？里面的站点会回到第 1 页，不会删除。`, { okText: '删除' });
      if (!ok) return;
      await deleteFolder(folder.id);
      renderFoldersList();
      renderGrid();
      toast('文件夹已删除，站点已移回第 1 页');
    });
    row.appendChild(icon); row.appendChild(name); row.appendChild(count); row.appendChild(del);
    row.addEventListener('click', () => {
      closeModal('folders-modal');
      window.app?.openFolder?.(folder.id);
    });
    wrap.appendChild(row);
  });
}

export function openFolders() {
  renderFoldersList();
  openModal('folders-modal');
}

export function initWidgets() {
  /* 天气：启动时静默刷新一次，让小组件显示实时温度 */
  const meta = loadMeta();
  const cached = meta.weather;
  const cfg = loadConfig();
  if (cfg.network && (!cached || Date.now() - (cached.ts || 0) > 20 * 60 * 1000)) {
    fetchWeather(weatherMeta()).catch(() => {});
  }

  /* 待办 */
  document.getElementById('todo-add')?.addEventListener('click', addNewTodo);
  document.getElementById('todo-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addNewTodo(); }
  });

  /* 笔记 */
  const noteText = document.getElementById('note-text');
  const noteState = document.getElementById('note-state');
  noteText?.addEventListener('input', debounce(async () => {
    if (noteState) noteState.textContent = '保存中…';
    await saveNote(noteText.value);
    if (noteState) noteState.textContent = '已保存';
  }, 450));

  /* 天气 */
  document.getElementById('weather-search')?.addEventListener('click', searchCity);
  document.getElementById('weather-city')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchCity();
  });

  /* 文件夹总览 */
  document.getElementById('folders-new')?.addEventListener('click', async () => {
    const name = await askText({ title: '新建文件夹', placeholder: '文件夹名称', okText: '创建' });
    if (!name) return;
    await addFolder(name, []);
    renderFoldersList();
    renderGrid();
    toast('文件夹已创建');
  });
}
