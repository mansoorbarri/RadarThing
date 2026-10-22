import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireSystem } from "./lib/auth";
import { recordLiveSample } from "./lib/telemetry";
import { deleteRouteChunks, readRouteCoords } from "./lib/activeFlightRoutes";

// `route` carries only the coords added since the last checkpoint
// (startIndex > 0), or the whole route under a new version (startIndex 0).
// Callers that omit it keep their coords inside `session`.
const persistedSessionValidator = v.object({
  userId: v.id("users"),
  state: v.union(v.literal("active"), v.literal("disconnected")),
  originalId: v.string(),
  session: v.any(),
  disconnectedAt: v.optional(v.number()),
  route: v.optional(
    v.object({
      version: v.string(),
      startIndex: v.number(),
      coords: v.array(v.any()),
    }),
  ),
});
export const list = query({
  args: {
    limit: v.optional(v.number()),
    systemSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireSystem(ctx, args.systemSecret);

    return await ctx.db
      .query("activeFlightSessions")
      .withIndex("by_updatedAt")
      .take(Math.min(Math.max(args.limit ?? 1000, 1), 5000));
  },
});

export const getRoute = query({
  args: {
    userId: v.id("users"),
    systemSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireSystem(ctx, args.systemSecret);

    const persisted = await ctx.db
      .query("activeFlightSessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (!persisted?.routeVersion) return null;

    return await readRouteCoords(ctx, args.userId, persisted.routeVersion);
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
    const eligible = [];
    for (const session of args.sessions) {
      const user = await ctx.db.get(session.userId);
      if (user && !user.isDeleted && !user.activeBanId) eligible.push(session);
    }
    const sessionsByUserId = new Map(
      eligible.map((session) => [session.userId, session]),
    );
    const seenUserIds = new Set(sessionsByUserId.keys());
    const existing = await ctx.db.query("activeFlightSessions").collect();
    const existingByUserId = new Map(
      existing.map((persisted) => [persisted.userId, persisted]),
    );
    let deleted = 0;
    // Appends that don't line up with the stored route; the caller must
    // resend these routes in full.
    const resync: Id<"users">[] = [];

    for (const persisted of existing) {
      if (!seenUserIds.has(persisted.userId)) {
        await ctx.db.delete(persisted._id);
        await deleteRouteChunks(ctx, persisted.userId);
        existingByUserId.delete(persisted.userId);
        deleted++;
      }
    }

    for (const session of sessionsByUserId.values()) {
      const existingForUser = existingByUserId.get(session.userId);
      const value: {
        userId: Id<"users">;
        state: "active" | "disconnected";
        originalId: string;
        session: unknown;
        disconnectedAt?: number;
        updatedAt: number;
        routeVersion?: string;
        routePointCount?: number;
      } = {
        userId: session.userId,
        state: session.state,
        originalId: session.originalId,
        session: session.session,
        disconnectedAt: session.disconnectedAt,
        updatedAt: now,
      };

      const route = session.route;
      if (!route) {
        if (existingForUser?.routeVersion) {
          await deleteRouteChunks(ctx, session.userId);
        }
        value.routeVersion = undefined;
        value.routePointCount = undefined;
      } else if (route.startIndex === 0) {
        if (existingForUser?.routeVersion) {
          await deleteRouteChunks(ctx, session.userId);
        }
        if (route.coords.length > 0) {
          await ctx.db.insert("activeFlightRouteChunks", {
            userId: session.userId,
            routeVersion: route.version,
            startIndex: 0,
            coords: route.coords,
          });
        }
        value.routeVersion = route.version;
        value.routePointCount = route.coords.length;
      } else if (
        existingForUser?.routeVersion === route.version &&
        existingForUser.routePointCount === route.startIndex
      ) {
        if (route.coords.length > 0) {
          await ctx.db.insert("activeFlightRouteChunks", {
            userId: session.userId,
            routeVersion: route.version,
            startIndex: route.startIndex,
            coords: route.coords,
          });
        }
        value.routeVersion = route.version;
        value.routePointCount = route.startIndex + route.coords.length;
      } else {
        // Leave the stored route as-is until the full resend arrives.
        resync.push(session.userId);
      }

      if (existingForUser) {
        await ctx.db.patch(existingForUser._id, value);
      } else {
        await ctx.db.insert("activeFlightSessions", value);
      }
    }

    let liveFlights = 0;
    for (const session of sessionsByUserId.values()) {
      if (session.state === "active") liveFlights++;
    }
    await recordLiveSample(ctx, liveFlights, now);

    return {
      saved: sessionsByUserId.size,
      deleted,
      resync,
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

    const targetUserIds = args.userIds
      ? Array.from(new Set(args.userIds))
      : null;
    const sessions = targetUserIds
      ? (
          await Promise.all(
            targetUserIds.map((userId) =>
              ctx.db
                .query("activeFlightSessions")
                .withIndex("by_userId", (q) => q.eq("userId", userId))
                .collect(),
            ),
          )
        ).flat()
      : await ctx.db.query("activeFlightSessions").collect();
    let deleted = 0;

    for (const session of sessions) {
      await ctx.db.delete(session._id);
      await deleteRouteChunks(ctx, session.userId);
      deleted++;
    }

    return { deleted };
  },
});
