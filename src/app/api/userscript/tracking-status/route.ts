import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";

const ALLOWED_ORIGINS = ["https://www.geo-fs.com", "https://geo-fs.com"];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(
    (allowed) => origin === allowed || origin.endsWith(".geo-fs.com"),
  );
}

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin":
      origin && isAllowedOrigin(origin) ? origin : "",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "X-Requested-With",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const requestedWith = request.headers.get("x-requested-with");
  if (requestedWith !== "GeoFS-RadarThing") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: corsHeaders(origin) },
    );
  }

  const callsign = request.nextUrl.searchParams
    .get("callsign")
    ?.trim()
    .toUpperCase();
  if (!callsign || callsign.length > 32 || /\s/.test(callsign)) {
    return NextResponse.json(
      { error: "Invalid callsign" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  try {
    const status = await fetchQuery(api.activeTrackers.getTrackingStatus, {
      callsign,
    });
    return NextResponse.json(status, {
      headers: {
        ...corsHeaders(origin),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Userscript tracking-status fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch tracking status" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}
