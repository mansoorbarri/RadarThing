"use server";

import { db } from "~/server/db";

export async function getFlightHistory(googleId: string) {
  if (!googleId) return [];
  
  return await db.flight.findMany({
    where: { 
      user: { googleId: googleId } 
    },
    orderBy: { startTime: 'desc' },
    take: 5, // Just show the last 5 in the sidebar
    select: {
      id: true,
      depICAO: true,
      arrICAO: true,
      startTime: true,
      aircraftType: true,
      routeData: true
    }
  });
}