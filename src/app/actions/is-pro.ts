"use server";

import { currentUser } from "@clerk/nextjs/server";
import { convex, api } from "~/server/convex";
import { env } from "~/env";

// Helper to get user by email (consistent across Clerk dev/prod)
async function getUserByEmail() {
  const clerkUser = await currentUser();
  if (!clerkUser?.emailAddresses?.[0]?.emailAddress) return null;

  const email = clerkUser.emailAddresses[0].emailAddress;
  return await convex.query(api.users.getByEmail, { email });
}

export async function isPro() {
  const user = await getUserByEmail();
  if (!user) return false;

  // Admin users also have PRO access
  const adminGoogleId = env.ADMIN_GOOGLE_ID || "101233162035372298523";
  if (user.googleId && user.googleId === adminGoogleId) {
    return true;
  }

  return user.role === "PRO";
}

export async function isAdmin() {
  const user = await getUserByEmail();
  if (!user?.googleId) return false;

  const adminGoogleId = env.ADMIN_GOOGLE_ID || "101233162035372298523";
  return user.googleId === adminGoogleId;
}

// Combined query to get both pro and admin status with a single DB call
// This avoids the duplicate queries in useProStatus hook
export async function getProAndAdminStatus(): Promise<{ isPro: boolean; isAdmin: boolean }> {
  const user = await getUserByEmail();
  if (!user) return { isPro: false, isAdmin: false };

  const adminGoogleId = env.ADMIN_GOOGLE_ID || "101233162035372298523";
  const isAdminUser = Boolean(user.googleId && user.googleId === adminGoogleId);
  const isProUser = user.role === "PRO" || isAdminUser;

  return { isPro: isProUser, isAdmin: isAdminUser };
}

// Lightweight admin check that takes a googleId - avoids duplicate DB query
// when the client already has the user data from useQuery
export async function checkIsAdminByGoogleId(googleId: string | null | undefined): Promise<boolean> {
  // Server actions must be async, so we use a minimal async operation
  await Promise.resolve();
  if (!googleId) return false;
  const adminGoogleId = env.ADMIN_GOOGLE_ID || "101233162035372298523";
  return googleId === adminGoogleId;
}

export async function getSupportId(): Promise<string | null> {
  const user = await getUserByEmail();
  if (!user) return null;

  return user.googleId ?? user._id ?? null;
}
