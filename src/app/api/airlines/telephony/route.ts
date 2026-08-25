import { type NextRequest, NextResponse } from "next/server";
import { type AirlineTelephony } from "~/lib/airlineTelephony";

const ADSBDB_BASE_URL = "https://api.adsbdb.com/v0/airline";
const CACHE_TTL_SECONDS = 90 * 24 * 60 * 60;
const MAX_CODES_PER_REQUEST = 100;
const CACHE_CONTROL = `public, max-age=86400, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=604800`;

interface AdsbdbAirline {
  name?: unknown;
  icao?: unknown;
  callsign?: unknown;
}

interface AdsbdbResponse {
  response?: unknown;
}

function normalizeRequestedCodes(value: string | null): string[] {
  if (!value) return [];

  return Array.from(
    new Set(
      value
        .split(",")
        .map((code) => code.trim().toUpperCase())
        .filter((code) => /^[A-Z]{3}$/.test(code)),
    ),
  ).slice(0, MAX_CODES_PER_REQUEST);
}

function parseAirline(
  code: string,
  payload: AdsbdbResponse,
): AirlineTelephony | null {
  const candidates = Array.isArray(payload.response)
    ? payload.response
    : [payload.response];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;

    const airline = candidate as AdsbdbAirline;
    const icao =
      typeof airline.icao === "string" ? airline.icao.trim().toUpperCase() : "";
    const name = typeof airline.name === "string" ? airline.name.trim() : "";
    const telephonyDesignator =
      typeof airline.callsign === "string"
        ? airline.callsign.trim().toUpperCase()
        : "";

    if (icao === code && name && telephonyDesignator) {
      return { icao, name, telephonyDesignator };
    }
  }

  return null;
}

async function fetchAirline(
  code: string,
): Promise<AirlineTelephony | null | undefined> {
  try {
    const response = await fetch(`${ADSBDB_BASE_URL}/${code}`, {
      headers: { Accept: "application/json" },
      next: {
        revalidate: CACHE_TTL_SECONDS,
        tags: [`adsbdb-airline-${code}`],
      },
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`ADSBDB returned ${response.status}`);

    return parseAirline(code, (await response.json()) as AdsbdbResponse);
  } catch (error) {
    console.error(`Failed to fetch ADSBDB airline ${code}`, error);
    return undefined;
  }
}

export async function GET(request: NextRequest) {
  const codes = normalizeRequestedCodes(
    request.nextUrl.searchParams.get("icao"),
  );

  if (codes.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one three-letter ICAO airline designator" },
      { status: 400 },
    );
  }

  const results = (
    await Promise.all(
      codes.map(async (code) => [code, await fetchAirline(code)] as const),
    )
  ).filter(
    (result): result is readonly [string, AirlineTelephony | null] =>
      result[1] !== undefined,
  );
  const hadUpstreamFailure = results.length !== codes.length;

  return NextResponse.json(
    { airlines: Object.fromEntries(results) },
    {
      headers: {
        "Cache-Control": hadUpstreamFailure ? "no-store" : CACHE_CONTROL,
      },
    },
  );
}
