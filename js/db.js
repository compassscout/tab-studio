/* db.js — IndexedDB 封装：库 compass_newtab，业务表 sites/folders/pages/wallpapers/todos/notes */
const DB_NAME = 'compass_newtab';
const DB_VERSION = 4;
export const STORES = ['sites', 'folders', 'pages', 'wallpapers', 'todos', 'notes'];
/** 图标缓存单独存放，不参与导入导出 */
export const ICON_STORE = 'iconCache';
/** 外观设置镜像：防止清理浏览器数据后设置全部丢失（不参与导入导出与自动备份） */
export const SETTINGS_STORE = 'settingsMirror';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      [...STORES, ICON_STORE, SETTINGS_STORE].forEach((name) => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      });
    };
    req.onsuccess = () => {
      const db = req.result;
      /* 扩展升级后版本号变化时，旧标签页主动释放连接，避免新版本被永久阻塞 */
      db.onversionchange = () => { try { db.close(); } catch (e) { /* 忽略 */ } dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => {
      /* 还有旧版本的标签页占着连接，只能提示用户关闭后刷新 */
      console.warn('[TAB STUDIO] 数据库升级被其他标签页阻塞');
      document.dispatchEvent(new CustomEvent('db-blocked'));
    };
  });
  return dbPromise;
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* 跨标签页同步：任一标签页写入后通知其他新标签页重新读取 */
const syncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('compass-db') : null;
function notifyWrite() {
  try { syncChannel?.postMessage({ t: Date.now() }); } catch (e) { /* 忽略 */ }
}

async function store(name, mode) {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

export const db = {
  async getAll(name) { return reqToPromise((await store(name, 'readonly')).getAll()); },
  async get(name, id) { return reqToPromise((await store(name, 'readonly')).get(id)); },
  async put(name, value) {
    const r = await reqToPromise((await store(name, 'readwrite')).put(value));
    if (name !== ICON_STORE && name !== SETTINGS_STORE) notifyWrite();
    return r;
  },
  async delete(name, id) {
    const r = await reqToPromise((await store(name, 'readwrite')).delete(id));
    if (name !== ICON_STORE && name !== SETTINGS_STORE) notifyWrite();
    return r;
  },
  async clear(name) {
    const r = await reqToPromise((await store(name, 'readwrite')).clear());
    if (name !== ICON_STORE && name !== SETTINGS_STORE) notifyWrite();
    return r;
  },
  async bulkPut(name, values) {
    const db = await openDB();
    const tx = db.transaction(name, 'readwrite');
    const os = tx.objectStore(name);
    values.forEach((v) => os.put(v));
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { notifyWrite(); resolve(); };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('事务中止'));
    });
  },
  async clearAll() { for (const s of STORES) await this.clear(s); },
  /** 一次性覆盖多表（同一个事务，失败自动回滚） */
  async replaceAll(map) {
    const db = await openDB();
    const tx = db.transaction(STORES, 'readwrite');
    STORES.forEach((name) => {
      const os = tx.objectStore(name);
      os.clear();
      (map[name] || []).forEach((v) => os.put(v));
    });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { notifyWrite(); resolve(); };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('事务中止'));
    });
  },
};

/* ---------------- 本地自动备份（每日快照，最多保留 3 份） ---------------- */
const AUTO_KEY = 'compass_auto_backup';
const AUTO_INTERVAL = 24 * 60 * 60 * 1000;
const AUTO_KEEP = 3;
const BACKUP_STORES = ['sites', 'folders', 'pages', 'todos', 'notes'];

function readSnaps() {
  try {
    const raw = localStorage.getItem(AUTO_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

/** 不包含壁纸（dataURL 太大，容易超出 localStorage 配额） */
export async function autoBackup(force = false) {
  try {
    const list = readSnaps();
    const last = list.length ? list[list.length - 1].ts : 0;
    if (!force && Date.now() - last < AUTO_INTERVAL) return false;
    const data = {};
    for (const name of BACKUP_STORES) data[name] = await db.getAll(name);
    const next = [...list, { ts: Date.now(), data }].slice(-AUTO_KEEP);
    localStorage.setItem(AUTO_KEY, JSON.stringify(next));
    return true;
  } catch (e) {
    /* 配额不足等异常：通知界面提示，而不是静默失败 */
    document.dispatchEvent(new CustomEvent('backup-failed'));
    return false;
  }
}

export function latestBackupTime() {
  const list = readSnaps();
  return list.length ? list[list.length - 1].ts : 0;
}

/** 恢复最近一次快照，返回快照时间；无快照返回 0 */
export async function restoreLatestBackup() {
  const list = readSnaps();
  const snap = list[list.length - 1];
  if (!snap) return 0;
  await db.replaceAll(snap.data);
  return snap.ts;
}
