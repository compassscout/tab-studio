/* main.js — 启动引导与全局装配 */
import { initStore, getCurrentPage, addFolder, reflowPages, syncWidgetSlots } from './store.js';
import { loadConfig, applyConfig } from './config.js';
import { renderAll, initPager, initWheelPaging } from './render.js';
import { initSearch } from './search.js';
import { initPanel, openPanel, closePanel } from './panel.js';
import { initSettings, refreshSettingsUI } from './settings.js';
import { initWallpaper } from './wallpaper.js';
import { initWidgets, openTodo, openNote, openWeather, openFolders } from './widgets.js';
import { initSiteEditor, initFolderModal, openSiteEditor, openFolder, closeFolder } from './folder.js';
import { initContextMenu, openSiteMenu, openFolderMenu, openPageMenu, openWidgetMenu } from './contextmenu.js';
import { initDialogs, confirmAction, askText } from './dialog.js';
import { initDrag } from './drag.js';
import { initDock, pinToDock, unpinFromDock, dockMenu } from './dock.js';
import { openHistory, openBookmarks, initBrowserData } from './browserdata.js';
import { openLibrary } from './wallpaper.js';
import { toast } from './utils.js';

async function boot() {
  await initStore();
  await syncWidgetSlots();
  await reflowPages();
  applyConfig(loadConfig());

  initDialogs();
  initContextMenu();
  initSiteEditor();
  initFolderModal();
  initSearch();
  initPager();
  initWheelPaging();
  initDrag();
  initWidgets();
  initBrowserData();
  initPanel();
  initDock();
  initSettings();
  initWallpaper();

  window.app = {
    openPanel,
    closePanel,
    openSettings: () => openPanel('settings'),
    openAdd: () => openPanel('add'),
    openMe: () => openPanel('me'),
    openSiteEditor,
    openFolder,
    closeFolder,
    openSiteMenu,
    openFolderMenu,
    openPageMenu,
    openWidgetMenu,
    openTodo,
    openNote,
    openWeather,
    openFolders,
    openHistory,
    openBookmarks,
    openWallpaperLibrary: () => openLibrary('all'),
    confirm: confirmAction,
    newFolder: async () => {
      const name = await askText({ title: '新建文件夹', placeholder: '文件夹名称', okText: '创建' });
      if (!name) return;
      await addFolder(name, []);
      renderAll();
      toast('文件夹已创建');
    },
    pinDock: pinToDock,
    unpinDock: unpinFromDock,
    openDockMenu: dockMenu,
    refreshSettings: refreshSettingsUI,
    renderAll,
    pageId: () => getCurrentPage()?.id,
  };

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.querySelector('.modal.open')) return;
    if (document.body.classList.contains('panel-open')) closePanel();
    document.getElementById('top-menu')?.classList.add('hidden');
  });

  window.addEventListener('resize', () => {
    document.documentElement.style.setProperty('--search-scale', String(loadConfig().searchScale));
  });

  renderAll();
  window.__APP_BOOTED__ = true;
}

boot().catch((err) => {
  console.error('[TAB STUDIO] 启动失败', err);
  toast('初始化失败：' + (err?.message || '未知错误'));
});
