// Service Worker: macht die App offline nutzbar.
// Strategie: erst Netzwerk (damit Updates sofort ankommen), bei Funkloch oder Timeout der gespeicherte Stand.
// Beim Hinzufügen neuer Dateien zur App bitte auch ASSETS ergänzen und CACHE hochzählen.

const CACHE = 'kopfnoten-v2';
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
  'js/state.js',
  'js/ui.js',
  'js/util.js',
  'js/views/backup.js',
  'js/views/child.js',
  'js/views/evaluate.js',
  'js/views/exporter.js',
  'js/views/home.js',
  'js/views/live.js',
  'js/views/manage.js',
  'js/views/periods.js',
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
