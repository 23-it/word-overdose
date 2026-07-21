// sw.js — Service Worker。全アセットをプリキャッシュし cache-first で完全オフライン動作。
// アセットを変えたら CACHE_VERSION を上げること（古いキャッシュは activate で破棄）。

const CACHE_VERSION = 'v1';
const CACHE_NAME = `dopagaki-${CACHE_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
  './js/main.js',
  './js/data/words.js',
  './js/core/combo.js',
  './js/core/score.js',
  './js/core/quiz.js',
  './js/core/storage.js',
  './js/screens/home.js',
  './js/screens/game.js',
  './js/screens/result.js',
  './js/screens/settings.js',
  './js/audio/engine.js',
  './js/audio/sfx.js',
  './js/audio/bgm.js',
  './js/fx/canvas.js',
  './js/fx/particles.js',
  './js/fx/effects.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (cached) =>
        cached ||
        fetch(e.request).then((res) => {
          // 同一オリジンの新規リソースはキャッシュに追加
          if (res.ok && new URL(e.request.url).origin === location.origin) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return res;
        })
    )
  );
});
