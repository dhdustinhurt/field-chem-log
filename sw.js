// Caches the whole app so it runs with the phone in airplane mode.
// Bump CACHE whenever any cached file changes.
const CACHE = 'field-chem-log-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // Cache each asset on its own so one 404 doesn't fail the whole install.
      .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(err => console.warn('skip', u, err)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;

  // The page itself: network first, cache as fallback. A phone with signal picks up a new
  // version immediately; offline it still opens instantly from cache. Cache-first on the
  // document pins users to whatever shipped first, which is how v1 went stale in testing.
  if(req.mode === 'navigate' || req.destination === 'document'){
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Everything else is static: cache first, since offline is the normal case.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if(res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
