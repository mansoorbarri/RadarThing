import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

import { requireAuthenticatedClerkId, requireSystem } from "./lib/auth";

type ReminderStatus = Doc<"waypointReminders">["status"];

function normalizeIdent(value: string): string {
  return value.trim().toUpperCase();
}

export const create = mutation({
  args: {
    userId: v.id("users"),
    googleId: v.string(),
    discordUsername: v.string(),
    discordUserId: v.string(),
    callsign: v.string(),
    waypointIdent: v.string(),
    intervalSeconds: v.number(),
    durationSeconds: v.number(),
    systemSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.isDeleted || user.activeBanId)
      throw new Error("Account access restricted");
    if (args.systemSecret) requireSystem(ctx, args.systemSecret);
    else await requireAuthenticatedClerkId(ctx, user.clerkId);
    const now = Date.now();

    return await ctx.db.insert("waypointReminders", {
      userId: args.userId,
      googleId: args.googleId,
      discordUsername: args.discordUsername.trim(),
      discordUserId: args.discordUserId.trim(),
      callsign: normalizeIdent(args.callsign),
      waypointIdent: normalizeIdent(args.waypointIdent),
      intervalSeconds: args.intervalSeconds,
      durationSeconds: args.durationSeconds,
      status: "armed",
      createdAt: now,
    });
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const armed = await ctx.db
      .query("waypointReminders")
      .withIndex("by_status", (q) => q.eq("status", "armed"))
      .collect();
    const active = await ctx.db
      .query("waypointReminders")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const eligible = [];
    for (const reminder of [...armed, ...active]) {
      const user = await ctx.db.get(reminder.userId);
      if (user && !user.isDeleted && !user.activeBanId) eligible.push(reminder);
    }
    return eligible.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const getById = query({
  args: { id: v.id("waypointReminders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const markTriggered = mutation({
  args: {
    id: v.id("waypointReminders"),
    systemSecret: v.optional(v.string()),
    triggeredAt: v.number(),
  },
  handler: async (ctx, args) => {
    requireSystem(ctx, args.systemSecret);
    const reminder = await ctx.db.get(args.id);
    if (reminder?.status !== "armed") return null;

    await ctx.db.patch(args.id, {
      status: "active",
      triggeredAt: args.triggeredAt,
      expiresAt: args.triggeredAt + reminder.durationSeconds * 1000,
    });

    return await ctx.db.get(args.id);
  },
});

export const markSent = mutation({
  args: {
    id: v.id("waypointReminders"),
    systemSecret: v.optional(v.string()),
    sentAt: v.number(),
  },
  handler: async (ctx, args) => {
    requireSystem(ctx, args.systemSecret);
    const reminder = await ctx.db.get(args.id);
    if (!reminder) return null;

    await ctx.db.patch(args.id, {
      lastSentAt: args.sentAt,
    });

    return await ctx.db.get(args.id);
  },
});

export const markStatus = mutation({
  args: {
    id: v.id("waypointReminders"),
    systemSecret: v.optional(v.string()),
    status: v.union(
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("failed"),
    ),
    failureReason: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireSystem(ctx, args.systemSecret);
    const reminder = await ctx.db.get(args.id);
    if (!reminder) return null;

    const nextStatus: ReminderStatus = args.status;
    await ctx.db.patch(args.id, {
      status: nextStatus,
      completedAt: args.completedAt,
      failureReason: args.failureReason,
    });

    return await ctx.db.get(args.id);
  },
});

export const cancelForUser = mutation({
  args: {
    userId: v.id("users"),
    callsign: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    await requireAuthenticatedClerkId(ctx, user.clerkId);
    const reminders = await ctx.db
      .query("waypointReminders")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const normalizedCallsign = args.callsign?.trim()
      ? normalizeIdent(args.callsign)
      : null;
    const now = Date.now();
    const activeStatuses = new Set(["armed", "active"]);

    const matching = reminders.filter(
      (reminder) =>
        activeStatuses.has(reminder.status) &&
        (!normalizedCallsign || reminder.callsign === normalizedCallsign),
    );

    for (const reminder of matching) {
      await ctx.db.patch(reminder._id, {
        status: "cancelled",
        completedAt: now,
      });
    }

    return matching.length;
  },
});
