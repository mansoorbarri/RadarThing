"use server";

import { auth } from "@clerk/nextjs/server";
import { convex, api } from "~/server/convex";
import { env } from "~/env";

export async function isPro() {
  const { userId } = await auth();
  if (!userId) return false;

  // Admin users also have PRO access
  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  if (user?.googleId && env.ADMIN_GOOGLE_ID && user.googleId === env.ADMIN_GOOGLE_ID) {
    return true;
  }

  return await convex.query(api.users.isPro, { clerkId: userId });
}

export async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;

  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  if (!user?.googleId || !env.ADMIN_GOOGLE_ID) return false;

  return user.googleId === env.ADMIN_GOOGLE_ID;
}
