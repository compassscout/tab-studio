/* main.js — 启动引导与全局装配 */
import { initStore, getCurrentPage, addFolder, reflowPages, syncWidgetSlots, reloadFromDB } from './store.js';
import { autoBackup } from './db.js';
import { loadConfig, applyConfig, loadMeta, saveMeta, reloadConfig, CONFIG_KEY, restoreConfigMirror } from './config.js';
import { renderAll, initPager, initWheelPaging, initSwipePaging, initGridKeys } from './render.js';
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

/* 首次运行：数据与联网说明（商业化发布所需的披露，同时也是一次性告知） */
function showPrivacyNotice() {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop open';
  backdrop.style.zIndex = '1250';

  const modal = document.createElement('section');
  modal.className = 'modal open privacy-modal';
  modal.style.zIndex = '1260';
  modal.style.width = 'min(460px, 94vw)';
  modal.innerHTML = `
    <div class="modal-head"><h3>开始前，先说明两件事</h3></div>
    <div class="modal-body">
      <p><b>数据只存在这台电脑上。</b>站点、文件夹、分页、壁纸、待办和笔记保存在本机 IndexedDB，不上传、不需要账号。</p>
      <p><b>联网只用于两件事。</b>一是取网站图标（会把域名发给 favicon.im、DuckDuckGo、Google 的图标服务），二是搜索建议与天气。</p>
      <p><b>可选权限按需申请。</b>历史记录和书签只在你主动打开对应功能时才申请，拒绝也不影响其他功能。</p>
    </div>
    <div class="modal-foot"><button class="btn" data-settings>去设置</button><button class="btn primary" data-ok>知道了</button></div>`;

  const finish = (toSettings) => {
    modal.remove();
    backdrop.remove();
    saveMeta({ privacyAccepted: true });
    if (!loadMeta().tipsShown) {
      setTimeout(() => {
        toast('右键空白处可添加站点；把图标拖到另一个图标上就能建文件夹', 6500);
        saveMeta({ tipsShown: true });
      }, toSettings ? 400 : 900);
    }
    if (toSettings) openPanel('settings');
  };

  modal.querySelector('[data-ok]').addEventListener('click', () => finish(false));
  modal.querySelector('[data-settings]').addEventListener('click', () => finish(true));
  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
}

async function boot() {
  await initStore();
  await restoreConfigMirror(); /* 清理过浏览数据时用 IndexedDB 镜像恢复外观设置 */
  /* 自动备份失败（配额不足等）时给出提示，而不是静默跳过 */
  let backupFailed = false;
  document.addEventListener('backup-failed', () => { backupFailed = true; });
  autoBackup().then((ok) => {
    if (!ok && backupFailed) toast('自动备份失败：本地空间不足，请到「我的 → 备份与恢复」手动导出', 4200);
  });
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
  initSwipePaging();
  initGridKeys();
  initDrag();
  initWidgets();
  initBrowserData();
  initPanel();
  initDock();
  initSettings();
  initWallpaper();

  /* 跨标签页同步：另一个新标签页改了数据，本页自动重新读取并刷新 */
  if (typeof BroadcastChannel !== 'undefined') {
    const ch = new BroadcastChannel('compass-db');
    let syncTimer = 0;
    ch.addEventListener('message', () => {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(async () => {
        if (window.__compassDrag) return; /* 拖拽中不打断 */
        await reloadFromDB();
        renderAll();
      }, 250);
    });
  }

  /* 数据库升级被旧标签页占用时给出明确提示 */
  document.addEventListener('db-blocked', () => {
    toast('请关闭所有 TAB STUDIO 标签页后重新打开，数据升级才能完成', 8000);
  });

  /* 跨标签页同步：配置改动走 storage 事件，数据改动走 BroadcastChannel */
  window.addEventListener('storage', (e) => {
    if (e.key !== CONFIG_KEY) return;
    applyConfig(reloadConfig());
    renderAll();
  });

  /* 首次运行：先讲清数据与联网，再给使用提示 */
  const meta = loadMeta();
  if (!meta.privacyAccepted) {
    showPrivacyNotice();
  } else if (!meta.tipsShown) {
    setTimeout(() => {
      toast('右键空白处可添加站点；把图标拖到另一个图标上就能建文件夹', 6500);
      saveMeta({ tipsShown: true });
    }, 1200);
  }

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
