import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";

const ALLOWED_ORIGINS = [
  "https://www.geo-fs.com",
  "https://geo-fs.com",
  "https://geofs-radar.vercel.app",
];

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

  // Require custom header
  const requestedWith = request.headers.get("x-requested-with");
  if (requestedWith !== "GeoFS-Charts") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: corsHeaders(origin) },
    );
  }

  const icao = request.nextUrl.searchParams.get("icao")?.toUpperCase();
  if (!icao || !/^[A-Z]{4}$/.test(icao)) {
    return NextResponse.json(
      { error: "Invalid ICAO code" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  try {
    const dbCharts = await fetchQuery(api.airportCharts.getChartsForAirport, {
      icao,
    });

    const charts = dbCharts.map((c) => ({
      id: c.id,
      icao: c.icao,
      chartType: c.chartType,
      chartName: c.chartName,
      chartUrl: c.chartUrl,
      chartCalibration: c.chartCalibration ?? null,
    }));

    return NextResponse.json({ charts }, { headers: corsHeaders(origin) });
  } catch (error) {
    console.error("Userscript charts fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch charts" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}
