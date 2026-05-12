import { NextRequest, NextResponse } from "next/server";

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_CONTROL = "public, max-age=300, s-maxage=300, stale-while-revalidate=86400";
const atisCache = new Map<string, { data: unknown; timestamp: number }>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const icao = searchParams.get("icao")?.trim().toUpperCase();

  if (!icao || icao.length < 4) {
    return NextResponse.json(
      { error: "Missing or invalid icao parameter" },
      { status: 400 },
    );
  }

  const cached = atisCache.get(icao);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data, {
      headers: {
        "Cache-Control": CACHE_CONTROL,
        "X-Cache": "HIT",
      },
    });
  }

  const response = await fetch(`https://atis.info/api/${icao}`, {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to fetch ATIS" },
      { status: response.status },
    );
  }

  const data = await response.json();
  atisCache.set(icao, { data, timestamp: Date.now() });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": CACHE_CONTROL,
      "X-Cache": "MISS",
    },
  });
}
