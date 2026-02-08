// Service Worker for caching map tiles (cache-first strategy)
// Only intercepts requests to known tile servers — all other requests pass through untouched.

const CACHE_NAME = "tile-cache-v1";
const MAX_CACHE_ENTRIES = 2000;

// Tile server hostname patterns to cache
const TILE_HOSTS = [
  "mt0.google.com",
  "mt1.google.com",
  "mt2.google.com",
  "mt3.google.com",
  "tile.openstreetmap.org",
  "a.tile.openstreetmap.org",
  "b.tile.openstreetmap.org",
  "c.tile.openstreetmap.org",
  "a.basemaps.cartocdn.com",
  "b.basemaps.cartocdn.com",
  "c.basemaps.cartocdn.com",
  "d.basemaps.cartocdn.com",
  "api.tiles.openaip.net",
];

function isTileRequest(url) {
  try {
    const hostname = new URL(url).hostname;
    return TILE_HOSTS.some(
      (h) => hostname === h || hostname.endsWith("." + h),
    );
  } catch {
    return false;
  }
}

// Evict oldest entries when cache exceeds limit
async function trimCache() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  if (keys.length > MAX_CACHE_ENTRIES) {
    const toDelete = keys.length - MAX_CACHE_ENTRIES;
    for (let i = 0; i < toDelete; i++) {
      await cache.delete(keys[i]);
    }
  }
}

// Cache-first: serve from cache if available, otherwise fetch and cache
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Clean up old cache versions
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (!isTileRequest(event.request.url)) return;
  event.respondWith(cacheFirst(event.request));
});

// Periodic cache trimming
self.addEventListener("message", (event) => {
  if (event.data === "trim-cache") {
    event.waitUntil(trimCache());
  }
});
