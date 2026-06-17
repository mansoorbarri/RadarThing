import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "~/env";

const DEFAULT_VSTRIPS_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://vstrips.xyzmani.com"
    : "http://localhost:3001";

function getEndpoint() {
  const baseUrl = DEFAULT_VSTRIPS_BASE_URL.replace(/\/$/, "");
  return `${baseUrl}/api/public/flight-filing`;
}

async function proxyVstrips(init?: RequestInit) {
  const response = await fetch(getEndpoint(), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(env.VSTRIPS_INTEGRATION_SECRET
        ? { "x-vstrips-integration-secret": env.VSTRIPS_INTEGRATION_SECRET }
        : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as unknown;
  return NextResponse.json(data ?? { error: "Invalid vstrips response" }, {
    status: response.status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  try {
    return await proxyVstrips();
  } catch {
    return NextResponse.json(
      { settings: null, unavailable: true },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    return await proxyVstrips({
      method: "POST",
      body: JSON.stringify(await req.json()),
    });
  } catch (error) {
    console.error("Failed to proxy vstrips filing submission:", error);
    return NextResponse.json(
      { error: "Unable to reach vstrips" },
      { status: 502 },
    );
  }
}
