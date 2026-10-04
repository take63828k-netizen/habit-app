const SHELL_CACHE = 'habit-shell-v5'; // index.html などを直したら v2, v3 と上げる
const SHELL = [
  './', './index.html', './manifest.webmanifest', './js/logic.js',
  './vendor/tailwind.js', './vendor/chart.js', './vendor/fa.css',
  './vendor/webfonts/fa-solid-900.woff2', './vendor/webfonts/fa-regular-400.woff2', './vendor/webfonts/fa-brands-400.woff2',
  './img/wallpaper.jpg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE)
    .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// 保存済みを先に返し、裏で更新する。圏外でも動く。
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => {
    const net = fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
