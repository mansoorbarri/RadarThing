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

  if (!existing || now >= existing.resetAt) {
    // Opportunistically drop expired entries so the map cannot grow without
    // bound under a flood of distinct IPs.
    if (buckets.size >= MAX_TRACKED_KEYS) {
      for (const [k, bucket] of buckets) {
        if (now >= bucket.resetAt) buckets.delete(k);
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

export function rateLimitHeaders(retryAfterMs: number) {
  return {
    "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
    "Cache-Control": "no-store",
  };
}
