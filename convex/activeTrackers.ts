import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  type QueryCtx,
} from "./_generated/server";

import { requireAuthenticatedClerkId } from "./lib/auth";

const MIN_TRACKERS_FOR_MOST_TRACKED = 3;
// Clients heartbeat every 2 minutes; allow one missed beat.
const STALE_TRACKER_MS = 5 * 60 * 1000;
// Matches the userscript tracking-status route; keeps the summary document
// small no matter what clients send.
const MAX_CALLSIGN_LENGTH = 32;
// A single tracker (one viewer) only follows a handful of callsigns; cap it so
// one row can't spam the ranking across many callsigns.
const MAX_TRACKED_CALLSIGNS = 25;
// Anonymous tracker IDs are unauthenticated and freely forgeable (any number of
// anon:<uuid> values). Cap how many anonymous trackers count toward a single
// callsign so a flood of forged anon IDs can't push a callsign to "most
// tracked"; reaching the threshold requires real authenticated viewers.
const MAX_ANON_COUNT_PER_CALLSIGN = MIN_TRACKERS_FOR_MOST_TRACKED - 1;

function isAnonymousTracker(clerkId: string): boolean {
  // Case-insensitive to match ANONYMOUS_TRACKER_ID (which carries the `i`
  // flag). Otherwise requireTrackerAccess would admit an `ANON:` id without
  // auth while this classified it as an authenticated viewer, letting it skip
  // the anonymous-contribution cap.
  return /^anon:/i.test(clerkId);
}
const ANONYMOUS_TRACKER_ID =
  /^anon:(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z0-9]+:[a-z0-9]+)$/i;

async function requireTrackerAccess(
  ctx: Parameters<typeof requireAuthenticatedClerkId>[0],
  trackerId: string,
) {
  if (ANONYMOUS_TRACKER_ID.test(trackerId)) {
    // Anonymous visitors have a random, browser-persisted tracker ID.
    // Still enforce account restrictions if an authenticated user sends one.
    if (await ctx.auth.getUserIdentity()) {
      await requireAuthenticatedClerkId(ctx);
    }
    return;
  }

  await requireAuthenticatedClerkId(ctx, trackerId);
}

function getRankedTrackerCounts(
  trackers: { callsign: string; clerkId: string }[],
): { callsign: string; count: number }[] {
  // Count distinct viewers (by clerkId) per normalized callsign, so duplicate
  // or case-variant rows from one viewer (e.g. ABC / Abc / abc) can't inflate
  // a callsign's tally above that viewer's single real vote.
  const authedViewers = new Map<string, Set<string>>();
  const anonViewers = new Map<string, Set<string>>();
  for (const tracker of trackers) {
    const callsign = tracker.callsign.trim().toUpperCase();
    if (!callsign) continue;
    const viewers = isAnonymousTracker(tracker.clerkId)
      ? anonViewers
      : authedViewers;
    let set = viewers.get(callsign);
    if (!set) {
      set = new Set<string>();
      viewers.set(callsign, set);
    }
    set.add(tracker.clerkId);
  }

  const callsigns = new Set([...authedViewers.keys(), ...anonViewers.keys()]);
  return Array.from(callsigns)
    .map((callsign) => ({
      callsign,
      count:
        (authedViewers.get(callsign)?.size ?? 0) +
        Math.min(
          anonViewers.get(callsign)?.size ?? 0,
          MAX_ANON_COUNT_PER_CALLSIGN,
        ),
    }))
    .sort((a, b) => b.count - a.count || a.callsign.localeCompare(b.callsign));
}

export const startTracking = mutation({
  args: {
    clerkId: v.string(),
    callsigns: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireTrackerAccess(ctx, args.clerkId);
    const callsigns = Array.from(
      new Set(
        args.callsigns
          .map((callsign) => callsign.trim().toUpperCase())
          .filter(
            (callsign) => callsign && callsign.length <= MAX_CALLSIGN_LENGTH,
          ),
      ),
    ).slice(0, MAX_TRACKED_CALLSIGNS);

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
    await requireTrackerAccess(ctx, args.clerkId);
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
    await requireTrackerAccess(ctx, args.clerkId);
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

async function getRanked(ctx: QueryCtx) {
  const summary = await ctx.db.query("activeTrackerSummary").first();
  return summary?.ranked ?? [];
}

export const getMostTracked = query({
  handler: async (ctx) => {
    return (await getRanked(ctx)).slice(0, 10);
  },
});

export const getTrackingStatus = query({
  args: { callsign: v.string() },
  handler: async (ctx, args) => {
    const callsign = args.callsign.trim().toUpperCase();
    if (!callsign) {
      return { isMostTracked: false, count: 0 };
    }

    const ranked = await getRanked(ctx);
    const count =
      ranked.find((entry) => entry.callsign === callsign)?.count ?? 0;
    const leadingCount = ranked[0]?.count ?? 0;

    return {
      isMostTracked:
        count >= MIN_TRACKERS_FOR_MOST_TRACKED && count === leadingCount,
      count,
    };
  },
});

// Drops stale trackers and rewrites the summary only when the ranking changed,
// so subscribed viewers re-run at most once per cron tick.
export const refreshSummary = internalMutation({
  handler: async (ctx) => {
    const staleBefore = Date.now() - STALE_TRACKER_MS;

    const stale = await ctx.db
      .query("activeTrackers")
      .withIndex("by_lastSeen", (q) => q.lt("lastSeen", staleBefore))
      .collect();

    for (const entry of stale) {
      await ctx.db.delete(entry._id);
    }

    const trackers = await ctx.db.query("activeTrackers").collect();
    const ranked = getRankedTrackerCounts(trackers);
    const summary = await ctx.db.query("activeTrackerSummary").first();

    if (!summary) {
      await ctx.db.insert("activeTrackerSummary", {
        ranked,
        updatedAt: Date.now(),
      });
    } else if (JSON.stringify(summary.ranked) !== JSON.stringify(ranked)) {
      await ctx.db.patch(summary._id, { ranked, updatedAt: Date.now() });
    }
  },
});
