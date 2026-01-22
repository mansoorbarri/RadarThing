"use server";

import { auth } from "@clerk/nextjs/server";
import { convex, api } from "~/server/convex";

// Check if current user has PRO or ADMIN role
async function canViewFlightHistory(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;

  return await convex.query(api.users.isPro, { clerkId: userId });
}

export async function getFlightHistory(googleId: string) {
  if (!googleId) return { flights: [], canAccess: false };

  // Check if user can access flight history (PRO or ADMIN only)
  const canAccess = await canViewFlightHistory();
  if (!canAccess) {
    return { flights: [], canAccess: false };
  }

  const flights = await convex.query(api.flights.getHistoryByGoogleId, {
    googleId,
  });

  return {
    flights: flights.map((flight) => ({
      ...flight,
      startTime: new Date(flight.startTime),
    })),
    canAccess: true,
  };
}
