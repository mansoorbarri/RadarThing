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
}> {
  const { userId } = await auth();
  if (!userId) {
    return { stats: null, isPro: false };
  }

  const [stats, isPro] = await Promise.all([
    convex.query(api.flights.getStatsByClerkId, { clerkId: userId }),
    convex.query(api.users.isPro, { clerkId: userId }),
  ]);

  return { stats, isPro };
}
