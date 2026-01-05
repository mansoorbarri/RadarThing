import { NextRequest, NextResponse } from "next/server";
import { getAirportChart } from "~/services/airportChartsService";
import { isPro } from "~/app/actions/is-pro";

export async function GET(_request: NextRequest, context: any) {
  const { icao } = await context.params;

  const isProUser = await isPro();

  if (!isProUser) {
    return NextResponse.json({ error: "PrO required" }, { status: 403 });
  }

  try {
    const chart = await getAirportChart(icao);
    // console.log(chart);
    return NextResponse.json({ chart });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch chart" },
      { status: 500 },
    );
  }
}
