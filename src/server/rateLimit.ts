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
// Expired entries are purged by a time-throttled sweep rather than on every new
// key, so a flood of distinct keys cannot force an O(n) scan per request.
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

  // Live window for this key: count against the limit in place (no insert).
  if (existing && now < existing.resetAt) {
    if (existing.count >= limit) return false;
    existing.count += 1;
    return true;
  }

  // New key, or this key's window has expired and is being reset.
  const isNewKey = existing === undefined;
  if (isNewKey) {
    // Throttled routine purge so steady-state growth stays bounded without an
    // O(n) scan on every new key.
    if (now - lastSweepAt >= SWEEP_INTERVAL_MS) sweepExpired(now);
    if (buckets.size >= MAX_TRACKED_KEYS) {
      // At hard capacity, reclaim every expired bucket first (this scan runs
      // only while the map is full), so an expired entry is always dropped
      // before any live, still-rate-limited one.
      sweepExpired(now);
      if (buckets.size >= MAX_TRACKED_KEYS) {
        // Every remaining bucket is live; evict the oldest-inserted so size
        // never exceeds the cap. Only reachable under a flood of distinct
        // live keys, where resetting one key's window is the bounded cost.
        const oldest = buckets.keys().next().value;
        if (oldest !== undefined) buckets.delete(oldest);
      }
    }
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
