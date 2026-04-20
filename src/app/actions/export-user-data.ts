"use server";

import { auth } from "@clerk/nextjs/server";
import { api, convex } from "~/server/convex";
import {
  RADARTHING_ACCOUNT_DATA_EXPORT_VERSION,
  type RadarThingAccountDataExport,
} from "~/lib/account-data-export";

export async function getCurrentUserDataExport(): Promise<RadarThingAccountDataExport> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("You must be signed in to export your data");
  }

  const user = await convex.query(api.users.getByClerkId, {
    clerkId: userId,
  });

  if (!user || user.isDeleted) {
    throw new Error("Your RadarThing account could not be found");
  }

  const [stats, flights] = await Promise.all([
    convex.query(api.flights.getStatsByClerkId, { clerkId: userId }),
    convex.query(api.flights.getByUserId, { userId: user._id }),
  ]);

  return {
    schema: "radarthing.account_data",
    version: RADARTHING_ACCOUNT_DATA_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    account: {
      id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      googleId: user.googleId,
      role: user.role,
      discordUsername: user.discordUsername,
      createdAt: user._creationTime,
    },
    stats: serializeStats(stats),
    flights: flights
      .sort((a, b) => b.startTime - a.startTime)
      .map((flight) => ({
        id: flight._id,
        createdAt: flight._creationTime,
        callsign: flight.callsign,
        aircraftType: flight.aircraftType,
        depICAO: flight.depICAO,
        arrICAO: flight.arrICAO,
        squawk: flight.squawk,
        startTime: flight.startTime,
        endTime: flight.endTime,
        duration: flight.duration,
        maxAltitude: flight.maxAltitude,
        maxSpeed: flight.maxSpeed,
        routeData: flight.routeData,
      })),
  };
}

function serializeStats(
  stats: {
    totalFlights: number;
    totalFlightTimeMs: number;
    totalDistanceNm: number;
    uniqueAirports: number;
    currentStreak: number;
    longestStreak: number;
    topAircraft: { name: string; count: number }[];
    topRoutes: { route: string; count: number }[];
    topAirports: { code: string; count: number }[];
  } | null,
): RadarThingAccountDataExport["stats"] {
  if (!stats) return null;

  return {
    totalFlights: stats.totalFlights,
    totalFlightTimeMs: stats.totalFlightTimeMs,
    totalDistanceNm: stats.totalDistanceNm,
    uniqueAirports: stats.uniqueAirports,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    topAircraft: stats.topAircraft,
    topRoutes: stats.topRoutes,
    topAirports: stats.topAirports,
  };
}
