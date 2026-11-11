import "server-only";

// Lightweight in-memory, per-IP rate limiter for unauthenticated proxy routes
// that spend the owner's paid third-party API quota (AVWX, OpenWeather).
//
// This is per-instance (serverless instances each keep their own counters), so
// it is a cost/abuse bound rather than a hard global guarantee — the same model
// as the in-memory response caches these routes already use. It raises the bar
// for unbounded scraping without a shared store, and legitimate same-origin
// usage (a user panning the map) stays well under the limits.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 50_000;
// Opportunistic bulk cleanup cadence. All callers use the same window length,
// so a bucket's resetAt grows with its (re)insertion time and the Map is kept
// in insertion order — the oldest-inserted bucket is therefore always the first
// to expire. That lets the hard-cap eviction reclaim an expired bucket (or, if
// none is expired, the oldest live one) in O(1), with no per-request scan; the
// throttled sweep below is just memory hygiene and runs at most once per
// interval, never on the request path.
const SWEEP_INTERVAL_MS = 60_000;
let lastSweepAt = 0;

function sweepExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
  lastSweepAt = now;
}

export function getClientIp(request: Request): string {
  const header =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    "unknown";
  return header.split(",")[0]!.trim() || "unknown";
}

/**
 * Returns true if the request is allowed, false if the limit is exceeded.
 * `limit` requests are permitted per `windowMs` per key.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = buckets.get(key);

  // Live window for this key: count against the limit in place. Position and
  // resetAt stay put, so insertion order keeps tracking resetAt.
  if (existing && now < existing.resetAt) {
    if (existing.count >= limit) return false;
    existing.count += 1;
    return true;
  }

  // Throttled bulk purge of expired buckets — at most once per interval, never
  // per request, so a flood of distinct keys can't force repeated full scans.
  if (now - lastSweepAt >= SWEEP_INTERVAL_MS) sweepExpired(now);

  if (existing) {
    // Expired window being reset: re-insert at the tail so insertion order
    // continues to track resetAt (no net size change, so no eviction needed).
    buckets.delete(key);
  } else if (buckets.size >= MAX_TRACKED_KEYS) {
    // New key at capacity: drop the oldest-inserted bucket — the earliest to
    // expire, so an expired one when any exists, otherwise the oldest live one.
    // O(1), no scan.
    const oldestKey = buckets.keys().next().value;
    if (oldestKey !== undefined) buckets.delete(oldestKey);
  }

  buckets.set(key, { count: 1, resetAt: now + windowMs });
  return true;
}

export function rateLimitHeaders(retryAfterMs: number) {
  return {
    "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
    "Cache-Control": "no-store",
  };
}
