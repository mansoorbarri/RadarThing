import { NextRequest, NextResponse } from "next/server";
import { isPro } from "~/app/actions/is-pro";
import type { ChartType, AirportChart } from "~/types/airportCharts";
import { organizeChartsByType } from "~/services/airportChartsService";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";

const VALID_CHART_TYPES: ChartType[] = ["TAXI", "SID", "STAR", "APPROACH", "GENERAL"];

export async function GET(request: NextRequest, context: any) {
  const { icao } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const chartType = searchParams.get("type")?.toUpperCase() as ChartType | undefined;

  const isProUser = await isPro();

  if (!isProUser) {
    return NextResponse.json({ error: "PRO required" }, { status: 403 });
  }

  // Validate chart type if provided
  if (chartType && !VALID_CHART_TYPES.includes(chartType)) {
    return NextResponse.json(
      { error: `Invalid chart type. Must be one of: ${VALID_CHART_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    // Fetch approved charts from Convex
    const dbCharts = await fetchQuery(api.airportCharts.getChartsForAirport, {
      icao: icao.toUpperCase(),
      chartType: chartType,
    });

    const charts: AirportChart[] = dbCharts.map((c) => ({
      id: c.id,
      icao: c.icao,
      chartType: c.chartType as ChartType,
      chartName: c.chartName,
      chartUrl: c.chartUrl,
      imageKey: c.imageKey,
      source: c.source as "COMMUNITY",
      isApproved: c.isApproved,
      uploadedBy: c.uploadedBy,
      approvedBy: c.approvedBy,
      approvedAt: c.approvedAt,
      createdAt: c.createdAt,
    }));

    // If specific type requested, return filtered charts
    if (chartType) {
      return NextResponse.json({ charts });
    }

    // Return all charts organized by type
    const organizedCharts = organizeChartsByType(charts);
    return NextResponse.json({ charts: organizedCharts });
  } catch (error) {
    console.error("Failed to fetch charts:", error);
    return NextResponse.json(
      { error: "Failed to fetch charts" },
      { status: 500 }
    );
  }
}
