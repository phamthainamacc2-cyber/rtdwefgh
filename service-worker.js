/* PhotoEdit App — Service Worker v1 */
const CACHE = 'photoedit-v1';
const SHELL = [
  './', './index.html', './style.css', './script.js',
  './manifest.json', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Network-first for Picsum images
  if (url.hostname.includes('picsum.photos') || url.hostname.includes('fastly.picsum')) {
    e.respondWith(
      fetch(e.request)
        .then(res => { caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res; })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for fonts and CDN assets
  if (url.hostname.includes('fonts.') || url.hostname.includes('jsdelivr') || url.hostname.includes('cdn.')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res;
      }))
    );
    return;
  }

  // Stale-while-revalidate for app shell
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => {
        caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res;
      });
      return cached || fresh;
    })
  );
});
