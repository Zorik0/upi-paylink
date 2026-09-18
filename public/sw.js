// UPI PayLink service worker: offline support and the share target.
const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;
const SHARE_CACHE = "share-target";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([STATIC_CACHE, PAGE_CACHE, SHARE_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Firestore etc. go straight to the network

  if (request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(receiveShare(request));
    return;
  }
  if (request.method !== "GET") return;

  // Hashed build assets, app logos and icons never change under the same URL.
  if (/^\/(_next\/static|apps|icons)\//.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Pages: always try the network so links and deploys stay fresh; fall back
  // to the last copy seen, then to the offline page.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match(OFFLINE_URL));
  }
}

async function receiveShare(request) {
  try {
    const data = await request.formData();
    const file = data.get("image");
    if (file && typeof file !== "string") {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put("/shared-image", new Response(file, { headers: { "Content-Type": file.type } }));
      return Response.redirect("/?shared=1", 303);
    }
  } catch {
    // fall through
  }
  return Response.redirect("/?shared=error", 303);
}
