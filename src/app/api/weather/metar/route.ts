import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";

const CACHE_TTL_MS = 5 * 60 * 1000;
const metarCache = new Map<string, { data: unknown; timestamp: number }>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const icao = searchParams.get("icao")?.trim().toUpperCase();

  if (!icao || icao.length < 4) {
    return NextResponse.json(
      { error: "Missing or invalid icao parameter" },
      { status: 400 },
    );
  }

  const cached = metarCache.get(icao);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data, {
      headers: {
        "Cache-Control": "public, max-age=300",
        "X-Cache": "HIT",
      },
    });
  }

  const response = await fetch(`https://avwx.rest/api/metar/${icao}`, {
    headers: {
      Authorization: `Bearer ${env.AVWX_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to fetch METAR" },
      { status: response.status },
    );
  }

  const data = await response.json();
  metarCache.set(icao, { data, timestamp: Date.now() });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "X-Cache": "MISS",
    },
  });
}
