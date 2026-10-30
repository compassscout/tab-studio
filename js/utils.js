/* utils.js — 工具函数：ID / URL 校验 / DOM 转义 / 防抖 / 打开方式 / toast / 下载 */

export function uid() {
  if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'id-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 10);
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeUrl(raw) {
  let v = String(raw || '').trim();
  if (!v) return { ok: false, reason: '网址不能为空' };
  if (!/^https?:\/\//i.test(v)) {
    v = 'https://' + v;
  }
  let u;
  try { u = new URL(v); } catch (e) { return { ok: false, reason: '网址格式不正确' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, reason: '仅支持 http / https 网址' };
  }
  return { ok: true, url: u.href };
}

export function debounce(fn, wait) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function hasChromeTabs() {
  return !!(typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.create === 'function');
}

export function openUrl(url, { background = false } = {}) {
  if (hasChromeTabs()) {
    try { chrome.tabs.create({ url, active: !background }); return; } catch (e) {}
  }
  window.open(url, '_blank');
}

let toastTimer = null;
export function toast(msg, duration = 1800) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

export function downloadFile(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function compressImageToDataURL(dataUrl, maxEdge = 640, quality = 0.72) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth || 1, h = img.naturalHeight || 1;
      if (Math.max(w, h) > maxEdge) {
        const k = maxEdge / Math.max(w, h);
        w = Math.round(w * k); h = Math.round(h * k);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function nowISO() { return new Date().toISOString(); }

export function hostNameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; }
}

export function firstCharOf(name) {
  const s = String(name || '?').trim();
  return s ? s.slice(0, 1).toUpperCase() : '?';
}
