// Vino·Diary service worker
const CACHE = "vinodiary-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = e.request.url;
  // Apps Script API 요청은 항상 네트워크 (캐시하지 않음)
  if (url.includes("script.google.com") || url.includes("googleusercontent")) {
    return;
  }
  // 앱 셸은 네트워크 우선, 실패 시 캐시
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (e.request.method === "GET" && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
