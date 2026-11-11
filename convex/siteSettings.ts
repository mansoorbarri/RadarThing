import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { hasEffectiveProAccess } from "../src/lib/proAccess";
import {
  DEFAULT_EVENT_LIVE,
  getFlightStartAccess as decideFlightStartAccess,
} from "../src/lib/flightAccess";

async function readFlightAccessSetting(ctx: QueryCtx) {
  return await ctx.db
    .query("siteSettings")
    .withIndex("by_key", (q) => q.eq("key", "flightAccess"))
    .first();
}

export const getEventLive = query({
  args: {},
  handler: async (ctx) => {
    const setting = await readFlightAccessSetting(ctx);
    return {
      eventLive: setting?.eventLive ?? DEFAULT_EVENT_LIVE,
      updatedAt: setting?.updatedAt ?? null,
    };
  },
});

export const setEventLive = mutation({
  args: { eventLive: v.boolean() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const existing = await readFlightAccessSetting(ctx);
    const value = {
      eventLive: args.eventLive,
      updatedAt: Date.now(),
      updatedBy: admin._id,
    };
    if (existing) {
      await ctx.db.patch(existing._id, value);
    } else {
      await ctx.db.insert("siteSettings", { key: "flightAccess", ...value });
    }
    return { eventLive: args.eventLive };
  },
});

// Asked by the userscript (via /api/userscript/flight-access) before it starts
// a new flight. Returns only a yes/no plus the event state, so it can't be used
// to look up whether some other pilot has Pro.
export const getFlightStartAccess = query({
  args: { googleId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const setting = await readFlightAccessSetting(ctx);
    const eventLive = setting?.eventLive ?? DEFAULT_EVENT_LIVE;
    const googleId = args.googleId?.trim();
    const user = googleId
      ? await ctx.db
          .query("users")
          .withIndex("by_googleId", (q) => q.eq("googleId", googleId))
          .first()
      : null;
    const access = decideFlightStartAccess(
      eventLive,
      hasEffectiveProAccess(user),
    );
    return { allowed: access.allowed, eventLive };
  },
});
