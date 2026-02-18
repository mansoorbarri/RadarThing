import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
        routeData: flight.routeData,
      }));
  },
});

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
    routeData: v.optional(v.any()),
    startTime: v.number(),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("flights", {
      userId: args.userId,
      callsign: args.callsign,
      aircraftType: args.aircraftType,
      depICAO: args.depICAO,
      arrICAO: args.arrICAO,
      squawk: args.squawk,
      duration: args.duration,
      maxAltitude: args.maxAltitude,
      maxSpeed: args.maxSpeed,
      routeData: args.routeData,
      startTime: args.startTime,
      endTime: args.endTime,
    });
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

    const flights = await ctx.db
      .query("flights")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    // Calculate stats
    const totalFlights = flights.length;
    let totalFlightTime = 0;
    let totalDistance = 0;
    const aircraftCounts: Record<string, number> = {};
    const routeCounts: Record<string, number> = {};
    const airportVisits: Record<string, number> = {};

    for (const flight of flights) {
      // Flight time
      if (flight.endTime && flight.startTime) {
        totalFlightTime += flight.endTime - flight.startTime;
      }

      // Distance from route data
      if (flight.routeData && Array.isArray(flight.routeData)) {
        for (let i = 1; i < flight.routeData.length; i++) {
          const [lat1, lon1] = flight.routeData[i - 1];
          const [lat2, lon2] = flight.routeData[i];
          totalDistance += haversineDistance(lat1, lon1, lat2, lon2);
        }
      }

      // Aircraft counts
      if (flight.aircraftType) {
        aircraftCounts[flight.aircraftType] = (aircraftCounts[flight.aircraftType] || 0) + 1;
      }

      // Route counts
      if (flight.depICAO && flight.arrICAO) {
        const route = `${flight.depICAO}-${flight.arrICAO}`;
        routeCounts[route] = (routeCounts[route] || 0) + 1;
        airportVisits[flight.depICAO] = (airportVisits[flight.depICAO] || 0) + 1;
        airportVisits[flight.arrICAO] = (airportVisits[flight.arrICAO] || 0) + 1;
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

    // Recent flights (last 10) - sorted most recent first
    const recentFlights = [...flights]
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 10)
      .map((f) => ({
        id: f._id,
        callsign: f.callsign,
        aircraftType: f.aircraftType,
        depICAO: f.depICAO,
        arrICAO: f.arrICAO,
        startTime: f.startTime,
        endTime: f.endTime,
        routeData: f.routeData,
      }));

    const streaks = calculateStreaks(flights);

    return {
      totalFlights,
      totalFlightTimeMs: totalFlightTime,
      totalDistanceNm: Math.round(totalDistance),
      uniqueAirports: Object.keys(airportVisits).length,
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak,
      topAircraft,
      topRoutes,
      topAirports,
      recentFlights,
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
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
    );
  }

  const sortedDates = [...dateSet].sort();

  // Calculate longest streak
  let longestStreak = 1;
  let runLength = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1] + "T00:00:00Z");
    const curr = new Date(sortedDates[i] + "T00:00:00Z");
    const diffDays =
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
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
    const diffDays =
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak };
}

// Haversine formula to calculate distance between two points in nautical miles
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth's radius in nautical miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Get leaderboard data across all users
export const getLeaderboard = query({
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();

    const leaderboard = [];

    for (const user of users) {
      const flights = await ctx.db
        .query("flights")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();

      if (flights.length === 0) continue;

      let totalFlightTimeMs = 0;
      let totalDistanceNm = 0;

      for (const flight of flights) {
        if (flight.endTime && flight.startTime) {
          totalFlightTimeMs += flight.endTime - flight.startTime;
        }

        if (flight.routeData && Array.isArray(flight.routeData)) {
          for (let i = 1; i < flight.routeData.length; i++) {
            const [lat1, lon1] = flight.routeData[i - 1];
            const [lat2, lon2] = flight.routeData[i];
            totalDistanceNm += haversineDistance(lat1, lon1, lat2, lon2);
          }
        }
      }

      const mostRecent = flights.sort((a, b) => b.startTime - a.startTime)[0];
      const streaks = calculateStreaks(flights);

      leaderboard.push({
        userId: user._id,
        clerkId: user.clerkId,
        callsign: mostRecent?.callsign ?? "Unknown",
        role: user.role,
        discordUsername: user.discordUsername ?? null,
        totalFlights: flights.length,
        totalFlightTimeMs,
        totalDistanceNm: Math.round(totalDistanceNm),
        currentStreak: streaks.currentStreak,
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

    const flights = await ctx.db
      .query("flights")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    // Calculate stats
    const totalFlights = flights.length;
    let totalFlightTime = 0;
    let totalDistance = 0;
    const aircraftCounts: Record<string, number> = {};
    const routeCounts: Record<string, number> = {};
    const airportVisits: Record<string, number> = {};

    for (const flight of flights) {
      // Flight time
      if (flight.endTime && flight.startTime) {
        totalFlightTime += flight.endTime - flight.startTime;
      }

      // Distance from route data
      if (flight.routeData && Array.isArray(flight.routeData)) {
        for (let i = 1; i < flight.routeData.length; i++) {
          const [lat1, lon1] = flight.routeData[i - 1];
          const [lat2, lon2] = flight.routeData[i];
          totalDistance += haversineDistance(lat1, lon1, lat2, lon2);
        }
      }

      // Aircraft counts
      if (flight.aircraftType) {
        aircraftCounts[flight.aircraftType] = (aircraftCounts[flight.aircraftType] || 0) + 1;
      }

      // Route counts
      if (flight.depICAO && flight.arrICAO) {
        const route = `${flight.depICAO}-${flight.arrICAO}`;
        routeCounts[route] = (routeCounts[route] || 0) + 1;
        airportVisits[flight.depICAO] = (airportVisits[flight.depICAO] || 0) + 1;
        airportVisits[flight.arrICAO] = (airportVisits[flight.arrICAO] || 0) + 1;
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

    // Sort flights by start time (most recent first)
    const sortedFlights = [...flights].sort((a, b) => b.startTime - a.startTime);

    // Get pilot's callsign from most recent flight
    const mostRecentFlight = sortedFlights[0];
    const pilotCallsign = mostRecentFlight?.callsign ?? null;

    // Recent flights (last 10)
    const recentFlights = sortedFlights.slice(0, 10).map((f) => ({
      id: f._id,
      callsign: f.callsign,
      aircraftType: f.aircraftType,
      depICAO: f.depICAO,
      arrICAO: f.arrICAO,
      startTime: f.startTime,
      endTime: f.endTime,
      routeData: f.routeData,
    }));

    const streaks = calculateStreaks(flights);

    return {
      userRole: user.role,
      pilotCallsign,
      discordUsername: user.discordUsername ?? null,
      totalFlights,
      totalFlightTimeMs: totalFlightTime,
      totalDistanceNm: Math.round(totalDistance),
      uniqueAirports: Object.keys(airportVisits).length,
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak,
      topAircraft,
      topRoutes,
      topAirports,
      recentFlights,
    };
  },
});