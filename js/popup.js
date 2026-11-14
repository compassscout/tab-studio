/* popup.js — 工具栏弹窗：添加当前网页 / 可选权限开关 / 打开工作台 */
import { initStore, getState, addSite, getCurrentPage } from './store.js';
import { hostNameOf } from './utils.js';

const $ = (id) => document.getElementById(id);

function setMsg(text, kind = '') {
  const el = $('msg');
  el.textContent = text || '';
  el.className = 'msg' + (kind ? ` ${kind}` : '');
}

async function initCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = String((tab && tab.url) || '');
  const isSelf = !!url && url.startsWith(chrome.runtime.getURL(''));
  const isWeb = /^https?:\/\//i.test(url);
  const addBtn = $('add-btn');

  if (!url || isSelf || !isWeb) {
    $('cur-title').textContent = isSelf ? '当前页是 TAB STUDIO 自己' : (!isWeb ? '当前页面不支持添加' : '没有可用页面');
    addBtn.disabled = true;
    return;
  }
  $('cur-title').textContent = String(tab.title || url).slice(0, 90);
  $('cur-host').textContent = hostNameOf(url);
  const fav = $('cur-icon');
  if (tab.favIconUrl && /^(https?:|data:image)/.test(tab.favIconUrl)) {
    fav.src = tab.favIconUrl;
    fav.hidden = false;
    fav.addEventListener('error', () => { fav.hidden = true; });
  }

  addBtn.addEventListener('click', async () => {
    addBtn.disabled = true;
    setMsg('');
    try {
      await initStore();
      if (getState().sites.some((s) => s.url === url)) {
        setMsg('这个网址已经在工作台里了', 'warn');
        addBtn.disabled = false;
        return;
      }
      const page = getCurrentPage();
      const result = await addSite({
        name: tab.title || hostNameOf(url),
        url,
        color: '#4c8bf5',
        pageId: page ? page.id : undefined,
      });
      setMsg(result.moved ? '已添加（当前页已满，顺延到后一页）' : '已添加，开着的新标签页会自动刷新', 'ok');
    } catch (e) {
      setMsg('添加失败：' + (e && e.message ? e.message : '未知错误'), 'err');
      addBtn.disabled = false;
    }
  });
}

function bindPerm(btnId, perm) {
  const btn = $(btnId);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const ok = await chrome.permissions.request({ permissions: [perm] });
      setMsg(ok ? `${perm === 'bookmarks' ? '书签' : '历史'}权限已开启，去新标签页里就能用` : '未获得权限（不影响其他功能）', ok ? 'ok' : 'warn');
    } catch (e) {
      setMsg('权限申请失败', 'err');
    }
    refreshPerm();
  });
}

async function refreshPerm() {
  for (const [id, perm] of [['perm-bookmarks', 'bookmarks'], ['perm-history', 'history']]) {
    const btn = $(id);
    if (!btn) continue;
    let has = false;
    try { has = await chrome.permissions.contains({ permissions: [perm] }); } catch (e) { /* 忽略 */ }
    btn.textContent = has ? '已开启' : '开启';
    btn.classList.toggle('on', has);
    btn.disabled = has;
  }
}

$('open-newtab').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html'), active: true });
  window.close();
});

bindPerm('perm-bookmarks', 'bookmarks');
bindPerm('perm-history', 'history');
initCurrentTab().catch(() => setMsg('读取当前页面失败', 'err'));
refreshPerm();
