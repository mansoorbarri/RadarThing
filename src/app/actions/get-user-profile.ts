"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";

export async function getUserProfile(googleId?: string) {
  const { userId } = await auth();
//   console.log("Fetched user profile for userId:", userId);
  if (!userId) return null;

  return await db.user.findUnique({
    where: { clerkId: userId },
    select: {
      role: true,
      radarKey: true,
      airlineLogo: true,
    },
  });
}