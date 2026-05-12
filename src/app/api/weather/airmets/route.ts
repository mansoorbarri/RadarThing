import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch(
    "https://aviationweather.gov/api/data/airmet?format=geojson",
    { next: { revalidate: 300 } },
  );
  const data = await res.json();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control":
        "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
