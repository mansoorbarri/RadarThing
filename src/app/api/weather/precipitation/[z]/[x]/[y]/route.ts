import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { getClientIp, rateLimit, rateLimitHeaders } from "~/server/rateLimit";

const CACHE_CONTROL =
  "public, max-age=300, s-maxage=300, stale-while-revalidate=86400";
// OpenWeather tiles are a paid upstream. Tile loads are bursty (a map pan/zoom
// fetches many tiles), so the per-IP cap is generous but still bounds
// unauthenticated scraping. The CDN cache absorbs repeats for the same tile.
const RATE_LIMIT = 1200;
const RATE_WINDOW_MS = 60 * 1000;

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      z: string;
      x: string;
      y: string;
    }>;
  },
) {
  if (
    !rateLimit(`precip:${getClientIp(request)}`, RATE_LIMIT, RATE_WINDOW_MS)
  ) {
    return new NextResponse(null, {
      status: 429,
      headers: rateLimitHeaders(RATE_WINDOW_MS),
    });
  }

  const { z, x, y } = await context.params;
  // Only plain non-negative integers; the values are interpolated into the
  // upstream URL, so this blocks path/query injection. No digit-count cap:
  // tile x/y already exceed three digits at zoom 11+ (coords run 0..2^z-1).
  if (![z, x, y].every((value) => /^\d{1,7}$/.test(value))) {
    return new NextResponse(null, { status: 400 });
  }
  const upstreamUrl = `https://tile.openweathermap.org/map/precipitation_new/${z}/${x}/${y}.png?appid=${env.OPENWEATHERMAP_API_KEY}`;

  const response = await fetch(upstreamUrl, {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }

  const contentType = response.headers.get("content-type") ?? "image/png";
  const buffer = await response.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
