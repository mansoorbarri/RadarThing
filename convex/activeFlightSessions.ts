import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireSystem } from "./lib/auth";

const persistedSessionValidator = v.object({
  userId: v.id("users"),
  state: v.union(v.literal("active"), v.literal("disconnected")),
  originalId: v.string(),
  session: v.any(),
  disconnectedAt: v.optional(v.number()),
});

export const list = query({
  args: {
    systemSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireSystem(ctx, args.systemSecret);

    return await ctx.db.query("activeFlightSessions").collect();
  },
});

export const replaceAll = mutation({
  args: {
    sessions: v.array(persistedSessionValidator),
    systemSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireSystem(ctx, args.systemSecret);

    const now = Date.now();
    const seenUserIds = new Set(args.sessions.map((session) => session.userId));
    const existing = await ctx.db.query("activeFlightSessions").collect();

    for (const persisted of existing) {
      if (!seenUserIds.has(persisted.userId)) {
        await ctx.db.delete(persisted._id);
      }
    }

    for (const session of args.sessions) {
      const existingForUser = existing.find(
        (persisted) => persisted.userId === session.userId,
      );
      const value = {
        userId: session.userId,
        state: session.state,
        originalId: session.originalId,
        session: session.session,
        disconnectedAt: session.disconnectedAt,
        updatedAt: now,
      };

      if (existingForUser) {
        await ctx.db.patch(existingForUser._id, value);
      } else {
        await ctx.db.insert("activeFlightSessions", value);
      }
    }

    return {
      saved: args.sessions.length,
      deleted: existing.filter((persisted) => !seenUserIds.has(persisted.userId))
        .length,
    };
  },
});

export const clear = mutation({
  args: {
    userIds: v.optional(v.array(v.id("users"))),
    systemSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireSystem(ctx, args.systemSecret);

    const sessions = await ctx.db.query("activeFlightSessions").collect();
    const targetUserIds = args.userIds ? new Set(args.userIds) : null;
    let deleted = 0;

    for (const session of sessions) {
      if (!targetUserIds || targetUserIds.has(session.userId)) {
        await ctx.db.delete(session._id);
        deleted++;
      }
    }

    return { deleted };
  },
});
