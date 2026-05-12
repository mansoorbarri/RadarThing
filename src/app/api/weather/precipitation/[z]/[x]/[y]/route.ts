import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";

const CACHE_CONTROL =
  "public, max-age=300, s-maxage=300, stale-while-revalidate=86400";

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
  const { z, x, y } = await context.params;
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
