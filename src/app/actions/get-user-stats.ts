"use server";

import { auth } from "@clerk/nextjs/server";
import { convex, api } from "~/server/convex";

export interface UserStats {
  totalFlights: number;
  totalFlightTimeMs: number;
  totalDistanceNm: number;
  uniqueAirports: number;
  topAircraft: { name: string; count: number }[];
  topRoutes: { route: string; count: number }[];
  topAirports: { code: string; count: number }[];
  recentFlights: {
    id: string;
    callsign: string;
    aircraftType: string;
    depICAO?: string;
    arrICAO?: string;
    startTime: number;
    endTime?: number;
    routeData?: [number, number][];
  }[];
}

export async function getUserStats(): Promise<{
  stats: UserStats | null;
  isPro: boolean;
  supportId: string | null;
}> {
  const { userId } = await auth();
  if (!userId) {
    return { stats: null, isPro: false, supportId: null };
  }

  const [stats, isPro, user] = await Promise.all([
    convex.query(api.flights.getStatsByClerkId, { clerkId: userId }),
    convex.query(api.users.isPro, { clerkId: userId }),
    convex.query(api.users.getByClerkId, { clerkId: userId }),
  ]);

  // Support ID: prefer googleId (used in SSE server logs), fallback to convex ID
  const supportId = user?.googleId ?? user?._id ?? null;

  return { stats, isPro, supportId };
}
