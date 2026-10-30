/* favicon.js — 站点图标：自定义 → 本地内置库 → 本地缓存 → 在线兜底 → Chrome 缓存 → 首字色块 */
import { hasChrome, firstChar, hostNameOf } from './utils.js';
import { loadConfig } from './config.js';
import { db, ICON_STORE } from './db.js';

const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; /* 图标缓存 30 天 */
const SECOND_LEVEL = ['co.uk', 'com.cn', 'org.cn', 'net.cn', 'gov.cn', 'com.au', 'co.jp', 'com.hk', 'com.tw'];

/* 内置图标品牌主色：文件 → 圆底主色；深色底自动把单色图形反白 */
const BRAND_COLORS = {
  'youtube.svg': '#FF0000', 'github.svg': '#181717', 'huggingface.svg': '#FFD21E',
  'sinaweibo.svg': '#E6162D', 'tencentqq.svg': '#12B7F5', 'wechat.svg': '#07C160',
  'juejin.svg': '#1E80FF', 'bilibili.svg': '#00A1D6', 'zhihu.svg': '#0084FF',
  'discord.svg': '#5865F2', 'stackoverflow.svg': '#F48024', 'google.svg': '#4285F4',
  'dropbox.svg': '#0061FF', 'npm.svg': '#CB3837', 'bytedance.svg': '#325AB4',
  'figma.svg': '#F24E1E', 'tiktok.svg': '#010101', 'openai.svg': '#412991',
  'meituan.svg': '#FFD100', 'redis.svg': '#DC382D', 'alipay.svg': '#1677FF',
  'gmail.svg': '#EA4335', 'apple.svg': '#111111', 'notion.svg': '#111111',
  'steam.svg': '#171A21', 'firefoxbrowser.svg': '#FF7139', 'alibabacloud.svg': '#FF6A00',
  'python.svg': '#3776AB', 'douban.svg': '#2EAF6D', 'wikipedia.svg': '#111111',
  'nodedotjs.svg': '#5FA04E', 'spotify.svg': '#1DB954', 'gitee.svg': '#C71D23',
  'netflix.svg': '#E50914', 'postgresql.svg': '#4169E1', 'vercel.svg': '#111111',
  'medium.svg': '#111111', 'kuaishou.svg': '#FF4906', 'twitch.svg': '#9146FF',
  'baidu.svg': '#2932E1', 'gitlab.svg': '#FC6D26', 'slack.svg': '#4A154B',
  'docker.svg': '#2496ED', 'pinterest.svg': '#E60023', 'linkedin.svg': '#0A66C2',
  'x.svg': '#111111', 'csdn.svg': '#FC5531', 'taobao.svg': '#FF5000',
  'pypi.svg': '#3775A9', 'trello.svg': '#0079BF', 'instagram.svg': '#E4405F',
  'xiaohongshu.svg': '#FF2442', 'facebook.svg': '#1877F2', 'reddit.svg': '#FF4500',
  'neteasecloudmusic.svg': '#C20C0C', 'amazon.svg': '#FF9900',
};

/** 相对亮度：判断品牌底上该用白色还是黑色图形 */
function hexLum(hex) {
  try {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  } catch (e) {
    return 0;
  }
}

let assetIndex = null;
let tokenSeed = 0;

/* 解析结果内存缓存：同一站点第二次渲染直接命中，切页/重排不再重新请求、不再闪烁 */
const resolvedMemo = new Map(); /* `host|size` → { src, brand } */
const localMemo = new Map();    /* host → Promise<{ src, file }|null> */

export function chromeFaviconUrl(url, size = 64) {
  if (!url || !hasChrome()) return '';
  try {
    return chrome.runtime.getURL(`_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`);
  } catch (e) {
    return '';
  }
}

function assetUrl(path) {
  if (hasChrome()) {
    try { return chrome.runtime.getURL(path); } catch (e) { return path; }
  }
  return path;
}

/** 内置图标索引：icons/sites/index.json（域名 → svg 文件名） */
function siteIndex() {
  if (!assetIndex) {
    assetIndex = fetch(assetUrl('icons/sites/index.json'))
      .then((res) => (res.ok ? res.json() : {}))
      .catch(() => ({}));
  }
  return assetIndex;
}

/** 域名候选：完整主机名 → 逐级去掉子域，遇到二级后缀停止 */
export function domainCandidates(host) {
  const parts = host.split('.');
  const out = [];
  for (let i = 0; i < parts.length - 1; i += 1) {
    const cand = parts.slice(i).join('.');
    if (SECOND_LEVEL.includes(cand)) break;
    out.push(cand);
  }
  return out;
}

async function localIcon(url) {
  const host = hostNameOf(url).split(':')[0];
  if (!host) return null;
  if (!localMemo.has(host)) {
    localMemo.set(host, (async () => {
      const map = await siteIndex();
      for (const cand of domainCandidates(host)) {
        const file = map[cand];
        if (file) return { src: assetUrl(`icons/sites/${file}`), file };
      }
      return null;
    })());
  }
  return localMemo.get(host);
}

async function readCache(host) {
  try {
    const row = await db.get(ICON_STORE, host);
    if (!row || !row.dataUrl) return '';
    if (Date.now() - (row.ts || 0) > CACHE_TTL) return '';
    return row.dataUrl;
  } catch (e) {
    return '';
  }
}

/** 在线图标抓到后落库，之后不再重复请求 */
async function writeCache(host, src) {
  try {
    const res = await fetch(src, { credentials: 'omit' });
    if (!res.ok) return;
    const blob = await res.blob();
    if (!blob || !blob.size || blob.size > 64 * 1024) return;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    if (dataUrl) await db.put(ICON_STORE, { id: host, dataUrl, ts: Date.now(), src });
  } catch (e) { /* 未授权或被拦截时跳过缓存 */ }
}

export async function clearIconCache() {
  try { await db.clear(ICON_STORE); } catch (e) { /* ignore */ }
}

function remoteSources(host) {
  return [
    { src: `https://favicon.im/${host}?larger=true`, remote: true },
    { src: `https://icons.duckduckgo.com/ip3/${host}.ico`, remote: true },
    { src: `https://www.google.com/s2/favicons?domain=${host}&sz=64`, remote: true },
  ];
}

/* 在线图标并发闸门（最多 4 条同时请求） */
const remoteQueue = { active: 0, waiting: [] };
function acquireRemote(start) {
  const run = () => {
    remoteQueue.active += 1;
    let done = false;
    const release = () => {
      if (done) return;
      done = true;
      remoteQueue.active = Math.max(0, remoteQueue.active - 1);
      remoteQueue.waiting.shift()?.();
    };
    start(release);
  };
  if (remoteQueue.active < 4) run();
  else remoteQueue.waiting.push(run);
}

/** 在容器里绘制图标（不返回 HTML，全部走 DOM，避免注入） */
export function paintIcon(container, site, { size = 64 } = {}) {
  container.innerHTML = '';
  container.style.backgroundImage = 'none';
  const color = site.color || '#4c8bf5';

  if (site.iconType === 'upload' && site.iconValue) {
    container.style.background = color;
    container.style.backgroundImage = `url("${site.iconValue.replace(/"/g, '%22')}")`;
    container.style.backgroundSize = 'cover';
    container.style.backgroundPosition = 'center';
    return;
  }

  const token = String(++tokenSeed);
  container.dataset.iconToken = token;
  const alive = () => container.dataset.iconToken === token;

  const showLetter = () => {
    if (!alive()) return;
    container.style.background = color;
    container.style.color = '#fff';
    if (!container.querySelector('.letter')) {
      const letter = document.createElement('span');
      letter.className = 'letter';
      letter.textContent = firstChar(site.name);
      container.appendChild(letter);
    }
  };

  if (site.iconType === 'color') { showLetter(); return; }

  (async () => {
    const host = hostNameOf(site.url).split(':')[0];
    const memoKey = host ? `${host}|${size}` : '';

    /* 已解析过的站点：同步出图，切页时不会再出现“先空白后闪现” */
    const known = memoKey ? resolvedMemo.get(memoKey) : null;
    if (known) {
      container.style.background = known.brand || '#ffffff';
      const hit = document.createElement('img');
      hit.className = 'favicon';
      hit.alt = '';
      hit.decoding = 'async';
      hit.draggable = false;
      hit.referrerPolicy = 'no-referrer';
      if (known.brand && hexLum(known.brand) < 0.55) hit.classList.add('mono');
      hit.addEventListener('error', () => {
        resolvedMemo.delete(memoKey);
        hit.remove();
        showLetter();
      }, { once: true });
      hit.src = known.src;
      container.appendChild(hit);
      return;
    }

    const sources = [];

    const local = await localIcon(site.url);
    if (local) sources.push({ src: local.src, remote: false });
    const brand = local ? (BRAND_COLORS[local.file] || '') : '';

    if (host) {
      const cached = await readCache(host);
      if (cached) sources.push({ src: cached, remote: false });
    }

    if (host && loadConfig().network) sources.push(...remoteSources(host));

    const chromeSrc = chromeFaviconUrl(site.url, size);
    if (chromeSrc) sources.push({ src: chromeSrc, remote: false });

    if (!alive()) return;
    if (!sources.length) { showLetter(); return; }

    container.style.background = brand || '#ffffff';
    let index = 0;
    const img = document.createElement('img');
    img.className = 'favicon';
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    img.referrerPolicy = 'no-referrer';
    if (brand && hexLum(brand) < 0.55) img.classList.add('mono');

    const timer = setTimeout(() => {
      if (!img.complete) { img.remove(); showLetter(); releaseSlot(); }
    }, 6000);

    let releaseSlot = () => {};
    const giveUp = () => {
      clearTimeout(timer);
      img.remove();
      showLetter();
      releaseSlot();
    };
    const next = () => {
      index += 1;
      if (index < sources.length) img.src = sources[index].src;
      else giveUp();
    };

    img.addEventListener('error', next);
    img.addEventListener('load', () => {
      if (!alive()) return;
      clearTimeout(timer);
      if (!img.naturalWidth) { next(); return; }
      releaseSlot();
      const used = sources[index];
      if (used) {
        if (memoKey) resolvedMemo.set(memoKey, { src: used.src, brand });
        if (used.remote && host) writeCache(host, used.src);
      }
    });

    container.appendChild(img);
    /* 走在线图标链时限制并发（最多 4 条），弱网下不会一次甩出几十个请求 */
    if (sources.some((s) => s.remote)) {
      acquireRemote((release) => { releaseSlot = release; img.src = sources[0].src; });
    } else {
      img.src = sources[0].src;
    }
  })();
}
