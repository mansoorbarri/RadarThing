import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isPro } from "~/app/actions/is-pro";
import { convex } from "~/server/convex";
import type { ChartType, AirportChart } from "~/types/airportCharts";
import { organizeChartsByType } from "~/services/airportChartsService";
import { isFreeChartIcao } from "~/lib/chartAccess";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";

const VALID_CHART_TYPES: ChartType[] = ["TAXI", "SID", "STAR", "APPROACH"];

export async function GET(request: NextRequest, context: any) {
  const { icao } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const chartType = searchParams.get("type")?.toUpperCase() as
    | ChartType
    | undefined;

  // Validate before charging the FREE allowance so bad requests are free.
  if (chartType && !VALID_CHART_TYPES.includes(chartType)) {
    return NextResponse.json(
      {
        error: `Invalid chart type. Must be one of: ${VALID_CHART_TYPES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const isProUser = await isPro();

  if (!isProUser && !isFreeChartIcao(icao)) {
    return NextResponse.json(
      { error: "PRO required", code: "PRO_REQUIRED" },
      { status: 403 },
    );
  }

  let freeUserClerkId: string | null = null;
  if (!isProUser) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        {
          error: "Sign in with Google to view free airport charts.",
          code: "SIGN_IN_REQUIRED",
        },
        { status: 401 },
      );
    }
    freeUserClerkId = userId;
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

    // FREE users get a few distinct chart airports per day. Charge only after
    // the fetch succeeds so a failed request doesn't use up a slot.
    if (freeUserClerkId) {
      const allowance = await convex.mutation(
        api.freeUsage.consumeFreeAllowance,
        {
          clerkId: freeUserClerkId,
          feature: "charts",
          key: String(icao),
          systemSecret: process.env.CONVEX_SYSTEM_SECRET,
        },
      );
      if (allowance.accountIssue) {
        return NextResponse.json(
          {
            error:
              allowance.accountIssue === "missing"
                ? "Account not ready. Try again in a moment."
                : "Account access restricted",
          },
          { status: 403 },
        );
      }
      if (!allowance.allowed) {
        return NextResponse.json(
          {
            error: `Free accounts can open charts for ${allowance.limit} airports per day. Upgrade to PRO for unlimited charts.`,
            code: "FREE_LIMIT_REACHED",
          },
          { status: 403 },
        );
      }
    }

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
      { status: 500 },
    );
  }
}
