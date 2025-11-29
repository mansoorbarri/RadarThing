import { NextRequest, NextResponse } from "next/server";
import { activeAircraft } from "~/lib/aircraft-store";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (
      !body.callsign ||
      typeof body.lat !== "number" ||
      typeof body.lon !== "number"
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const id = body.id || `${body.callsign}:${body.playerId || "p"}`;

    const positionData = {
      id,
      callsign: body.callsign || "",
      type: body.type || "",
      lat: Number(body.lat) || 0,
      lon: Number(body.lon) || 0,
      alt: Number(body.alt) || 0,
      altMSL: Number(body.altMSL) || 0,
      heading: typeof body.heading !== "undefined" ? Number(body.heading) : 0,
      speed: typeof body.speed !== "undefined" ? Number(body.speed) : 0,
      flightNo: body.flightNo || "",
      departure: body.departure || "",
      arrival: body.arrival || "",
      takeoffTime: body.takeoffTime || "",
      squawk: body.squawk || "",
      flightPlan: body.flightPlan || [],
      nextWaypoint: body.nextWaypoint || "",
      vspeed: body.vspeed || "",
      ts: Date.now(),
      lastSeen: Date.now(),
    };

    activeAircraft.set(id, positionData);

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
      },
      {
        headers: CORS_HEADERS,
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

export function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const callsign = searchParams.get("callsign");
    const id = searchParams.get("id");

    if (id) {
      const aircraft = activeAircraft.get(id);
      if (!aircraft) {
        return NextResponse.json(
          { error: "Aircraft not found" },
          { status: 404, headers: CORS_HEADERS },
        );
      }

      const { lastSeen, ...data } = aircraft;
      return NextResponse.json(
        {
          aircraft: data,
          lastSeen: new Date(lastSeen).toISOString(),
        },
        {
          headers: CORS_HEADERS,
        },
      );
    }

    if (callsign) {
      const found = Array.from(activeAircraft.values()).find(
        (a) => a.callsign === callsign,
      );

      if (!found) {
        return NextResponse.json(
          { error: "Aircraft not found" },
          { status: 404, headers: CORS_HEADERS },
        );
      }

      const { lastSeen, ...data } = found;
      return NextResponse.json(
        {
          aircraft: data,
          lastSeen: new Date(lastSeen).toISOString(),
        },
        {
          headers: CORS_HEADERS,
        },
      );
    }

    const allAircraft = Array.from(activeAircraft.values()).map(
      ({ lastSeen, ...data }) => ({
        ...data,
        lastSeen: new Date(lastSeen).toISOString(),
      }),
    );

    return NextResponse.json(
      {
        count: allAircraft.length,
        aircraft: allAircraft,
        timestamp: new Date().toISOString(),
      },
      {
        headers: CORS_HEADERS,
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

export async function OPTIONS() {
  await Promise.resolve();
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}
