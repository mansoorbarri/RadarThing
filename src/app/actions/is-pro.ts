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

// Combined query to get both pro and admin status with a single DB call
// This avoids the duplicate queries in useProStatus hook
export async function getProAndAdminStatus(): Promise<{ isPro: boolean; isAdmin: boolean }> {
  const { userId } = await auth();
  if (!userId) return { isPro: false, isAdmin: false };

  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  if (!user) return { isPro: false, isAdmin: false };

  const isAdminUser = Boolean(user.googleId && env.ADMIN_GOOGLE_ID && user.googleId === env.ADMIN_GOOGLE_ID);
  const isProUser = user.role === "PRO" || isAdminUser;

  return { isPro: isProUser, isAdmin: isAdminUser };
}

// Lightweight admin check that takes a googleId - avoids duplicate DB query
// when the client already has the user data from useQuery
export async function checkIsAdminByGoogleId(googleId: string | null | undefined): Promise<boolean> {
  // Server actions must be async, so we use a minimal async operation
  await Promise.resolve();
  if (!googleId || !env.ADMIN_GOOGLE_ID) return false;
  return googleId === env.ADMIN_GOOGLE_ID;
}

export async function getSupportId(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  return user?.googleId ?? user?._id ?? null;
}
