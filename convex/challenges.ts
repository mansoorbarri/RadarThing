import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { icaoMatchesPrefixes } from "./lib/icaoRegions";
import type { Doc, Id } from "./_generated/dataModel";

// ============================================
// QUERIES
// ============================================

// Get all active challenges within current time window
export const getActive = query({
  handler: async (ctx) => {
    const now = Date.now();
    const challenges = await ctx.db
      .query("challenges")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    return challenges.filter((c) => c.startDate <= now && c.endDate >= now);
  },
});

// Get all challenges (for admin)
export const getAll = query({
  handler: async (ctx) => {
    return await ctx.db.query("challenges").order("desc").collect();
  },
});

// Get single challenge with first completer info
export const getById = query({
  args: { id: v.id("challenges") },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.id);
    if (!challenge) return null;

    let firstCompleter = null;
    if (challenge.firstCompletedBy) {
      const user = await ctx.db.get(challenge.firstCompletedBy);
      if (user) {
        const stats = await ctx.db
          .query("userStats")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .first();
        firstCompleter = {
          userId: user._id,
          callsign: stats?.lastFlightCallsign ?? "Unknown",
          completedAt: challenge.firstCompletedAt,
        };
      }
    }

    return { ...challenge, firstCompleter };
  },
});

// Get user's progress on all active challenges
export const getProgressForUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const activeChallenges = await ctx.db
      .query("challenges")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const current = activeChallenges.filter(
      (c) => c.startDate <= now && c.endDate >= now,
    );

    const results = [];
    for (const challenge of current) {
      const progress = await ctx.db
        .query("challengeProgress")
        .withIndex("by_challengeId_userId", (q) =>
          q.eq("challengeId", challenge._id).eq("userId", args.userId),
        )
        .first();

      // Get top 3 completers sorted by completedAt
      const allCompletions = await ctx.db
        .query("challengeProgress")
        .withIndex("by_challengeId_isCompleted", (q) =>
          q.eq("challengeId", challenge._id).eq("isCompleted", true),
        )
        .collect();

      const sorted = allCompletions
        .filter((c) => c.completedAt !== undefined)
        .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))
        .slice(0, 3);

      const topCompleters = [];
      for (const completion of sorted) {
        const user = await ctx.db.get(completion.userId);
        if (!user) continue;
        const stats = await ctx.db
          .query("userStats")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .first();
        topCompleters.push({
          userId: user._id,
          callsign: stats?.lastFlightCallsign ?? "Unknown",
          completedAt: completion.completedAt,
        });
      }

      results.push({
        challenge,
        progress: progress ?? null,
        topCompleters,
      });
    }

    return results;
  },
});

// Get all completions for a challenge
export const getCompletions = query({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    const completions = await ctx.db
      .query("challengeProgress")
      .withIndex("by_challengeId_isCompleted", (q) =>
        q.eq("challengeId", args.challengeId).eq("isCompleted", true),
      )
      .collect();

    const results = [];
    for (const completion of completions) {
      const user = await ctx.db.get(completion.userId);
      if (!user) continue;
      const stats = await ctx.db
        .query("userStats")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .first();
      results.push({
        ...completion,
        callsign: stats?.lastFlightCallsign ?? "Unknown",
      });
    }

    return results;
  },
});

// ============================================
// MUTATIONS
// ============================================

// Admin creates a challenge
export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    type: v.union(v.literal("weekly"), v.literal("monthly")),
    startDate: v.number(),
    endDate: v.number(),
    criteria: v.object({
      minFlights: v.optional(v.number()),
      regions: v.optional(v.array(v.string())),
      uniqueAirports: v.optional(v.number()),
      specificAirports: v.optional(v.array(v.string())),
      minAvgDurationMs: v.optional(v.number()),
      minTotalDurationMs: v.optional(v.number()),
      minSingleDurationMs: v.optional(v.number()),
      minTotalDistanceNm: v.optional(v.number()),
      minSingleDistanceNm: v.optional(v.number()),
      aircraftTypes: v.optional(v.array(v.string())),
      minMaxAltitude: v.optional(v.number()),
    }),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("challenges", {
      title: args.title,
      description: args.description,
      type: args.type,
      startDate: args.startDate,
      endDate: args.endDate,
      criteria: args.criteria,
      isActive: true,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
  },
});

// Admin updates a challenge
export const update = mutation({
  args: {
    id: v.id("challenges"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(v.union(v.literal("weekly"), v.literal("monthly"))),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    criteria: v.optional(
      v.object({
        minFlights: v.optional(v.number()),
        regions: v.optional(v.array(v.string())),
        uniqueAirports: v.optional(v.number()),
        specificAirports: v.optional(v.array(v.string())),
        minAvgDurationMs: v.optional(v.number()),
        minTotalDurationMs: v.optional(v.number()),
        minSingleDurationMs: v.optional(v.number()),
        minTotalDistanceNm: v.optional(v.number()),
        minSingleDistanceNm: v.optional(v.number()),
        aircraftTypes: v.optional(v.array(v.string())),
        minMaxAltitude: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }
    await ctx.db.patch(id, updates);
  },
});

// Admin toggles active state
export const deactivate = mutation({
  args: {
    id: v.id("challenges"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: args.isActive });
  },
});

// ============================================
// INTERNAL MUTATIONS
// ============================================

// Check if a single flight qualifies for a challenge
function flightQualifies(
  flight: Doc<"flights">,
  challenge: Doc<"challenges">,
  distanceNm: number,
): boolean {
  const { criteria } = challenge;

  // Check region filter (dep or arr must match)
  if (criteria.regions && criteria.regions.length > 0) {
    const depMatches =
      flight.depICAO && icaoMatchesPrefixes(flight.depICAO, criteria.regions);
    const arrMatches =
      flight.arrICAO && icaoMatchesPrefixes(flight.arrICAO, criteria.regions);
    if (!depMatches && !arrMatches) return false;
  }

  // Check aircraft type filter
  if (criteria.aircraftTypes && criteria.aircraftTypes.length > 0) {
    if (!criteria.aircraftTypes.includes(flight.aircraftType)) return false;
  }

  // Check minimum single flight duration
  if (criteria.minSingleDurationMs !== undefined) {
    const duration =
      flight.endTime !== undefined
        ? Math.max(0, flight.endTime - flight.startTime)
        : 0;
    if (duration < criteria.minSingleDurationMs) return false;
  }

  // Check minimum single flight distance
  if (criteria.minSingleDistanceNm !== undefined) {
    if (distanceNm < criteria.minSingleDistanceNm) return false;
  }

  // Check minimum max altitude
  if (criteria.minMaxAltitude !== undefined) {
    if (!flight.maxAltitude || flight.maxAltitude < criteria.minMaxAltitude)
      return false;
  }

  // Flight must be within the challenge time window
  if (
    flight.startTime < challenge.startDate ||
    flight.startTime > challenge.endDate
  ) {
    return false;
  }

  return true;
}

// Check if accumulated progress meets all criteria thresholds
function checkCompletion(
  progress: {
    qualifyingFlightCount: number;
    uniqueAirportsVisited: string[];
    totalDurationMs: number;
    totalDistanceNm: number;
  },
  criteria: Doc<"challenges">["criteria"],
): boolean {
  if (
    criteria.minFlights !== undefined &&
    progress.qualifyingFlightCount < criteria.minFlights
  )
    return false;

  if (
    criteria.uniqueAirports !== undefined &&
    progress.uniqueAirportsVisited.length < criteria.uniqueAirports
  )
    return false;

  if (criteria.specificAirports && criteria.specificAirports.length > 0) {
    const visited = new Set(progress.uniqueAirportsVisited);
    if (!criteria.specificAirports.every((a) => visited.has(a))) return false;
  }

  if (
    criteria.minTotalDurationMs !== undefined &&
    progress.totalDurationMs < criteria.minTotalDurationMs
  )
    return false;

  if (
    criteria.minTotalDistanceNm !== undefined &&
    progress.totalDistanceNm < criteria.minTotalDistanceNm
  )
    return false;

  if (
    criteria.minAvgDurationMs !== undefined &&
    progress.qualifyingFlightCount > 0
  ) {
    const avg = progress.totalDurationMs / progress.qualifyingFlightCount;
    if (avg < criteria.minAvgDurationMs) return false;
  }

  return true;
}

// Evaluate a new flight against all active challenges
export const evaluateFlightForChallenges = internalMutation({
  args: {
    userId: v.id("users"),
    flightId: v.id("flights"),
  },
  handler: async (ctx, args) => {
    const flight = await ctx.db.get(args.flightId);
    if (!flight) return;

    const now = Date.now();
    const activeChallenges = await ctx.db
      .query("challenges")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const currentChallenges = activeChallenges.filter(
      (c) => c.startDate <= now && c.endDate >= now,
    );

    // Calculate flight distance
    const distanceNm = calculateRouteDistanceNm(flight.routeData);

    for (const challenge of currentChallenges) {
      if (!flightQualifies(flight, challenge, distanceNm)) continue;

      // Get or create progress
      const existing = await ctx.db
        .query("challengeProgress")
        .withIndex("by_challengeId_userId", (q) =>
          q
            .eq("challengeId", challenge._id)
            .eq("userId", args.userId),
        )
        .first();

      if (existing?.isCompleted) continue; // Already completed

      // Collect airports from this flight
      const newAirports: string[] = [];
      if (flight.depICAO) newAirports.push(flight.depICAO);
      if (flight.arrICAO) newAirports.push(flight.arrICAO);

      const flightDuration =
        flight.endTime !== undefined
          ? Math.max(0, flight.endTime - flight.startTime)
          : 0;

      if (existing) {
        // Check for duplicate flight
        if (
          existing.qualifyingFlightIds.includes(
            args.flightId as Id<"flights">,
          )
        )
          continue;

        const updatedFlightIds = [
          ...existing.qualifyingFlightIds,
          args.flightId,
        ];
        const uniqueAirports = Array.from(
          new Set([...existing.uniqueAirportsVisited, ...newAirports]),
        );
        const updatedProgress = {
          qualifyingFlightIds: updatedFlightIds,
          qualifyingFlightCount: updatedFlightIds.length,
          uniqueAirportsVisited: uniqueAirports,
          totalDurationMs: existing.totalDurationMs + flightDuration,
          totalDistanceNm: existing.totalDistanceNm + distanceNm,
        };

        const completed = checkCompletion(updatedProgress, challenge.criteria);

        await ctx.db.patch(existing._id, {
          ...updatedProgress,
          isCompleted: completed,
          completedAt: completed ? Date.now() : undefined,
        });

        // Set first completer if applicable
        if (completed && !challenge.firstCompletedBy) {
          await ctx.db.patch(challenge._id, {
            firstCompletedBy: args.userId,
            firstCompletedAt: Date.now(),
          });
        }
      } else {
        const uniqueAirports = Array.from(new Set(newAirports));
        const newProgress = {
          qualifyingFlightIds: [args.flightId],
          qualifyingFlightCount: 1,
          uniqueAirportsVisited: uniqueAirports,
          totalDurationMs: flightDuration,
          totalDistanceNm: distanceNm,
        };

        const completed = checkCompletion(newProgress, challenge.criteria);

        await ctx.db.insert("challengeProgress", {
          challengeId: challenge._id,
          userId: args.userId,
          ...newProgress,
          isCompleted: completed,
          completedAt: completed ? Date.now() : undefined,
        });

        if (completed && !challenge.firstCompletedBy) {
          await ctx.db.patch(challenge._id, {
            firstCompletedBy: args.userId,
            firstCompletedAt: Date.now(),
          });
        }
      }
    }
  },
});

// Auto-deactivate expired challenges
export const deactivateExpired = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const active = await ctx.db
      .query("challenges")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    for (const challenge of active) {
      if (challenge.endDate < now) {
        await ctx.db.patch(challenge._id, { isActive: false });
      }
    }
  },
});

// ============================================
// HELPERS (duplicated from flights.ts for use in Convex runtime)
// ============================================

function isCoordinatePair(point: unknown): point is [number, number] {
  return (
    Array.isArray(point) &&
    point.length >= 2 &&
    typeof point[0] === "number" &&
    Number.isFinite(point[0]) &&
    typeof point[1] === "number" &&
    Number.isFinite(point[1])
  );
}

function calculateRouteDistanceNm(routeData: unknown): number {
  if (!Array.isArray(routeData)) return 0;
  let totalDistanceNm = 0;
  for (let i = 1; i < routeData.length; i++) {
    const prev = routeData[i - 1];
    const curr = routeData[i];
    if (!isCoordinatePair(prev) || !isCoordinatePair(curr)) continue;
    totalDistanceNm += haversineDistance(prev[0], prev[1], curr[0], curr[1]);
  }
  return totalDistanceNm;
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3440.065;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
