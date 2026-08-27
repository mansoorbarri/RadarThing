import { NextResponse } from "next/server";
import { env } from "~/env";

const MAX_ZOOM = 20;
const CACHE_CONTROL =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";

function parseCoordinate(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;

  const coordinate = Number(value);
  return Number.isSafeInteger(coordinate) ? coordinate : null;
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      z: string;
      x: string;
      y: string;
    }>;
  },
) {
  const { z: rawZ, x: rawX, y: rawY } = await context.params;
  const z = parseCoordinate(rawZ);
  const x = parseCoordinate(rawX);
  const y = parseCoordinate(rawY);

  if (z === null || x === null || y === null || z > MAX_ZOOM) {
    return new NextResponse(null, { status: 400 });
  }

  const tileCount = 2 ** z;
  if (x >= tileCount || y >= tileCount) {
    return new NextResponse(null, { status: 400 });
  }

  const scale = new URL(request.url).searchParams.get("scale");
  if (scale !== null && scale !== "" && scale !== "@2x") {
    return new NextResponse(null, { status: 400 });
  }

  const retinaSuffix = scale === "@2x" ? "@2x" : "";
  const upstreamUrl = new URL(
    `https://basemaps.cartocdn.com/rastertiles/dark_all/${z}/${x}/${y}${retinaSuffix}.png`,
  );
  upstreamUrl.searchParams.set("key", env.CARTO_BASEMAP_API_KEY);

  try {
    const response = await fetch(upstreamUrl, {
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return new NextResponse(null, { status: response.status });
    }

    return new NextResponse(await response.arrayBuffer(), {
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "image/png",
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
