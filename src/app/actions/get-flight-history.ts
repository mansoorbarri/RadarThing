"use server";

import { auth } from "@clerk/nextjs/server";
import { convex, api } from "~/server/convex";
import { env } from "~/env";
import { hasEffectiveProAccess } from "~/lib/proAccess";

// Check if current user has PRO access (PRO role or admin)
async function canViewFlightHistory(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;

  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  if (!user) return false;

  // Admin role or PRO role
  if (hasEffectiveProAccess(user)) return true;

  // Fallback: env-based super admin
  const superAdminGoogleId = env.ADMIN_GOOGLE_ID;
  if (superAdminGoogleId && user.googleId === superAdminGoogleId) {
    return true;
  }

  return false;
}

export async function getFlightHistory(googleId: string) {
  if (!googleId) return { flights: [], canAccess: false };

  // Check if user can access flight history (PRO or admin only)
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
