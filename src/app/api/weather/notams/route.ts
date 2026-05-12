import { NextRequest, NextResponse } from "next/server";

// In-memory cache for NOTAMs (1 day TTL)
const notamCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day in milliseconds
const CACHE_CONTROL =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(request: NextRequest) {
  const apiKey = process.env.AVIAPAGES_API_KEY;

  if (!apiKey) {
    console.warn("AVIAPAGES_API_KEY not set");
    return NextResponse.json(
      { type: "FeatureCollection", features: [] },
      { status: 200 },
    );
  }

  const { searchParams } = new URL(request.url);
  const icao = searchParams.get("icao");
  const isPro = searchParams.get("pro") === "true";

  if (!icao) {
    return NextResponse.json(
      { error: "Missing icao parameter" },
      { status: 400 },
    );
  }

  const cacheKey = icao.toUpperCase();
  const cached = notamCache.get(cacheKey);

  // Return cached data if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data, {
      headers: {
        "Cache-Control": CACHE_CONTROL,
        "X-Cache": "HIT",
      },
    });
  }

  // Free users can only see cached data - don't fetch from API
  if (!isPro) {
    return NextResponse.json(
      { type: "FeatureCollection", features: [] },
      { status: 200 },
    );
  }

  try {
    const response = await fetch(
      `https://dir.aviapages.com/api/notams/?icao=${icao.toUpperCase()}&decode=true`,
      {
        headers: {
          Authorization: `Token ${apiKey}`,
        },
        next: { revalidate: 86400 },
      },
    );

    if (!response.ok) {
      console.error(`Aviapages API error: ${response.status}`);
      const text = await response.text();
      console.error(text);
      return NextResponse.json(
        { type: "FeatureCollection", features: [] },
        { status: 200 },
      );
    }

    const data = await response.json();

    // Convert Aviapages response to GeoJSON format
    // Aviapages returns: { "ICAO": [{ text, notam_decoded }] }
    const features: any[] = [];
    let airportLat: number | null = null;
    let airportLon: number | null = null;

    for (const [location, notams] of Object.entries(data)) {
      if (!Array.isArray(notams)) continue;

      for (const notam of notams) {
        const notamText = typeof notam === "string" ? notam : notam.text || "";

        // Extract decoded text and coordinates from notam_decoded
        let decoded = null;
        if (typeof notam === "object" && notam.notam_decoded) {
          decoded = notam.notam_decoded.E || null;

          // Extract coordinates from Q field if available
          const coords = notam.notam_decoded.Q?.coordinates;
          if (coords && !airportLat) {
            airportLat = coords.lat;
            airportLon = coords.lon;
          }
        }

        features.push({
          type: "Feature",
          geometry: null,
          properties: {
            location,
            text: notamText,
            decoded,
          },
        });
      }
    }

    const responseData = {
      type: "FeatureCollection",
      features,
      airportCoords:
        airportLat && airportLon ? { lat: airportLat, lon: airportLon } : null,
    };

    // Store in cache
    notamCache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    return NextResponse.json(responseData, {
      headers: {
        "Cache-Control": CACHE_CONTROL,
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Failed to fetch NOTAMs:", error);
    return NextResponse.json(
      { type: "FeatureCollection", features: [] },
      { status: 200 },
    );
  }
}
