/* utils.js — 通用工具：ID / URL / 转义 / 文件 / 打开与提示 */

export function uid(prefix = '') {
  const rand = (crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
  return prefix ? prefix + '-' + rand : rand;
}

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 严格 URL 规范化：只接受 http/https，无协议自动补 https */
export function normalizeUrl(raw) {
  let v = String(raw || '').trim();
  if (!v) return { ok: false, reason: '网址不能为空' };
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^https?:\/\//i.test(v)) {
    return { ok: false, reason: '仅支持 http / https 网址' };
  }
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  let u;
  try { u = new URL(v); } catch (e) { return { ok: false, reason: '网址格式不正确' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, reason: '仅支持 http / https 网址' };
  if (!u.hostname || !u.hostname.includes('.')) return { ok: false, reason: '网址缺少有效域名' };
  return { ok: true, url: u.href };
}

export function hostNameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return String(url || ''); }
}

export function firstChar(name) {
  const s = String(name || '?').trim();
  return s ? s.slice(0, 1).toUpperCase() : '?';
}

export function debounce(fn, wait = 300) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function hasChrome() {
  return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
}

export function hasTabs() {
  return hasChrome() && !!chrome.tabs && typeof chrome.tabs.create === 'function';
}

/** 打开地址：新标签页 / 当前标签页 */
export function openUrl(url, { newTab = true } = {}) {
  if (!url) return;
  if (hasTabs()) {
    try {
      if (newTab) chrome.tabs.create({ url, active: true });
      else chrome.tabs.update({ url });
      return;
    } catch (e) { /* 落兜底 */ }
  }
  if (newTab) window.open(url, '_blank', 'noopener');
  else location.href = url;
}

let toastTimer = null;
export function toast(message, duration = 1900) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

export function downloadFile(filename, content, mime = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadUrl(url, filename) {
  const a = document.createElement('a');
  a.href = url; a.download = filename || '';
  a.target = '_blank';
  document.body.appendChild(a); a.click(); a.remove();
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** 本地压缩图片，避免 IndexedDB 被大图撑爆 */
export function compressImage(dataUrl, maxEdge = 1920, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { naturalWidth: w, naturalHeight: h } = img;
      if (!w || !h) { resolve(dataUrl); return; }
      if (Math.max(w, h) > maxEdge) {
        const k = maxEdge / Math.max(w, h);
        w = Math.round(w * k); h = Math.round(h * k);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
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

export function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

export function pct(v) { return Math.round(v * 100) + '%'; }
