import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { NO_EVENT_FLIGHT_MESSAGE } from "~/lib/flightAccess";

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
    Vary: "Origin, X-Requested-With",
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
  if (request.headers.get("x-requested-with") !== "GeoFS-RadarThing") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: corsHeaders(origin) },
    );
  }

  const googleId =
    request.nextUrl.searchParams.get("googleId")?.trim() || undefined;
  if (
    googleId &&
    (googleId.length > 64 || !/^[A-Za-z0-9_-]+$/.test(googleId))
  ) {
    return NextResponse.json(
      { error: "Invalid googleId" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  try {
    const access = await fetchQuery(api.siteSettings.getFlightStartAccess, {
      googleId,
    });
    return NextResponse.json(
      {
        ...access,
        message: access.allowed ? null : NO_EVENT_FLIGHT_MESSAGE,
      },
      {
        headers: {
          ...corsHeaders(origin),
          // An admin flipping the event switch must take effect right away.
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Userscript flight-access fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to check flight access" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}
