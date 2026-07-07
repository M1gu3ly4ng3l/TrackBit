const CACHE_NAME = 'bitacora-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './Icons/launchericon-48x48.png',
  './Icons/launchericon-72x72.png',
  './Icons/launchericon-96x96.png',
  './Icons/launchericon-144x144.png',
  './Icons/launchericon-192x192.png',
  './Icons/launchericon-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return; // no interferir con las llamadas a la API de Drive, etc.

  const url = new URL(req.url);
  if(url.origin !== self.location.origin){
    return; // deja pasar directo las llamadas externas (Google Drive, fuentes, etc.)
  }

  const isNavigation = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if(isNavigation){
    // Network-first: intenta traer lo último; si falla (sin internet), usa la copia guardada
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Resto de archivos propios (manifest, íconos): cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if(cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});

// Al tocar una notificación, enfoca la pestaña de la app si ya está abierta, o abre una nueva si no.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});
