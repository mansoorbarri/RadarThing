import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getCurrentUser, requireSystem } from "./lib/auth";
import { DAY_MS, utcDayKey } from "./lib/telemetry";
import {
  FREE_DAILY_ALLOWANCE,
  applyFreeAllowance,
} from "../src/lib/freeAllowance";

const featureValidator = v.literal("charts");

// Called by trusted API routes before serving a metered resource to a FREE user.
export const consumeFreeAllowance = mutation({
  args: {
    clerkId: v.string(),
    feature: featureValidator,
    key: v.string(),
    systemSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireSystem(ctx, args.systemSecret);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user || user.isDeleted || user.activeBanId) {
      return {
        allowed: false,
        used: 0,
        limit: 0,
        accountIssue: user ? ("restricted" as const) : ("missing" as const),
      };
    }

    const dayKey = utcDayKey(Date.now());
    const limit = FREE_DAILY_ALLOWANCE[args.feature];
    const existing = await ctx.db
      .query("freeUsage")
      .withIndex("by_user_feature_day", (q) =>
        q
          .eq("userId", user._id)
          .eq("feature", args.feature)
          .eq("dayKey", dayKey),
      )
      .first();

    const result = applyFreeAllowance(
      existing?.keys ?? [],
      args.key.toUpperCase(),
      limit,
    );
    if (result.allowed && result.keys.length !== (existing?.keys.length ?? 0)) {
      if (existing) {
        await ctx.db.patch(existing._id, { keys: result.keys });
      } else {
        await ctx.db.insert("freeUsage", {
          userId: user._id,
          feature: args.feature,
          dayKey,
          keys: result.keys,
        });
      }
    }

    return { allowed: result.allowed, used: result.used, limit };
  },
});

export const getMyFreeAllowance = query({
  args: { feature: featureValidator },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const limit = FREE_DAILY_ALLOWANCE[args.feature];
    if (!user) return { used: 0, limit, keys: [] as string[] };

    const usage = await ctx.db
      .query("freeUsage")
      .withIndex("by_user_feature_day", (q) =>
        q
          .eq("userId", user._id)
          .eq("feature", args.feature)
          .eq("dayKey", utcDayKey(Date.now())),
      )
      .first();
    const keys = usage?.keys ?? [];
    return { used: keys.length, limit, keys };
  },
});

// Only today's row is ever read, so older days can be dropped.
const FREE_USAGE_RETENTION_DAYS = 3;

export const pruneOldFreeUsage = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = utcDayKey(Date.now() - FREE_USAGE_RETENTION_DAYS * DAY_MS);
    const stale = await ctx.db
      .query("freeUsage")
      .withIndex("by_dayKey", (q) => q.lt("dayKey", cutoff))
      .take(500);
    for (const doc of stale) await ctx.db.delete(doc._id);
  },
});
