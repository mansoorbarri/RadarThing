import { NextRequest, NextResponse } from "next/server";
import { convex, api } from "~/server/convex";
import { acarsCors, acarsTokenHash } from "~/server/acars";

export function OPTIONS(request: NextRequest) {
  const cors = acarsCors(request.headers.get("origin"));
  return new NextResponse(null, {
    status: cors.allowed ? 204 : 403,
    headers: cors.headers,
  });
}

export async function POST(request: NextRequest) {
  const cors = acarsCors(request.headers.get("origin"));
  if (
    !cors.allowed ||
    request.headers.get("x-requested-with") !== "GeoFS-RadarThing"
  )
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: cors.headers },
    );
  try {
    const payload: unknown = await request.json();
    if (
      !payload ||
      typeof payload !== "object" ||
      !("googleId" in payload) ||
      typeof payload.googleId !== "string"
    )
      return NextResponse.json(
        { error: "Invalid device registration" },
        { status: 400, headers: cors.headers },
      );
    await convex.mutation(api.acars.registerDevice, {
      googleId: payload.googleId,
      tokenHash: acarsTokenHash(request.headers.get("x-acars-token") ?? ""),
      systemSecret: process.env.CONVEX_SYSTEM_SECRET!,
    });
    return NextResponse.json({ registered: true }, { headers: cors.headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed" },
      { status: 400, headers: cors.headers },
    );
  }
}
