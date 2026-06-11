import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAdminTelemetry } from "./adminTelemetry";
import { requireAdmin, requireAuthenticatedClerkId } from "./lib/auth";

const chartTypeValidator = v.union(
  v.literal("TAXI"),
  v.literal("SID"),
  v.literal("STAR"),
  v.literal("APPROACH"),
);

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
          q
            .eq("icao", icao)
            .eq("chartType", args.chartType!)
            .eq("isApproved", true),
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
    }));
  },
});

// Get pending charts (admin only - authorization handled in server action)
export const getPending = query({
  args: {},
  handler: async (ctx) => {
    try {
      await requireAdmin(ctx);
    } catch {
      return [];
    }

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
    const uploadedBy = await requireAuthenticatedClerkId(ctx, args.uploadedBy);

    const id = await ctx.db.insert("airportCharts", {
      icao: args.icao.toUpperCase(),
      chartType: args.chartType,
      chartName: args.chartName,
      chartUrl: args.chartUrl,
      imageKey: args.imageKey,
      source: "COMMUNITY",
      isApproved: false,
      uploadedBy,
      discordUsername: args.discordUsername,
    });

    const chart = await ctx.db.get(id);
    if (!chart) return null;

    if (chart.uploadedBy) {
      await logAdminTelemetry(ctx, {
        actorClerkId: chart.uploadedBy,
        action: "upload",
        resourceType: "airport_chart",
        resourceId: chart._id,
        resourceLabel: `${chart.icao} ${chart.chartType} ${chart.chartName}`,
        targetClerkId: chart.uploadedBy,
        metadata: {
          icao: chart.icao,
          chartType: chart.chartType,
          chartName: chart.chartName,
          discordUsername: chart.discordUsername ?? null,
        },
      });
    }

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
    const actor = await requireAdmin(ctx, { actorClerkId: args.approvedBy });
    const chart = await ctx.db.get(args.id);
    if (!chart) return;

    await ctx.db.patch(args.id, {
      isApproved: true,
      approvedBy: actor.clerkId,
      approvedAt: Date.now(),
    });

    await logAdminTelemetry(ctx, {
      actorClerkId: actor.clerkId,
      action: "approve",
      resourceType: "airport_chart",
      resourceId: chart._id,
      resourceLabel: `${chart.icao} ${chart.chartType} ${chart.chartName}`,
      targetClerkId: chart.uploadedBy,
      metadata: {
        icao: chart.icao,
        chartType: chart.chartType,
        chartName: chart.chartName,
      },
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
    actorClerkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, { actorClerkId: args.actorClerkId });
    const chart = await ctx.db.get(args.id);
    if (!chart) return null;

    await ctx.db.patch(args.id, {
      icao: args.icao.toUpperCase(),
      chartType: args.chartType,
      chartName: args.chartName,
    });

    await logAdminTelemetry(ctx, {
      actorClerkId: actor.clerkId,
      action: "edit",
      resourceType: "airport_chart",
      resourceId: chart._id,
      resourceLabel: `${args.icao.toUpperCase()} ${args.chartType} ${args.chartName}`,
      targetClerkId: chart.uploadedBy,
      metadata: {
        before: {
          icao: chart.icao,
          chartType: chart.chartType,
          chartName: chart.chartName,
        },
        after: {
          icao: args.icao.toUpperCase(),
          chartType: args.chartType,
          chartName: args.chartName,
        },
      },
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
  args: {
    id: v.id("airportCharts"),
    actorClerkId: v.optional(v.string()),
    action: v.optional(v.union(v.literal("reject"), v.literal("delete"))),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, { actorClerkId: args.actorClerkId });
    const chart = await ctx.db.get(args.id);
    if (!chart) return;

    await ctx.db.delete(args.id);

    await logAdminTelemetry(ctx, {
      actorClerkId: actor.clerkId,
      action: args.action ?? "delete",
      resourceType: "airport_chart",
      resourceId: chart._id,
      resourceLabel: `${chart.icao} ${chart.chartType} ${chart.chartName}`,
      targetClerkId: chart.uploadedBy,
      metadata: {
        icao: chart.icao,
        chartType: chart.chartType,
        chartName: chart.chartName,
        wasApproved: chart.isApproved,
        reason: args.reason,
      },
    });
  },
});

// Bulk approve airport charts
export const bulkApprove = mutation({
  args: {
    ids: v.array(v.id("airportCharts")),
    approvedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, { actorClerkId: args.approvedBy });
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
        approvedBy: actor.clerkId,
        approvedAt: now,
      });

      await logAdminTelemetry(ctx, {
        actorClerkId: actor.clerkId,
        action: "approve",
        resourceType: "airport_chart",
        resourceId: chart._id,
        resourceLabel: `${chart.icao} ${chart.chartType} ${chart.chartName}`,
        targetClerkId: chart.uploadedBy,
        metadata: {
          icao: chart.icao,
          chartType: chart.chartType,
          chartName: chart.chartName,
          bulk: true,
        },
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
    actorClerkId: v.optional(v.string()),
    action: v.optional(v.union(v.literal("reject"), v.literal("delete"))),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, { actorClerkId: args.actorClerkId });
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
      await logAdminTelemetry(ctx, {
        actorClerkId: actor.clerkId,
        action: args.action ?? "delete",
        resourceType: "airport_chart",
        resourceId: chart._id,
        resourceLabel: `${chart.icao} ${chart.chartType} ${chart.chartName}`,
        targetClerkId: chart.uploadedBy,
        metadata: {
          icao: chart.icao,
          chartType: chart.chartType,
          chartName: chart.chartName,
          wasApproved: chart.isApproved,
          bulk: true,
          reason: args.reason,
        },
      });
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
          q.eq(q.field("isApproved"), false),
        ),
      )
      .first();

    return {
      pendingByUserExists: pendingByUser !== null,
    };
  },
});
