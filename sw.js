const CACHE = 'sewlytics-v3';
const ASSETS = ['/', '/index.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

// Install — cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate — clear old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first, fall back to cache
self.addEventListener('fetch', e => {
  // Always go network-first for Airtable API calls
  if (e.request.url.includes('airtable.com')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(
        JSON.stringify({error: 'offline', records: []}),
        {headers: {'Content-Type': 'application/json'}}
      ))
    );
    return;
  }

  // For app assets: network first, cache fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Update cache with fresh version
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
