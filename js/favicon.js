/* favicon.js — 站点图标：在线图标源（可选）→ Chrome 本地缓存 → 首字色块 */
import { hasChrome, firstChar, hostNameOf } from './utils.js';
import { loadConfig } from './config.js';

export function chromeFaviconUrl(url, size = 64) {
  if (!url || !hasChrome()) return '';
  try {
    return chrome.runtime.getURL(`_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`);
  } catch (e) {
    return '';
  }
}

function remoteSources(url) {
  const host = hostNameOf(url).split(':')[0];
  if (!host) return [];
  return [
    `https://favicon.im/${host}?larger=true`,
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
  ];
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

  const showLetter = () => {
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

  const sources = [];
  if (loadConfig().network) sources.push(...remoteSources(site.url));
  sources.push(chromeFaviconUrl(site.url, size));

  const usable = sources.filter(Boolean);
  if (!usable.length) { showLetter(); return; }

  container.style.background = '#ffffff';
  let index = 0;
  const img = document.createElement('img');
  img.className = 'favicon';
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('error', () => {
    index += 1;
    if (index < usable.length) {
      img.src = usable[index];
    } else {
      img.remove();
      showLetter();
    }
  });
  img.addEventListener('load', () => {
    if (!img.naturalWidth) {
      index += 1;
      if (index < usable.length) img.src = usable[index];
      else { img.remove(); showLetter(); }
    }
  });
  img.src = usable[0];
  container.appendChild(img);
}
