// Service Worker: macht die App offline nutzbar.
// Strategie: erst Netzwerk (damit Updates sofort ankommen), bei Funkloch oder Timeout der gespeicherte Stand.
// Beim Hinzufügen neuer Dateien zur App bitte auch ASSETS ergänzen und CACHE hochzählen.

const CACHE = 'kopfnoten-v3';
const TIMEOUT_MS = 3000;
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/aspects.js',
  'js/db.js',
  'js/pdf.js',
  'js/reminders.js',
  'js/state.js',
  'js/ui.js',
  'js/util.js',
  'js/views/backup.js',
  'js/views/child.js',
  'js/views/evaluate.js',
  'js/views/exporter.js',
  'js/views/home.js',
  'js/views/homework.js',
  'js/views/live.js',
  'js/views/manage.js',
  'js/views/periods.js',
  'js/views/reminders.js',
  'vendor/jspdf.umd.min.js',
  'fonts/atkinson-hyperlegible-latin-400-normal.woff2',
  'fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  'fonts/atkinson-hyperlegible-latin-ext-400-normal.woff2',
  'fonts/atkinson-hyperlegible-latin-ext-700-normal.woff2',
  'fonts/LiberationSans-Regular.ttf',
  'fonts/LiberationSans-Bold.ttf',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request, { cache: 'no-cache' }).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetchWithTimeout(req, TIMEOUT_MS);
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = (await cache.match(req, { ignoreSearch: true }))
        || (req.mode === 'navigate' ? await cache.match('index.html') : undefined);
      if (hit) return hit;
      throw err;
    }
  })());
});

// ------------------------------------------------------------------ Erinnerungen an offene Hausaufgaben
// Läuft nur, wenn der Browser den Service Worker im Hintergrund weckt (Chrome auf Android/Desktop,
// installierte App, vom Browser bestimmter Rhythmus) oder die Seite eine Prüfung per Nachricht anstößt.
// Die Benachrichtigung nennt nur die Anzahl, keine Namen.

const DB_NAME = 'kopfnoten-beobachter';
const REMIND_TAG = 'offene-hausaufgaben';

const idbReq = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME);
    r.onupgradeneeded = () => r.transaction.abort(); // Datenbank existiert noch nicht: nichts anlegen
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('blocked'));
  });
}

async function readReminderState() {
  const db = await openDb();
  try {
    const tx = db.transaction(['observations', 'meta'], 'readonly');
    const meta = tx.objectStore('meta');
    const [obs, push, badge, last] = await Promise.all([
      idbReq(tx.objectStore('observations').getAll()),
      idbReq(meta.get('remind:push')),
      idbReq(meta.get('remind:badge')),
      idbReq(meta.get('remind:last')),
    ]);
    return {
      open: obs.filter((o) => o.aspect === 'hausaufgabe' && !o.doneTs).length,
      push: !!(push && push.value),
      badge: !!(badge && badge.value),
      last: last ? last.value : '',
    };
  } finally {
    db.close();
  }
}

async function writeLast(day) {
  const db = await openDb();
  try {
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put({ key: 'remind:last', value: day });
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  } finally {
    db.close();
  }
}

const pad2 = (n) => String(n).padStart(2, '0');

/** force = true: sofort anzeigen, ohne Uhrzeit-, Wochentag- und Tagesprüfung (für Tests). */
async function checkReminder({ force = false } = {}) {
  let st;
  try {
    st = await readReminderState();
  } catch {
    return 'keine Daten';
  }
  try {
    if (st.badge && self.navigator.setAppBadge) {
      if (st.open > 0) await self.navigator.setAppBadge(st.open);
      else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
    }
  } catch { /* Badge ist optional */ }

  if (!st.push && !force) return 'aus';
  if (st.open === 0) return 'nichts offen';
  const now = new Date();
  const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  if (!force) {
    const minutes = now.getHours() * 60 + now.getMinutes();
    const schoolDay = now.getDay() >= 1 && now.getDay() <= 5;
    if (!schoolDay || minutes < 6 * 60 + 30 || minutes > 17 * 60) return 'außerhalb der Zeit';
    if (st.last === today) return 'heute schon gemeldet';
  }
  if (self.Notification && self.Notification.permission !== 'granted') return 'keine Erlaubnis';
  await self.registration.showNotification('Offene Hausaufgaben', {
    body: `${st.open} ${st.open === 1 ? 'Hausaufgabe ist' : 'Hausaufgaben sind'} noch offen.`,
    icon: 'icons/icon-192.png',
    tag: REMIND_TAG,
  });
  if (!force) await writeLast(today).catch(() => {});
  return 'gesendet';
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === REMIND_TAG) event.waitUntil(checkReminder());
});

self.addEventListener('message', (event) => {
  const d = event.data;
  if (d && d.type === 'check-reminder') {
    const job = checkReminder({ force: !!d.force }).then((r) => {
      if (event.ports && event.ports[0]) event.ports[0].postMessage(r);
    });
    event.waitUntil(job);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      if (list.length) return list[0].focus();
      return self.clients.openWindow('./');
    }),
  );
});
