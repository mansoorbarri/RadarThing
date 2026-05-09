import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { autoCompleteChallengesForFlight } from "./challenges";
import { calculateRouteDistanceNm } from "./lib/challengeRules";
import { isFlightModeratorGoogleId } from "../src/lib/flight-moderation";
import {
  FLIGHT_HISTORY_PAGE_SIZE,
  FREE_RECENT_FLIGHTS_LIMIT,
} from "../src/lib/flightHistory";
import {
  getEffectiveAccessRole,
  hasEffectiveProAccess,
} from "../src/lib/proAccess";

const DEFAULT_STATS_MAX_SPEED_KTS = 750;
const HIGH_PERFORMANCE_STATS_MAX_SPEED_KTS = 1100;
const STATS_EXCLUDED_SPEED_REASON = "speed_over_stats_limit";
const LEGACY_STATS_EXCLUDED_SPEED_REASON = "speed_over_750_kts";

function isHighPerformanceStatsAircraft(aircraftType?: string) {
  const normalized = aircraftType?.trim().toUpperCase() ?? "";
  if (!normalized) return false;

  if (normalized.includes("CONCORDE")) return true;

  return (
    /\bF\/?A-?\d{1,3}[A-Z]?\b/.test(normalized) ||
    /\bF-?\d{1,3}[A-Z]?\b/.test(normalized) ||
    /\b[ABT]-\d{1,3}[A-Z]?\b/.test(normalized) ||
    /\bSR-?71\b/.test(normalized) ||
    /\bYF-?\d{1,3}[A-Z]?\b/.test(normalized) ||
    /\bMIG-?\d{1,3}[A-Z]?\b/.test(normalized) ||
    /\bSU-?\d{1,3}[A-Z]?\b/.test(normalized) ||
    /\bJAS-?\d{1,3}[A-Z]?\b/.test(normalized) ||
    /\bEUROFIGHTER\b/.test(normalized) ||
    /\bTYPHOON\b/.test(normalized) ||
    /\bRAFALE\b/.test(normalized) ||
    /\bMIRAGE\b/.test(normalized) ||
    /\bGRIPEN\b/.test(normalized) ||
    /\bTORNADO\b/.test(normalized) ||
    /\bHARRIER\b/.test(normalized) ||
    /\bPHANTOM\b/.test(normalized) ||
    /\bVIGGEN\b/.test(normalized) ||
    /\bSUKHOI\b/.test(normalized) ||
    /\bMIKOYAN\b/.test(normalized)
  );
}

function getStatsMaxSpeedKts(aircraftType?: string) {
  return isHighPerformanceStatsAircraft(aircraftType)
    ? HIGH_PERFORMANCE_STATS_MAX_SPEED_KTS
    : DEFAULT_STATS_MAX_SPEED_KTS;
}

// Get flight history for a user by their Google ID
export const getHistoryByGoogleId = query({
  args: { googleId: v.string() },
  handler: async (ctx, args) => {
    // First find the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_googleId", (q) => q.eq("googleId", args.googleId))
      .first();

    if (!user) return [];

    // Get flights for this user, ordered by startTime descending, limit to 5
    const flights = await ctx.db
      .query("flights")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100); // Get more than we need to sort by startTime

    // Sort by startTime descending and take top 5
    return flights
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 5)
      .map((flight) => ({
        id: flight._id,
        depICAO: flight.depICAO,
        arrICAO: flight.arrICAO,
        startTime: flight.startTime,
        endTime: flight.endTime,
        aircraftType: flight.aircraftType,
        callsign: flight.callsign,
        duration: flight.duration,
        maxAltitude: flight.maxAltitude,
        maxSpeed: flight.maxSpeed,
        routeData: flight.routeData,
      }));
  },
});

function utcDateStringFromTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function diffDaysUtc(prevDateStr: string, currDateStr: string): number {
  const prev = new Date(`${prevDateStr}T00:00:00Z`);
  const curr = new Date(`${currDateStr}T00:00:00Z`);
  return (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
}

function deriveVisibleCurrentStreak(
  lastFlightDate?: string,
  streakAtLastFlight = 0,
): number {
  if (!lastFlightDate || streakAtLastFlight <= 0) return 0;

  const now = new Date();
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterday.getUTCDate()).padStart(2, "0")}`;

  if (lastFlightDate !== todayStr && lastFlightDate !== yesterdayStr) {
    return 0;
  }

  return streakAtLastFlight;
}

function getStatsExcludedReason(flight: {
  aircraftType?: string;
  maxSpeed?: number;
  statsExcludedReason?: string;
}): string | undefined {
  if (
    typeof flight.maxSpeed === "number" &&
    flight.maxSpeed > getStatsMaxSpeedKts(flight.aircraftType)
  ) {
    return STATS_EXCLUDED_SPEED_REASON;
  }
  if (
    flight.statsExcludedReason &&
    flight.statsExcludedReason !== STATS_EXCLUDED_SPEED_REASON &&
    flight.statsExcludedReason !== LEGACY_STATS_EXCLUDED_SPEED_REASON
  ) {
    return flight.statsExcludedReason;
  }
  return undefined;
}

function isFlightStatsEligible(flight: {
  aircraftType?: string;
  maxSpeed?: number;
  statsExcludedReason?: string;
}) {
  return getStatsExcludedReason(flight) === undefined;
}

async function getCurrentViewer(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();
}

function canViewerAccessFullFlightHistory(
  viewer:
    | {
        role?: "FREE" | "PRO" | "ADMIN" | null;
        adminProExpiresAt?: number | null;
        googleId?: string;
      }
    | null
    | undefined,
) {
  const isSuperAdmin = Boolean(
    process.env.ADMIN_GOOGLE_ID &&
    viewer?.googleId === process.env.ADMIN_GOOGLE_ID,
  );

  return isSuperAdmin || hasEffectiveProAccess(viewer);
}

function matchesFlightHistorySearch(
  flight: {
    callsign: string;
    aircraftType: string;
    depICAO?: string;
    arrICAO?: string;
    startTime: number;
    endTime?: number;
    maxAltitude?: number;
    maxSpeed?: number;
    routeData?: [number, number][];
  },
  searchQuery: string,
) {
  if (!searchQuery) return true;

  const tokens = normalizeFlightSearch(searchQuery).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;

  const candidates = buildFlightSearchCandidates(flight);
  return tokens.every((token) =>
    candidates.some(
      (candidate) =>
        candidate.includes(token) || isSubsequenceMatch(token, candidate),
    ),
  );
}

function serializeFlightHistoryFlight(flight: {
  _id: Id<"flights">;
  callsign: string;
  aircraftType: string;
  depICAO?: string;
  arrICAO?: string;
  startTime: number;
  endTime?: number;
  maxAltitude?: number;
  maxSpeed?: number;
  routeData?: [number, number][];
}) {
  return {
    id: flight._id,
    callsign: flight.callsign,
    aircraftType: flight.aircraftType,
    depICAO: flight.depICAO,
    arrICAO: flight.arrICAO,
    startTime: flight.startTime,
    endTime: flight.endTime,
    maxAltitude: flight.maxAltitude,
    maxSpeed: flight.maxSpeed,
    routeData: flight.routeData,
  };
}

function normalizeFlightSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatSearchDateVariants(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return [
    `${year}-${month}-${day}`,
    `${month}/${day}/${year}`,
    `${day}/${month}/${year}`,
    `${year}${month}${day}`,
    `${hours}:${minutes}`,
    `${hours}${minutes}`,
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
    date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }),
  ];
}

function formatSearchDuration(startTime: number, endTime?: number) {
  if (!endTime) return ["in progress", "active", "ongoing"];

  const totalMinutes = Math.max(0, Math.round((endTime - startTime) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return [
    `${totalMinutes}m`,
    `${totalMinutes} min`,
    `${hours}h ${minutes}m`,
    `${hours}h${minutes}m`,
    `${hours}:${String(minutes).padStart(2, "0")}`,
    "completed",
  ];
}

function buildFlightSearchCandidates(flight: {
  callsign: string;
  aircraftType: string;
  depICAO?: string;
  arrICAO?: string;
  startTime: number;
  endTime?: number;
  maxAltitude?: number;
  maxSpeed?: number;
  routeData?: [number, number][];
}) {
  const rawValues = [
    flight.callsign,
    flight.aircraftType,
    flight.depICAO,
    flight.arrICAO,
    flight.depICAO && flight.arrICAO
      ? `${flight.depICAO}-${flight.arrICAO}`
      : undefined,
    flight.depICAO && flight.arrICAO
      ? `${flight.depICAO} ${flight.arrICAO}`
      : undefined,
    ...formatSearchDateVariants(flight.startTime),
    ...formatSearchDuration(flight.startTime, flight.endTime),
    typeof flight.maxAltitude === "number"
      ? `${Math.round(flight.maxAltitude)}`
      : undefined,
    typeof flight.maxSpeed === "number"
      ? `${Math.round(flight.maxSpeed)}`
      : undefined,
    flight.routeData && flight.routeData.length > 1
      ? "replayable"
      : "no replay",
    flight.endTime ? undefined : "in progress",
  ].filter(Boolean);

  const normalizedCandidates = new Set<string>();
  for (const value of rawValues) {
    const normalized = normalizeFlightSearch(String(value));
    if (!normalized) continue;
    normalizedCandidates.add(normalized);
    for (const part of normalized.split(" ")) {
      if (part) normalizedCandidates.add(part);
    }
  }

  return [...normalizedCandidates];
}

function isSubsequenceMatch(needle: string, haystack: string) {
  if (!needle) return true;

  let needleIndex = 0;
  for (const character of haystack) {
    if (character === needle[needleIndex]) {
      needleIndex += 1;
      if (needleIndex === needle.length) return true;
    }
  }

  return false;
}

async function recalculateUserStats(ctx: MutationCtx, userId: Id<"users">) {
  const flights = await ctx.db
    .query("flights")
    .withIndex("by_userId_startTime", (q) => q.eq("userId", userId))
    .collect();
  const eligibleFlights = flights.filter(isFlightStatsEligible);

  const stats = await ctx.db
    .query("userStats")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();

  const approvedAircraftImages = stats?.approvedAircraftImages ?? 0;

  if (eligibleFlights.length === 0) {
    if (stats) {
      await ctx.db.patch(stats._id, {
        totalFlights: 0,
        totalFlightTimeMs: 0,
        totalDistanceNm: 0,
        approvedAircraftImages,
        streakAtLastFlight: 0,
        longestStreak: 0,
        lastFlightDate: undefined,
        lastFlightStartTime: undefined,
        lastFlightCallsign: undefined,
      });
    }
    return;
  }

  let totalFlightTimeMs = 0;
  let totalDistanceNm = 0;

  for (const flight of eligibleFlights) {
    if (flight.endTime !== undefined) {
      totalFlightTimeMs += Math.max(0, flight.endTime - flight.startTime);
    }
    totalDistanceNm += calculateRouteDistanceNm(flight.routeData);
  }

  const uniqueDates = [
    ...new Set(
      eligibleFlights.map((flight) =>
        utcDateStringFromTimestamp(flight.startTime),
      ),
    ),
  ];

  let longestStreak = 1;
  let streakAtLastFlight = 1;
  let currentRun = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const previousDate = uniqueDates[i - 1];
    const currentDate = uniqueDates[i];
    if (!previousDate || !currentDate) continue;

    const dayDiff = diffDaysUtc(previousDate, currentDate);
    if (dayDiff === 1) {
      currentRun += 1;
    } else {
      currentRun = 1;
    }
    longestStreak = Math.max(longestStreak, currentRun);
  }

  streakAtLastFlight = currentRun;

  const latestFlight = eligibleFlights.at(-1);
  const lastFlightDate = uniqueDates.at(-1);
  if (!latestFlight || !lastFlightDate) return;

  const nextStats = {
    totalFlights: eligibleFlights.length,
    totalFlightTimeMs,
    totalDistanceNm,
    approvedAircraftImages,
    streakAtLastFlight,
    longestStreak,
    lastFlightDate,
    lastFlightStartTime: latestFlight.startTime,
    lastFlightCallsign: latestFlight.callsign,
  };

  if (stats) {
    await ctx.db.patch(stats._id, nextStats);
    return;
  }

  await ctx.db.insert("userStats", {
    userId,
    ...nextStats,
  });
}

function canDeleteAnyFlight(role: string, googleId?: string) {
  if (role === "ADMIN") return true;

  const superAdminGoogleId = process.env.ADMIN_GOOGLE_ID;
  if (superAdminGoogleId && googleId === superAdminGoogleId) return true;

  return isFlightModeratorGoogleId(googleId);
}

// Create a new flight
export const create = mutation({
  args: {
    userId: v.id("users"),
    callsign: v.string(),
    aircraftType: v.string(),
    depICAO: v.optional(v.string()),
    arrICAO: v.optional(v.string()),
    squawk: v.optional(v.string()),
    duration: v.optional(v.number()),
    maxAltitude: v.optional(v.number()),
    maxSpeed: v.optional(v.number()),
    statsExcludedReason: v.optional(v.string()),
    routeData: v.optional(v.any()),
    startTime: v.number(),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const statsExcludedReason = getStatsExcludedReason(args);
    const flightId = await ctx.db.insert("flights", {
      userId: args.userId,
      callsign: args.callsign,
      aircraftType: args.aircraftType,
      depICAO: args.depICAO,
      arrICAO: args.arrICAO,
      squawk: args.squawk,
      duration: args.duration,
      maxAltitude: args.maxAltitude,
      maxSpeed: args.maxSpeed,
      statsExcludedReason,
      routeData: args.routeData,
      startTime: args.startTime,
      endTime: args.endTime,
    });

    if (statsExcludedReason) {
      return flightId;
    }

    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    const flightTimeMs =
      args.endTime !== undefined
        ? Math.max(0, args.endTime - args.startTime)
        : 0;
    const distanceNm = calculateRouteDistanceNm(args.routeData);
    const flightDate = utcDateStringFromTimestamp(args.startTime);

    if (!stats) {
      await ctx.db.insert("userStats", {
        userId: args.userId,
        totalFlights: 1,
        totalFlightTimeMs: flightTimeMs,
        totalDistanceNm: distanceNm,
        approvedAircraftImages: 0,
        streakAtLastFlight: 1,
        longestStreak: 1,
        lastFlightDate: flightDate,
        lastFlightStartTime: args.startTime,
        lastFlightCallsign: args.callsign,
      });

      await autoCompleteChallengesForFlight(ctx, {
        userId: args.userId,
        flightId,
        aircraftType: args.aircraftType,
        depICAO: args.depICAO,
        arrICAO: args.arrICAO,
        startTime: args.startTime,
        endTime: args.endTime,
        routeData: args.routeData,
      });

      return flightId;
    }

    const isNewestFlight =
      stats.lastFlightStartTime === undefined ||
      args.startTime >= stats.lastFlightStartTime;

    let streakAtLastFlight = stats.streakAtLastFlight;
    let longestStreak = stats.longestStreak;
    let lastFlightDate = stats.lastFlightDate;

    if (isNewestFlight) {
      if (!lastFlightDate) {
        streakAtLastFlight = 1;
        longestStreak = Math.max(longestStreak, 1);
      } else if (flightDate !== lastFlightDate) {
        const dayDiff = diffDaysUtc(lastFlightDate, flightDate);
        if (dayDiff === 1) {
          streakAtLastFlight += 1;
        } else if (dayDiff > 1) {
          streakAtLastFlight = 1;
        }
        longestStreak = Math.max(longestStreak, streakAtLastFlight);
      }
      lastFlightDate = flightDate;
    }

    await ctx.db.patch(stats._id, {
      totalFlights: stats.totalFlights + 1,
      totalFlightTimeMs: stats.totalFlightTimeMs + flightTimeMs,
      totalDistanceNm: stats.totalDistanceNm + distanceNm,
      streakAtLastFlight,
      longestStreak,
      lastFlightDate,
      lastFlightStartTime: isNewestFlight
        ? args.startTime
        : stats.lastFlightStartTime,
      lastFlightCallsign: isNewestFlight
        ? args.callsign
        : stats.lastFlightCallsign,
    });

    await autoCompleteChallengesForFlight(ctx, {
      userId: args.userId,
      flightId,
      aircraftType: args.aircraftType,
      depICAO: args.depICAO,
      arrICAO: args.arrICAO,
      startTime: args.startTime,
      endTime: args.endTime,
      routeData: args.routeData,
    });

    return flightId;
  },
});

// Get all flights for a user
export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("flights")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get a single flight by ID
export const getById = query({
  args: { id: v.id("flights") },
  handler: async (ctx, args) => {
    const flight = await ctx.db.get(args.id);
    if (!flight) return null;

    return {
      id: flight._id,
      depICAO: flight.depICAO,
      arrICAO: flight.arrICAO,
      startTime: flight.startTime,
      endTime: flight.endTime,
      aircraftType: flight.aircraftType,
      callsign: flight.callsign,
      duration: flight.duration,
      maxAltitude: flight.maxAltitude,
      maxSpeed: flight.maxSpeed,
      routeData: flight.routeData,
    };
  },
});

// Delete all flights for a user (for cascading delete)
export const deleteByUserId = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const flights = await ctx.db
      .query("flights")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const flight of flights) {
      await ctx.db.delete(flight._id);
    }

    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (stats) {
      await ctx.db.delete(stats._id);
    }
  },
});

export const deleteFlight = mutation({
  args: { flightId: v.id("flights") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be signed in to delete flights");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser || currentUser.isDeleted) {
      throw new Error("Your RadarThing account could not be verified");
    }

    if (!canDeleteAnyFlight(currentUser.role, currentUser.googleId)) {
      throw new Error("You do not have permission to delete this flight");
    }

    const flight = await ctx.db.get(args.flightId);
    if (!flight) {
      throw new Error("Flight not found");
    }

    await ctx.db.delete(flight._id);
    await recalculateUserStats(ctx, flight.userId);

    return {
      success: true,
      deletedFlightId: flight._id,
      userId: flight.userId,
    };
  },
});

export const backfillUserStatsPage = mutation({
  args: {
    userId: v.id("users"),
    paginationOpts: paginationOptsValidator,
    reset: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let stats = await ctx.db
      .query("userStats")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!stats) {
      const statsId = await ctx.db.insert("userStats", {
        userId: args.userId,
        totalFlights: 0,
        totalFlightTimeMs: 0,
        totalDistanceNm: 0,
        approvedAircraftImages: 0,
        streakAtLastFlight: 0,
        longestStreak: 0,
      });
      stats = await ctx.db.get(statsId);
    }

    if (!stats) {
      throw new Error("Failed to initialize user stats");
    }

    if (args.reset) {
      await ctx.db.patch(stats._id, {
        totalFlights: 0,
        totalFlightTimeMs: 0,
        totalDistanceNm: 0,
        approvedAircraftImages: stats.approvedAircraftImages ?? 0,
        streakAtLastFlight: 0,
        longestStreak: 0,
        lastFlightDate: undefined,
        lastFlightStartTime: undefined,
        lastFlightCallsign: undefined,
      });
      stats = {
        ...stats,
        totalFlights: 0,
        totalFlightTimeMs: 0,
        totalDistanceNm: 0,
        approvedAircraftImages: stats.approvedAircraftImages ?? 0,
        streakAtLastFlight: 0,
        longestStreak: 0,
        lastFlightDate: undefined,
        lastFlightStartTime: undefined,
        lastFlightCallsign: undefined,
      };
    }

    const page = await ctx.db
      .query("flights")
      .withIndex("by_userId_startTime", (q) => q.eq("userId", args.userId))
      .paginate(args.paginationOpts);

    let totalFlights = stats.totalFlights;
    let totalFlightTimeMs = stats.totalFlightTimeMs;
    let totalDistanceNm = stats.totalDistanceNm;
    let streakAtLastFlight = stats.streakAtLastFlight;
    let longestStreak = stats.longestStreak;
    let lastFlightDate = stats.lastFlightDate;
    let lastFlightStartTime = stats.lastFlightStartTime;
    let lastFlightCallsign = stats.lastFlightCallsign;

    for (const flight of page.page) {
      if (!isFlightStatsEligible(flight)) continue;

      totalFlights += 1;
      if (flight.endTime !== undefined) {
        totalFlightTimeMs += Math.max(0, flight.endTime - flight.startTime);
      }
      totalDistanceNm += calculateRouteDistanceNm(flight.routeData);

      if (
        lastFlightStartTime === undefined ||
        flight.startTime >= lastFlightStartTime
      ) {
        lastFlightStartTime = flight.startTime;
        lastFlightCallsign = flight.callsign;
      }

      const flightDate = utcDateStringFromTimestamp(flight.startTime);
      if (!lastFlightDate) {
        streakAtLastFlight = 1;
        longestStreak = Math.max(longestStreak, 1);
        lastFlightDate = flightDate;
        continue;
      }

      if (flightDate === lastFlightDate) continue;

      const dayDiff = diffDaysUtc(lastFlightDate, flightDate);
      if (dayDiff === 1) {
        streakAtLastFlight += 1;
      } else if (dayDiff > 1) {
        streakAtLastFlight = 1;
      }
      longestStreak = Math.max(longestStreak, streakAtLastFlight);
      lastFlightDate = flightDate;
    }

    await ctx.db.patch(stats._id, {
      totalFlights,
      totalFlightTimeMs,
      totalDistanceNm,
      streakAtLastFlight,
      longestStreak,
      lastFlightDate,
      lastFlightStartTime,
      lastFlightCallsign,
    });

    return {
      processedFlights: page.page.length,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
      totalFlights,
    };
  },
});

export const listActiveUserIdsForStatsBackfill = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .paginate(args.paginationOpts);

    return {
      isDone: page.isDone,
      continueCursor: page.continueCursor,
      users: page.page.map((user) => ({
        userId: user._id,
        clerkId: user.clerkId,
      })),
    };
  },
});

// Get user stats by Clerk ID
export const getStatsByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return null;

    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    const flights = await ctx.db
      .query("flights")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const eligibleFlights = flights.filter(isFlightStatsEligible);

    // Calculate stats
    const aircraftCounts: Record<string, number> = {};
    const routeCounts: Record<string, number> = {};
    const airportVisits: Record<string, number> = {};
    let fallbackTotalFlightTimeMs = 0;
    let fallbackTotalDistanceNm = 0;

    for (const flight of eligibleFlights) {
      if (!stats) {
        if (flight.endTime !== undefined) {
          fallbackTotalFlightTimeMs += Math.max(
            0,
            flight.endTime - flight.startTime,
          );
        }
        fallbackTotalDistanceNm += calculateRouteDistanceNm(flight.routeData);
      }

      // Aircraft counts
      if (flight.aircraftType) {
        aircraftCounts[flight.aircraftType] =
          (aircraftCounts[flight.aircraftType] || 0) + 1;
      }

      // Route counts
      if (flight.depICAO && flight.arrICAO) {
        const route = `${flight.depICAO}-${flight.arrICAO}`;
        routeCounts[route] = (routeCounts[route] || 0) + 1;
        airportVisits[flight.depICAO] =
          (airportVisits[flight.depICAO] || 0) + 1;
        airportVisits[flight.arrICAO] =
          (airportVisits[flight.arrICAO] || 0) + 1;
      }
    }

    // Get top items
    const topAircraft = Object.entries(aircraftCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const topRoutes = Object.entries(routeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([route, count]) => ({ route, count }));

    const topAirports = Object.entries(airportVisits)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([code, count]) => ({ code, count }));

    const streaks = calculateStreaks(eligibleFlights);

    return {
      totalFlights: stats?.totalFlights ?? eligibleFlights.length,
      totalFlightTimeMs: Math.round(
        stats?.totalFlightTimeMs ?? fallbackTotalFlightTimeMs,
      ),
      totalDistanceNm: Math.round(
        stats?.totalDistanceNm ?? fallbackTotalDistanceNm,
      ),
      uniqueAirports: Object.keys(airportVisits).length,
      currentStreak: stats
        ? deriveVisibleCurrentStreak(
            stats.lastFlightDate,
            stats.streakAtLastFlight,
          )
        : streaks.currentStreak,
      longestStreak: stats?.longestStreak ?? streaks.longestStreak,
      topAircraft,
      topRoutes,
      topAirports,
    };
  },
});

export const getFlightHistoryPage = query({
  args: {
    userId: v.id("users"),
    page: v.number(),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      return {
        flights: [],
        page: 1,
        pageSize: FLIGHT_HISTORY_PAGE_SIZE,
        totalPages: 1,
        totalMatchingFlights: 0,
        totalRecordedFlights: 0,
        hiddenFlightCount: 0,
        pageStart: 0,
        pageEnd: 0,
        hasPreviousPage: false,
        hasNextPage: false,
        canAccessFullHistory: false,
      };
    }

    const viewer = await getCurrentViewer(ctx);
    const canAccessFullHistory = canViewerAccessFullFlightHistory(viewer);

    const allFlights = await ctx.db
      .query("flights")
      .withIndex("by_userId_startTime", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    const totalRecordedFlights = allFlights.length;
    const accessibleFlights = canAccessFullHistory
      ? allFlights
      : allFlights.slice(0, FREE_RECENT_FLIGHTS_LIMIT);

    const searchQuery = args.searchQuery?.trim() ?? "";

    const filteredFlights = accessibleFlights.filter((flight) =>
      matchesFlightHistorySearch(flight, searchQuery),
    );

    const totalMatchingFlights = filteredFlights.length;
    const totalPages = Math.max(
      1,
      Math.ceil(totalMatchingFlights / FLIGHT_HISTORY_PAGE_SIZE),
    );
    const page = Math.min(Math.max(Math.floor(args.page) || 1, 1), totalPages);
    const startIndex = (page - 1) * FLIGHT_HISTORY_PAGE_SIZE;
    const flights = filteredFlights
      .slice(startIndex, startIndex + FLIGHT_HISTORY_PAGE_SIZE)
      .map(serializeFlightHistoryFlight);

    return {
      flights,
      page,
      pageSize: FLIGHT_HISTORY_PAGE_SIZE,
      totalPages,
      totalMatchingFlights,
      totalRecordedFlights,
      hiddenFlightCount: canAccessFullHistory
        ? 0
        : Math.max(totalRecordedFlights - FREE_RECENT_FLIGHTS_LIMIT, 0),
      pageStart: totalMatchingFlights === 0 ? 0 : startIndex + 1,
      pageEnd: totalMatchingFlights === 0 ? 0 : startIndex + flights.length,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
      canAccessFullHistory,
    };
  },
});

// Calculate flight streaks from a list of flights
function calculateStreaks(flights: { startTime: number }[]): {
  currentStreak: number;
  longestStreak: number;
} {
  if (flights.length === 0) return { currentStreak: 0, longestStreak: 0 };

  // Get unique flight dates as "YYYY-MM-DD" strings (UTC)
  const dateSet = new Set<string>();
  for (const f of flights) {
    const d = new Date(f.startTime);
    dateSet.add(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
    );
  }

  const sortedDates = [...dateSet].sort();

  // Calculate longest streak
  let longestStreak = 1;
  let runLength = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1] + "T00:00:00Z");
    const curr = new Date(sortedDates[i] + "T00:00:00Z");
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      runLength++;
      longestStreak = Math.max(longestStreak, runLength);
    } else {
      runLength = 1;
    }
  }

  // Calculate current streak (count backwards from today/yesterday)
  const now = new Date();
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterday.getUTCDate()).padStart(2, "0")}`;

  const lastDate = sortedDates[sortedDates.length - 1];
  if (lastDate !== todayStr && lastDate !== yesterdayStr) {
    return { currentStreak: 0, longestStreak };
  }

  // Walk backwards from the last flight date
  let currentStreak = 1;
  for (let i = sortedDates.length - 2; i >= 0; i--) {
    const curr = new Date(sortedDates[i + 1] + "T00:00:00Z");
    const prev = new Date(sortedDates[i] + "T00:00:00Z");
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak };
}

// Get leaderboard data across all users
export const getLeaderboard = query({
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();

    const stats = await ctx.db.query("userStats").collect();
    const statsByUserId = new Map(stats.map((entry) => [entry.userId, entry]));

    const leaderboard = [];

    for (const user of users) {
      const userStats = statsByUserId.get(user._id);
      const approvedAircraftImages = userStats?.approvedAircraftImages ?? 0;
      if (
        !userStats ||
        (userStats.totalFlights <= 0 && approvedAircraftImages <= 0)
      ) {
        continue;
      }

      leaderboard.push({
        userId: user._id,
        clerkId: user.clerkId,
        callsign:
          userStats.lastFlightCallsign ?? user.discordUsername ?? "Unknown",
        role: getEffectiveAccessRole(user),
        discordUsername: user.discordUsername ?? null,
        totalFlights: userStats.totalFlights,
        totalFlightTimeMs: Math.round(userStats.totalFlightTimeMs),
        totalDistanceNm: Math.round(userStats.totalDistanceNm),
        approvedAircraftImages,
        currentStreak: deriveVisibleCurrentStreak(
          userStats.lastFlightDate,
          userStats.streakAtLastFlight,
        ),
      });
    }

    return leaderboard;
  },
});

// Get user stats by Convex user ID (for public pilot profile)
export const getStatsById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    const flights = await ctx.db
      .query("flights")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const eligibleFlights = flights.filter(isFlightStatsEligible);

    // Calculate stats
    const aircraftCounts: Record<string, number> = {};
    const routeCounts: Record<string, number> = {};
    const airportVisits: Record<string, number> = {};
    let fallbackTotalFlightTimeMs = 0;
    let fallbackTotalDistanceNm = 0;

    for (const flight of eligibleFlights) {
      if (!stats) {
        if (flight.endTime !== undefined) {
          fallbackTotalFlightTimeMs += Math.max(
            0,
            flight.endTime - flight.startTime,
          );
        }
        fallbackTotalDistanceNm += calculateRouteDistanceNm(flight.routeData);
      }

      // Aircraft counts
      if (flight.aircraftType) {
        aircraftCounts[flight.aircraftType] =
          (aircraftCounts[flight.aircraftType] || 0) + 1;
      }

      // Route counts
      if (flight.depICAO && flight.arrICAO) {
        const route = `${flight.depICAO}-${flight.arrICAO}`;
        routeCounts[route] = (routeCounts[route] || 0) + 1;
        airportVisits[flight.depICAO] =
          (airportVisits[flight.depICAO] || 0) + 1;
        airportVisits[flight.arrICAO] =
          (airportVisits[flight.arrICAO] || 0) + 1;
      }
    }

    // Get top items
    const topAircraft = Object.entries(aircraftCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const topRoutes = Object.entries(routeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([route, count]) => ({ route, count }));

    const topAirports = Object.entries(airportVisits)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([code, count]) => ({ code, count }));

    // Get pilot's callsign from most recent flight
    const eligibleSortedFlights = [...eligibleFlights].sort(
      (a, b) => b.startTime - a.startTime,
    );

    const mostRecentFlight = eligibleSortedFlights[0];
    const pilotCallsign =
      stats?.lastFlightCallsign ?? mostRecentFlight?.callsign ?? null;

    const streaks = calculateStreaks(eligibleFlights);

    return {
      userRole: getEffectiveAccessRole(user),
      pilotCallsign,
      discordUsername: user.discordUsername ?? null,
      totalFlights: stats?.totalFlights ?? eligibleFlights.length,
      totalFlightTimeMs: Math.round(
        stats?.totalFlightTimeMs ?? fallbackTotalFlightTimeMs,
      ),
      totalDistanceNm: Math.round(
        stats?.totalDistanceNm ?? fallbackTotalDistanceNm,
      ),
      uniqueAirports: Object.keys(airportVisits).length,
      currentStreak: stats
        ? deriveVisibleCurrentStreak(
            stats.lastFlightDate,
            stats.streakAtLastFlight,
          )
        : streaks.currentStreak,
      longestStreak: stats?.longestStreak ?? streaks.longestStreak,
      topAircraft,
      topRoutes,
      topAirports,
    };
  },
});
