'use strict';
/* desktop/preload.js — 只暴露必要的桥接接口，页面拿不到 Node 能力 */
const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, handler) {
  if (typeof handler !== 'function') return () => {};
  const listener = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => { ipcRenderer.removeListener(channel, listener); };
}

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
  electron: process.versions.electron,

  /** 在站点窗口打开网址（newTab=false 时复用最近一个站点窗口） */
  openUrl: (url, options) => ipcRenderer.invoke('studio:open-url', String(url || ''), options || {}),

  /** 供「添加当前网页」使用：应用内最后打开的网页 */
  getLastPage: () => ipcRenderer.invoke('studio:last-page'),

  /** 交给系统浏览器打开（备用出口） */
  openExternal: (url) => ipcRenderer.invoke('studio:open-external', String(url || '')),

  info: () => ipcRenderer.invoke('studio:info'),

  /** 应用级提示（下载完成、下载中断等） */
  onToast: (handler) => subscribe('studio:toast', handler),

  /** 菜单快捷键：add / folder / wallpaper / settings / search */
  onShortcut: (handler) => subscribe('studio:shortcut', handler),
});
