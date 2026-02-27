import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

export const startTracking = mutation({
  args: {
    clerkId: v.string(),
    callsigns: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const callsigns = Array.from(
      new Set(
        args.callsigns.map((callsign) => callsign.trim()).filter(Boolean),
      ),
    );

    // Replace any existing tracking entries for this user with the current selection.
    const existing = await ctx.db
      .query("activeTrackers")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .collect();

    for (const entry of existing) {
      await ctx.db.delete(entry._id);
    }

    for (const callsign of callsigns) {
      await ctx.db.insert("activeTrackers", {
        clerkId: args.clerkId,
        callsign,
        lastSeen: Date.now(),
      });
    }
  },
});

export const stopTracking = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("activeTrackers")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .collect();

    for (const entry of existing) {
      await ctx.db.delete(entry._id);
    }
  },
});

export const heartbeat = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("activeTrackers")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .collect();

    const now = Date.now();
    for (const entry of existing) {
      await ctx.db.patch(entry._id, { lastSeen: now });
    }
  },
});

export const getMostTracked = query({
  handler: async (ctx) => {
    const allTrackers = await ctx.db.query("activeTrackers").collect();

    // Aggregate by callsign
    const counts = new Map<string, number>();
    for (const tracker of allTrackers) {
      counts.set(tracker.callsign, (counts.get(tracker.callsign) ?? 0) + 1);
    }

    // Sort by count descending, take top 10
    return Array.from(counts.entries())
      .map(([callsign, count]) => ({ callsign, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  },
});

export const cleanupStale = internalMutation({
  handler: async (ctx) => {
    const threeMinutesAgo = Date.now() - 3 * 60 * 1000;

    const stale = await ctx.db
      .query("activeTrackers")
      .withIndex("by_lastSeen", (q) => q.lt("lastSeen", threeMinutesAgo))
      .collect();

    for (const entry of stale) {
      await ctx.db.delete(entry._id);
    }
  },
});
