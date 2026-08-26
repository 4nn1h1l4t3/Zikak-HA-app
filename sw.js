// ZIKAK — Service worker : cache-first pour un fonctionnement 100% hors-ligne.
// À chaque mise à jour de l'appli, monte CACHE_VERSION pour forcer le
// rechargement des fichiers chez tous les marchands qui l'utilisent.
const CACHE_VERSION = 'zikak-v14';
const CROSS_ORIGIN_ASSETS = [
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-compat.js',
];
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  ...CROSS_ORIGIN_ASSETS,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first pour les fichiers de l'appli ET les 3 SDK Firebase précachés
// ci-dessus (même hors-ligne dès le premier lancement, ils sont déjà en
// cache). Toute autre requête cross-origin — en particulier les appels
// réseau de Firestore lui-même (synchronisation, transactions) — passe
// directement au réseau sans interception : le cache-first casserait la
// synchronisation temps réel et le mode offline propre à Firestore, qui
// gère déjà tout ça lui-même.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  const sameOrigin = new URL(url).origin === self.location.origin;
  if (!sameOrigin && !CROSS_ORIGIN_ASSETS.includes(url)) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
