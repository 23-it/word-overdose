// sw.js — Service Worker。
// 戦略: 同一オリジンは network-first（オンライン時は常に最新を配信し、キャッシュも更新）。
// オフライン時のみキャッシュにフォールバックするので、更新の取りこぼしが起きない。

const CACHE_VERSION = 'v8';
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
  const sameOrigin = new URL(e.request.url).origin === location.origin;
  if (!sameOrigin) return; // 外部リソースはそのまま

  // network-first: まずネットワーク→成功したらキャッシュ更新、失敗時のみキャッシュ
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
