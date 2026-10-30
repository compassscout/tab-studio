/* db.js — IndexedDB 封装：库 compass_newtab，业务表 sites/folders/pages/wallpapers/todos/notes */
const DB_NAME = 'compass_newtab';
const DB_VERSION = 2;
export const STORES = ['sites', 'folders', 'pages', 'wallpapers', 'todos', 'notes'];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function store(name, mode) {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

export const db = {
  async getAll(name) { return reqToPromise((await store(name, 'readonly')).getAll()); },
  async get(name, id) { return reqToPromise((await store(name, 'readonly')).get(id)); },
  async put(name, value) { return reqToPromise((await store(name, 'readwrite')).put(value)); },
  async delete(name, id) { return reqToPromise((await store(name, 'readwrite')).delete(id)); },
  async clear(name) { return reqToPromise((await store(name, 'readwrite')).clear()); },
  async bulkPut(name, values) {
    const db = await openDB();
    const tx = db.transaction(name, 'readwrite');
    const os = tx.objectStore(name);
    values.forEach((v) => os.put(v));
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
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
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('事务中止'));
    });
  },
};
