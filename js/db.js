/* db.js — IndexedDB 封装：库 infinity_newtab，仓库 sites/folders/pages/wallpapers/todos */

const DB_NAME = 'infinity_newtab';
const DB_VERSION = 1;
export const STORES = ['sites', 'folders', 'pages', 'wallpapers', 'todos'];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      STORES.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const db = {
  async getAll(store) { return reqToPromise((await tx(store, 'readonly')).getAll()); },
  async get(store, id) { return reqToPromise((await tx(store, 'readonly')).get(id)); },
  async put(store, value) { return reqToPromise((await tx(store, 'readwrite')).put(value)); },
  async delete(store, id) { return reqToPromise((await tx(store, 'readwrite')).delete(id)); },
  async clear(store) { return reqToPromise((await tx(store, 'readwrite')).clear()); },
  async bulkPut(store, values) {
    const t = await tx(store, 'readwrite');
    values.forEach((v) => t.put(v));
    return new Promise((resolve, reject) => {
      t.transaction.oncomplete = () => resolve();
      t.transaction.onerror = () => reject(t.transaction.error);
      t.transaction.onabort = () => reject(t.transaction.error || new Error('事务中止'));
    });
  },
  async clearAll() {
    for (const s of STORES) await this.clear(s);
  },
};
