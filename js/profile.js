/* profile.js — 我的 Tab：头像昵称 / 同步 UI / 备份导出导入(.infinity) / 修复数据 / 评价占位 */
import { exportAll, importAll, getState } from './store.js';
import { db } from './db.js';
import { loadConfig, saveConfig, applyConfigToDom, loadMeta, saveMeta } from './config.js';
import { downloadFile, todayISO, nowISO, toast, debounce } from './utils.js';
import { renderAll } from './render.js';

function initProfileInfo() {
  const meta = loadMeta();
  const nameInput = document.getElementById('me-name');
  const avatar = document.getElementById('me-avatar');
  nameInput.value = meta.nickname || '';
  avatar.textContent = (meta.nickname || '博').slice(0, 1).toUpperCase();
  nameInput.addEventListener('input', debounce(() => {
    saveMeta({ nickname: nameInput.value.trim() });
    avatar.textContent = (nameInput.value.trim() || '博').slice(0, 1).toUpperCase();
  }, 400));
  avatar.addEventListener('click', () => toast('头像自定义上传为二期功能（一期占位）'));
}

function initSyncUI() {
  const meta = loadMeta();
  const toggle = document.getElementById('sync-toggle');
  toggle.checked = !!meta.syncEnabled;
  toggle.addEventListener('change', () => {
    saveMeta({ syncEnabled: toggle.checked });
    toast(toggle.checked ? '云同步开关已开启（二期接入，当前仅本地备份）' : '云同步已关闭（仅本地备份）');
  });
  document.getElementById('last-sync-time').textContent = meta.lastSyncTime || '暂无记录';
  document.getElementById('manage-backups-btn').addEventListener('click', () => toast('历史备份节点管理为二期功能'));
  document.getElementById('backup-now-btn').addEventListener('click', () => doExport(true));
}

export async function doExport(markSync = false) {
  const data = await exportAll();
  const payload = {
    version: 1,
    exportedAt: nowISO(),
    data: { ...data, config: loadConfig() },
  };
  const filename = `infinityBackup-${todayISO()}.infinity`;
  downloadFile(filename, JSON.stringify(payload, null, 2), 'application/json');
  if (markSync) {
    saveMeta({ lastSyncTime: nowISO() });
    document.getElementById('last-sync-time').textContent = new Date().toLocaleString();
  }
  toast('备份文件已导出');
}

function isValidBackup(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.version !== 1) return false;
  if (!obj.data || typeof obj.data !== 'object') return false;
  return ['sites', 'folders', 'pages', 'wallpapers', 'todos'].every((k) => Array.isArray(obj.data[k]));
}

async function doImport(file) {
  let text;
  try { text = await file.text(); } catch (e) { toast('文件读取失败'); return; }
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { toast('备份文件 JSON 解析失败，现有数据未改动'); return; }
  if (!isValidBackup(parsed)) { toast('备份结构缺失或版本不符，现有数据未改动'); return; }
  try {
    await importAll(parsed.data);
    if (parsed.data.config && typeof parsed.data.config === 'object') {
      saveConfig(parsed.data.config);
      applyConfigToDom(loadConfig());
    }
    renderAll();
    toast('导入完成，已覆盖恢复全部数据');
  } catch (e) { toast('导入失败，现有数据未完整覆盖'); }
}

function initImport() {
  const btn = document.getElementById('import-btn');
  const input = document.getElementById('import-file');
  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.infinity')) { toast('仅识别 .infinity 备份文件'); input.value = ''; return; }
    doImport(file);
    input.value = '';
  });
}

async function doRepair() {
  const summary = [];
  const { sites, folders, pages, wallpapers, todos } = getState();

  sites.forEach((s) => {
    let fixed = false;
    if (!s.id) { s.id = 'site-' + Date.now() + Math.random().toString(16).slice(2, 6); fixed = true; }
    if (typeof s.name !== 'string') { s.name = '未命名'; fixed = true; }
    if (!/^https?:\/\//i.test(s.url || '')) { s.url = 'https://example.com'; fixed = true; }
    if (!['color', 'preset', 'upload'].includes(s.iconType)) { s.iconType = 'color'; fixed = true; }
    if (typeof s.color !== 'string') { s.color = '#4c8bf5'; fixed = true; }
    if (!Array.isArray(s.description)) s.description = s.description || '';
    if (fixed) { db.put('sites', s); summary.push(`站点「${s.name}」字段已补全`); }
  });
  folders.forEach((f) => {
    let fixed = false;
    if (!f.id) { f.id = 'folder-' + Date.now(); fixed = true; }
    if (typeof f.name !== 'string') { f.name = '未命名文件夹'; fixed = true; }
    if (!Array.isArray(f.iconIds)) { f.iconIds = []; fixed = true; }
    if (fixed) { db.put('folders', f); summary.push(`文件夹「${f.name}」字段已补全`); }
  });
  pages.forEach((p) => {
    let fixed = false;
    if (!p.id) { p.id = 'page-' + Date.now(); fixed = true; }
    if (typeof p.name !== 'string') { p.name = '分页'; fixed = true; }
    if (!Array.isArray(p.siteIds)) { p.siteIds = []; fixed = true; }
    if (typeof p.sortOrder !== 'number') { p.sortOrder = 0; fixed = true; }
    if (fixed) { db.put('pages', p); summary.push(`分页「${p.name}」字段已补全`); }
  });
  wallpapers.forEach((w) => {
    let fixed = false;
    if (!w.id) { w.id = 'wp-' + Date.now(); fixed = true; }
    if (typeof w.src !== 'string' || !w.src) { w.src = 'gradient:linear-gradient(135deg,#2b5876,#4e4376)'; fixed = true; }
    if (typeof w.favorite !== 'boolean') { w.favorite = false; fixed = true; }
    if (typeof w.addedAt !== 'number') { w.addedAt = Date.now(); fixed = true; }
    if (fixed) { db.put('wallpapers', w); summary.push('一条壁纸记录字段已补全'); }
  });
  todos.forEach((t) => {
    let fixed = false;
    if (!t.id) { t.id = 'todo-' + Date.now(); fixed = true; }
    if (typeof t.text !== 'string') { t.text = ''; fixed = true; }
    if (typeof t.done !== 'boolean') { t.done = false; fixed = true; }
    if (fixed) { db.put('todos', t); summary.push('待办记录字段已补全'); }
  });

  renderAll();
  const head = summary.length ? `修复完成，共处理 ${summary.length} 条记录：` : '数据校验通过，无需修复。';
  window.alert(head + '\n' + summary.slice(0, 20).join('\n'));
}

function initRepair() {
  document.getElementById('repair-btn').addEventListener('click', doRepair);
}

function initRating() {
  const stars = document.querySelectorAll('#stars .star');
  stars.forEach((s) => s.addEventListener('click', () => {
    const v = parseInt(s.dataset.v, 10);
    stars.forEach((x) => x.classList.toggle('on', parseInt(x.dataset.v, 10) <= v));
    toast('感谢评价（一期仅记录本地点击）');
  }));
  document.getElementById('feedback-btn').addEventListener('click', () => toast('反馈通道为二期功能（一期占位）'));
}

export function initProfile() {
  initProfileInfo(); initSyncUI(); initImport(); initRepair(); initRating();
  document.getElementById('export-btn').addEventListener('click', () => doExport(false));
}
