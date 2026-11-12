/* db.js — IndexedDB 封装：库 compass_newtab，业务表 sites/folders/pages/wallpapers/todos/notes */
const DB_NAME = 'compass_newtab';
const DB_VERSION = 5;
export const STORES = ['sites', 'folders', 'pages', 'wallpapers', 'todos', 'notes'];
/** 图标缓存单独存放，不参与导入导出 */
export const ICON_STORE = 'iconCache';
/** 外观设置镜像：防止清理浏览器数据后设置全部丢失（不参与导入导出与自动备份） */
export const SETTINGS_STORE = 'settingsMirror';
/** 每日自动备份快照（存于 IndexedDB，不再受 localStorage 约 5MB 配额限制） */
export const BACKUP_STORE = 'autoBackup';

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
      /* 快照按时间自动编号，同一天多次备份不会互相覆盖 */
      if (!db.objectStoreNames.contains(BACKUP_STORE)) {
        db.createObjectStore(BACKUP_STORE, { keyPath: 'id', autoIncrement: true });
      }
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

/* 内部表写入不触发跨标签页刷新通知 */
const SILENT_STORES = [ICON_STORE, SETTINGS_STORE, BACKUP_STORE];

export const db = {
  async getAll(name) { return reqToPromise((await store(name, 'readonly')).getAll()); },
  async get(name, id) { return reqToPromise((await store(name, 'readonly')).get(id)); },
  async put(name, value) {
    const r = await reqToPromise((await store(name, 'readwrite')).put(value));
    if (!SILENT_STORES.includes(name)) notifyWrite();
    return r;
  },
  async delete(name, id) {
    const r = await reqToPromise((await store(name, 'readwrite')).delete(id));
    if (!SILENT_STORES.includes(name)) notifyWrite();
    return r;
  },
  async clear(name) {
    const r = await reqToPromise((await store(name, 'readwrite')).clear());
    if (!SILENT_STORES.includes(name)) notifyWrite();
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
  /**
   * 一次性覆盖多表（同一个事务，失败自动回滚）。
   * 只处理 map 里显式给出「数组」的表，未提供的表保持原样 ——
   * 自动备份不含壁纸（dataURL 太大），这里若清空全部表会把用户上传的壁纸一并抹掉。
   */
  async replaceAll(map) {
    const names = STORES.filter((name) => Array.isArray(map?.[name]));
    if (!names.length) return;
    const db = await openDB();
    const tx = db.transaction(names, 'readwrite');
    names.forEach((name) => {
      const os = tx.objectStore(name);
      os.clear();
      map[name].forEach((v) => os.put(v));
    });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { notifyWrite(); resolve(); };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('事务中止'));
    });
  },
};

/* ---------------- 本地自动备份（每日快照，最多保留 3 份） ----------------
 * 快照存在 IndexedDB 的 autoBackup 表（自增 key，按写入顺序即时间顺序）。
 * 早期版本存在 localStorage，配额约 5MB，站点/待办一多就写失败——这里做一次性迁移。
 */
const LEGACY_AUTO_KEY = 'compass_auto_backup';
const AUTO_INTERVAL = 24 * 60 * 60 * 1000;
const AUTO_KEEP = 3;
const BACKUP_STORES = ['sites', 'folders', 'pages', 'todos', 'notes'];

async function readSnaps() {
  try {
    const rows = await db.getAll(BACKUP_STORE);
    const list = rows.map((r) => ({ id: r.id, ts: r.ts, data: r.data })).sort((a, b) => a.ts - b.ts);
    if (list.length) return list;
    /* 表里没有：尝试把 localStorage 里的旧快照搬过来 */
    let raw = null;
    try { raw = localStorage.getItem(LEGACY_AUTO_KEY); } catch (e) { raw = null; }
    if (!raw) return [];
    const old = JSON.parse(raw);
    if (!Array.isArray(old) || !old.length) { try { localStorage.removeItem(LEGACY_AUTO_KEY); } catch (e) { /* 忽略 */ } return []; }
    for (const snap of old) {
      if (snap && snap.ts && snap.data) await db.put(BACKUP_STORE, { ts: snap.ts, data: snap.data });
    }
    try { localStorage.removeItem(LEGACY_AUTO_KEY); } catch (e) { /* 忽略 */ }
    return (await db.getAll(BACKUP_STORE)).sort((a, b) => a.ts - b.ts);
  } catch (e) {
    return [];
  }
}

/** 不包含壁纸（dataURL 太大），最多保留 3 份 */
export async function autoBackup(force = false) {
  try {
    const list = await readSnaps();
    const last = list.length ? list[list.length - 1].ts : 0;
    if (!force && Date.now() - last < AUTO_INTERVAL) return false;
    const data = {};
    for (const name of BACKUP_STORES) data[name] = await db.getAll(name);
    await db.put(BACKUP_STORE, { ts: Date.now(), data });
    const keep = await readSnaps();
    if (keep.length > AUTO_KEEP) {
      /* 只删最老的，多余的自增记录 id 最小 */
      const oldest = keep.slice(0, keep.length - AUTO_KEEP);
      for (const row of oldest) await db.delete(BACKUP_STORE, row.id);
    }
    return true;
  } catch (e) {
    /* 存储异常：通知界面提示，而不是静默失败 */
    document.dispatchEvent(new CustomEvent('backup-failed'));
    return false;
  }
}

export async function latestBackupTime() {
  const list = await readSnaps();
  return list.length ? list[list.length - 1].ts : 0;
}

/** 恢复最近一次快照，返回快照时间；无快照返回 0 */
export async function restoreLatestBackup() {
  const list = await readSnaps();
  const snap = list[list.length - 1];
  if (!snap) return 0;
  await db.replaceAll(snap.data);
  return snap.ts;
}
