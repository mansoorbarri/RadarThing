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
        aircraftType: flight.aircraftType,
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

    // Recent flights (last 10)
    const recentFlights = flights
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

    return {
      totalFlights,
      totalFlightTimeMs: totalFlightTime,
      totalDistanceNm: Math.round(totalDistance),
      uniqueAirports: Object.keys(airportVisits).length,
      topAircraft,
      topRoutes,
      topAirports,
      recentFlights,
    };
  },
});

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

    // Recent flights (last 10)
    const recentFlights = flights
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

    // Get pilot's callsign from most recent flight
    const pilotCallsign = recentFlights.length > 0 ? recentFlights[0].callsign : null;

    return {
      userRole: user.role,
      pilotCallsign,
      totalFlights,
      totalFlightTimeMs: totalFlightTime,
      totalDistanceNm: Math.round(totalDistance),
      uniqueAirports: Object.keys(airportVisits).length,
      topAircraft,
      topRoutes,
      topAirports,
      recentFlights,
    };
  },
});
