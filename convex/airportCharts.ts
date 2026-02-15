import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const chartTypeValidator = v.union(
  v.literal("TAXI"),
  v.literal("SID"),
  v.literal("STAR"),
  v.literal("APPROACH"),
  v.literal("GENERAL")
);

// Helper to extract calibration data from a chart document
function mapCalibration(chart: {
  calibrationP1PixelX?: number;
  calibrationP1PixelY?: number;
  calibrationP1Lat?: number;
  calibrationP1Lon?: number;
  calibrationP2PixelX?: number;
  calibrationP2PixelY?: number;
  calibrationP2Lat?: number;
  calibrationP2Lon?: number;
  calibratedBy?: string;
}) {
  if (
    chart.calibrationP1PixelX != null &&
    chart.calibrationP1PixelY != null &&
    chart.calibrationP1Lat != null &&
    chart.calibrationP1Lon != null &&
    chart.calibrationP2PixelX != null &&
    chart.calibrationP2PixelY != null &&
    chart.calibrationP2Lat != null &&
    chart.calibrationP2Lon != null &&
    chart.calibratedBy != null
  ) {
    return {
      p1PixelX: chart.calibrationP1PixelX,
      p1PixelY: chart.calibrationP1PixelY,
      p1Lat: chart.calibrationP1Lat,
      p1Lon: chart.calibrationP1Lon,
      p2PixelX: chart.calibrationP2PixelX,
      p2PixelY: chart.calibrationP2PixelY,
      p2Lat: chart.calibrationP2Lat,
      p2Lon: chart.calibrationP2Lon,
      calibratedBy: chart.calibratedBy,
    };
  }
  return null;
}

// Get approved charts for an airport, optionally filtered by type
export const getChartsForAirport = query({
  args: {
    icao: v.string(),
    chartType: v.optional(chartTypeValidator),
  },
  handler: async (ctx, args) => {
    const icao = args.icao.toUpperCase();

    let charts;
    if (args.chartType) {
      charts = await ctx.db
        .query("airportCharts")
        .withIndex("by_icao_type_approved", (q) =>
          q.eq("icao", icao).eq("chartType", args.chartType!).eq("isApproved", true)
        )
        .collect();
    } else {
      charts = await ctx.db
        .query("airportCharts")
        .withIndex("by_icao", (q) => q.eq("icao", icao))
        .filter((q) => q.eq(q.field("isApproved"), true))
        .collect();
    }

    return charts.map((chart) => ({
      id: chart._id,
      icao: chart.icao,
      chartType: chart.chartType,
      chartName: chart.chartName,
      chartUrl: chart.chartUrl,
      imageKey: chart.imageKey ?? null,
      source: chart.source,
      isApproved: chart.isApproved,
      uploadedBy: chart.uploadedBy ?? null,
      approvedBy: chart.approvedBy ?? null,
      approvedAt: chart.approvedAt ?? null,
      createdAt: chart._creationTime,
      calibration: mapCalibration(chart),
    }));
  },
});

// Get pending charts (admin only - authorization handled in server action)
export const getPending = query({
  args: {},
  handler: async (ctx) => {
    const charts = await ctx.db
      .query("airportCharts")
      .withIndex("by_isApproved", (q) => q.eq("isApproved", false))
      .order("desc")
      .collect();

    return charts.map((chart) => ({
      id: chart._id,
      icao: chart.icao,
      chartType: chart.chartType,
      chartName: chart.chartName,
      chartUrl: chart.chartUrl,
      imageKey: chart.imageKey ?? null,
      source: chart.source,
      isApproved: chart.isApproved,
      uploadedBy: chart.uploadedBy ?? null,
      discordUsername: chart.discordUsername ?? null,
      approvedBy: chart.approvedBy ?? null,
      approvedAt: chart.approvedAt ?? null,
      createdAt: chart._creationTime,
      calibration: mapCalibration(chart),
    }));
  },
});

// Get all approved charts
export const getApproved = query({
  args: {},
  handler: async (ctx) => {
    const charts = await ctx.db
      .query("airportCharts")
      .withIndex("by_isApproved", (q) => q.eq("isApproved", true))
      .collect();

    // Sort by ICAO then chart type then name
    return charts
      .sort((a, b) => {
        const icaoCompare = a.icao.localeCompare(b.icao);
        if (icaoCompare !== 0) return icaoCompare;
        const typeCompare = a.chartType.localeCompare(b.chartType);
        if (typeCompare !== 0) return typeCompare;
        return a.chartName.localeCompare(b.chartName);
      })
      .map((chart) => ({
        id: chart._id,
        icao: chart.icao,
        chartType: chart.chartType,
        chartName: chart.chartName,
        chartUrl: chart.chartUrl,
        imageKey: chart.imageKey ?? null,
        source: chart.source,
        isApproved: chart.isApproved,
        uploadedBy: chart.uploadedBy ?? null,
        discordUsername: chart.discordUsername ?? null,
        approvedBy: chart.approvedBy ?? null,
        approvedAt: chart.approvedAt ?? null,
        createdAt: chart._creationTime,
        calibration: mapCalibration(chart),
      }));
  },
});

// Get chart by ID
export const getById = query({
  args: { id: v.id("airportCharts") },
  handler: async (ctx, args) => {
    const chart = await ctx.db.get(args.id);
    if (!chart) return null;

    return {
      id: chart._id,
      icao: chart.icao,
      chartType: chart.chartType,
      chartName: chart.chartName,
      chartUrl: chart.chartUrl,
      imageKey: chart.imageKey ?? null,
      source: chart.source,
      isApproved: chart.isApproved,
      uploadedBy: chart.uploadedBy ?? null,
      approvedBy: chart.approvedBy ?? null,
      approvedAt: chart.approvedAt ?? null,
      createdAt: chart._creationTime,
      calibration: mapCalibration(chart),
    };
  },
});

// Create airport chart
export const create = mutation({
  args: {
    icao: v.string(),
    chartType: chartTypeValidator,
    chartName: v.string(),
    chartUrl: v.string(),
    imageKey: v.optional(v.string()),
    uploadedBy: v.optional(v.string()),
    discordUsername: v.optional(v.string()),
    isApproved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("airportCharts", {
      icao: args.icao.toUpperCase(),
      chartType: args.chartType,
      chartName: args.chartName,
      chartUrl: args.chartUrl,
      imageKey: args.imageKey,
      source: "COMMUNITY",
      isApproved: args.isApproved ?? false,
      uploadedBy: args.uploadedBy,
      discordUsername: args.discordUsername,
    });

    const chart = await ctx.db.get(id);
    if (!chart) return null;

    return {
      id: chart._id,
      icao: chart.icao,
      chartType: chart.chartType,
      chartName: chart.chartName,
      chartUrl: chart.chartUrl,
      imageKey: chart.imageKey ?? null,
      source: chart.source,
      isApproved: chart.isApproved,
      uploadedBy: chart.uploadedBy ?? null,
      approvedBy: chart.approvedBy ?? null,
      approvedAt: chart.approvedAt ?? null,
      createdAt: chart._creationTime,
      calibration: mapCalibration(chart),
    };
  },
});

// Approve airport chart
export const approve = mutation({
  args: {
    id: v.id("airportCharts"),
    approvedBy: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isApproved: true,
      approvedBy: args.approvedBy,
      approvedAt: Date.now(),
    });
  },
});

// Update airport chart details
export const update = mutation({
  args: {
    id: v.id("airportCharts"),
    icao: v.string(),
    chartType: chartTypeValidator,
    chartName: v.string(),
  },
  handler: async (ctx, args) => {
    const chart = await ctx.db.get(args.id);
    if (!chart) return null;

    await ctx.db.patch(args.id, {
      icao: args.icao.toUpperCase(),
      chartType: args.chartType,
      chartName: args.chartName,
    });

    return {
      id: chart._id,
      icao: args.icao.toUpperCase(),
      chartType: args.chartType,
      chartName: args.chartName,
      imageKey: chart.imageKey ?? null,
    };
  },
});

// Delete airport chart
export const remove = mutation({
  args: { id: v.id("airportCharts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Bulk approve airport charts
export const bulkApprove = mutation({
  args: {
    ids: v.array(v.id("airportCharts")),
    approvedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const results: { id: string; success: boolean }[] = [];
    const now = Date.now();

    for (const id of args.ids) {
      const chart = await ctx.db.get(id);
      if (!chart) {
        results.push({ id, success: false });
        continue;
      }

      await ctx.db.patch(id, {
        isApproved: true,
        approvedBy: args.approvedBy,
        approvedAt: now,
      });

      results.push({ id, success: true });
    }

    return results;
  },
});

// Bulk delete airport charts
export const bulkRemove = mutation({
  args: {
    ids: v.array(v.id("airportCharts")),
  },
  handler: async (ctx, args) => {
    const results: {
      id: string;
      success: boolean;
      imageKey?: string;
      uploadedBy?: string;
      icao?: string;
      chartType?: string;
      chartName?: string;
    }[] = [];

    for (const id of args.ids) {
      const chart = await ctx.db.get(id);
      if (!chart) {
        results.push({ id, success: false });
        continue;
      }

      await ctx.db.delete(id);
      results.push({
        id,
        success: true,
        imageKey: chart.imageKey ?? undefined,
        uploadedBy: chart.uploadedBy ?? undefined,
        icao: chart.icao,
        chartType: chart.chartType,
        chartName: chart.chartName,
      });
    }

    return results;
  },
});

// Get count of approved charts uploaded by a specific user
export const getApprovedCountByUser = query({
  args: { uploadedBy: v.string() },
  handler: async (ctx, args) => {
    const charts = await ctx.db
      .query("airportCharts")
      .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", args.uploadedBy))
      .filter((q) => q.eq(q.field("isApproved"), true))
      .collect();

    return charts.length;
  },
});

// Save calibration data for a chart
export const calibrate = mutation({
  args: {
    id: v.id("airportCharts"),
    p1PixelX: v.float64(),
    p1PixelY: v.float64(),
    p1Lat: v.float64(),
    p1Lon: v.float64(),
    p2PixelX: v.float64(),
    p2PixelY: v.float64(),
    p2Lat: v.float64(),
    p2Lon: v.float64(),
    calibratedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const chart = await ctx.db.get(args.id);
    if (!chart) throw new Error("Chart not found");

    await ctx.db.patch(args.id, {
      calibrationP1PixelX: args.p1PixelX,
      calibrationP1PixelY: args.p1PixelY,
      calibrationP1Lat: args.p1Lat,
      calibrationP1Lon: args.p1Lon,
      calibrationP2PixelX: args.p2PixelX,
      calibrationP2PixelY: args.p2PixelY,
      calibrationP2Lat: args.p2Lat,
      calibrationP2Lon: args.p2Lon,
      calibratedBy: args.calibratedBy,
    });
  },
});

// Check upload eligibility (check for duplicate pending by user)
export const checkUploadEligibility = query({
  args: {
    icao: v.string(),
    chartType: chartTypeValidator,
    chartName: v.string(),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const icao = args.icao.toUpperCase();

    // Check for pending chart by this user for same ICAO, type, and name
    const pendingByUser = await ctx.db
      .query("airportCharts")
      .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", args.uploadedBy))
      .filter((q) =>
        q.and(
          q.eq(q.field("icao"), icao),
          q.eq(q.field("chartType"), args.chartType),
          q.eq(q.field("chartName"), args.chartName),
          q.eq(q.field("isApproved"), false)
        )
      )
      .first();

    return {
      pendingByUserExists: pendingByUser !== null,
    };
  },
});
