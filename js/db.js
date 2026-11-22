// Lokaler Speicher im Browser (IndexedDB). Es werden keine Daten an einen Server gesendet.

const DB_NAME = 'kopfnoten-beobachter';
const DB_VERSION = 1;
export const STORES = ['classes', 'students', 'periods', 'observations', 'meta'];
const CLASS_STORES = ['students', 'periods', 'observations'];

let dbPromise = null;

export function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('Dieser Browser unterstützt keinen lokalen Speicher (IndexedDB).'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('classes', { keyPath: 'id' });
      const students = db.createObjectStore('students', { keyPath: 'id' });
      students.createIndex('classId', 'classId');
      const periods = db.createObjectStore('periods', { keyPath: 'id' });
      periods.createIndex('classId', 'classId');
      const obs = db.createObjectStore('observations', { keyPath: 'id' });
      obs.createIndex('classId', 'classId');
      obs.createIndex('studentId', 'studentId');
      db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Speicher ist durch einen anderen Tab blockiert. Bitte andere Tabs der App schließen.'));
  }).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

/** Führt `work(tx)` in einer Transaktion aus. `work` darf eine Funktion zurückgeben, die nach dem Commit das Ergebnis liefert. */
async function run(storeNames, mode, work) {
  const db = await open();
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(storeNames, mode);
    } catch (e) {
      reject(e);
      return;
    }
    let out;
    tx.oncomplete = () => resolve(typeof out === 'function' ? out() : out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Speichern abgebrochen'));
    try {
      out = work(tx);
    } catch (e) {
      try { tx.abort(); } catch { /* schon beendet */ }
      reject(e);
    }
  });
}

export const getAll = (store) =>
  run(store, 'readonly', (tx) => {
    const r = tx.objectStore(store).getAll();
    return () => r.result;
  });

export const getAllBy = (store, index, key) =>
  run(store, 'readonly', (tx) => {
    const r = tx.objectStore(store).index(index).getAll(key);
    return () => r.result;
  });

export const get = (store, key) =>
  run(store, 'readonly', (tx) => {
    const r = tx.objectStore(store).get(key);
    return () => r.result;
  });

export const countBy = (store, index, key) =>
  run(store, 'readonly', (tx) => {
    const r = tx.objectStore(store).index(index).count(key);
    return () => r.result;
  });

export const put = (store, obj) =>
  run(store, 'readwrite', (tx) => {
    tx.objectStore(store).put(obj);
  });

export const putMany = (store, objs) =>
  run(store, 'readwrite', (tx) => {
    const s = tx.objectStore(store);
    for (const o of objs) s.put(o);
  });

export const del = (store, key) =>
  run(store, 'readwrite', (tx) => {
    tx.objectStore(store).delete(key);
  });

/** Mehrere Schreibvorgänge atomar: [{store, put}|{store, del}] */
export function batch(ops) {
  const stores = [...new Set(ops.map((o) => o.store))];
  if (!stores.length) return Promise.resolve();
  return run(stores, 'readwrite', (tx) => {
    for (const op of ops) {
      const s = tx.objectStore(op.store);
      if ('put' in op) s.put(op.put);
      else s.delete(op.del);
    }
  });
}

/** Löscht alle Beobachtungen eines Kindes. */
export function deleteStudent(studentId) {
  return run(['students', 'observations'], 'readwrite', (tx) => {
    tx.objectStore('students').delete(studentId);
    const cur = tx.objectStore('observations').index('studentId').openCursor(IDBKeyRange.only(studentId));
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) {
        c.delete();
        c.continue();
      }
    };
  });
}

/** Löscht alle Beobachtungen eines Zeitraums und den Zeitraum selbst. */
export function deletePeriod(periodId, classId) {
  return run(['periods', 'observations'], 'readwrite', (tx) => {
    tx.objectStore('periods').delete(periodId);
    const cur = tx.objectStore('observations').index('classId').openCursor(IDBKeyRange.only(classId));
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) {
        if (c.value.periodId === periodId) c.delete();
        c.continue();
      }
    };
  });
}

/** Löscht eine Klasse mit allen Kindern, Zeiträumen und Beobachtungen. */
export function deleteClass(classId) {
  return run([...CLASS_STORES, 'classes', 'meta'], 'readwrite', (tx) => {
    tx.objectStore('classes').delete(classId);
    tx.objectStore('meta').delete(`ui:${classId}`);
    for (const name of CLASS_STORES) {
      const cur = tx.objectStore(name).index('classId').openCursor(IDBKeyRange.only(classId));
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) {
          c.delete();
          c.continue();
        }
      };
    }
  });
}

export async function metaGet(key, fallback = undefined) {
  const row = await get('meta', key);
  return row ? row.value : fallback;
}

export const metaSet = (key, value) => put('meta', { key, value });

/** Alle Daten für die Sicherung. */
export async function dumpAll() {
  const [classes, students, periods, observations] = await Promise.all([
    getAll('classes'), getAll('students'), getAll('periods'), getAll('observations'),
  ]);
  return { classes, students, periods, observations };
}

/** Spielt eine Sicherung ein. Vorhandene Einträge mit gleicher ID werden überschrieben, nichts wird gelöscht. */
export function restoreAll(data) {
  return run(['classes', 'students', 'periods', 'observations'], 'readwrite', (tx) => {
    for (const name of ['classes', 'students', 'periods', 'observations']) {
      const s = tx.objectStore(name);
      for (const o of data[name]) s.put(o);
    }
  });
}

export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch { /* nicht kritisch */ }
  return false;
}
