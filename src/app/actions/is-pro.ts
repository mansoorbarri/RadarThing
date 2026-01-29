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

  // Admins also have PRO access
  if (user.role === "ADMIN") return true;

  // Fallback: env-based super admin
  const superAdminGoogleId = env.ADMIN_GOOGLE_ID;
  if (superAdminGoogleId && user.googleId === superAdminGoogleId) {
    return true;
  }

  return user.role === "PRO";
}

export async function isAdmin() {
  const user = await getUserByEmail();
  if (!user) return false;

  // Role-based admin check
  if (user.role === "ADMIN") return true;

  // Fallback: env-based super admin (break-glass access)
  const superAdminGoogleId = env.ADMIN_GOOGLE_ID;
  return Boolean(superAdminGoogleId && user.googleId === superAdminGoogleId);
}

// Combined query to get both pro and admin status with a single DB call
// This avoids the duplicate queries in useProStatus hook
export async function getProAndAdminStatus(): Promise<{ isPro: boolean; isAdmin: boolean }> {
  const user = await getUserByEmail();
  if (!user) return { isPro: false, isAdmin: false };

  // Role-based admin check
  const isRoleAdmin = user.role === "ADMIN";

  // Fallback: env-based super admin
  const superAdminGoogleId = env.ADMIN_GOOGLE_ID;
  const isSuperAdmin = Boolean(superAdminGoogleId && user.googleId === superAdminGoogleId);

  const isAdminUser = isRoleAdmin || isSuperAdmin;
  const isProUser = user.role === "PRO" || isAdminUser;

  return { isPro: isProUser, isAdmin: isAdminUser };
}

// Check for env-based super admin (break-glass access)
// This is separate from role-based admin - it's for emergency access via env var
export async function checkIsSuperAdmin(googleId: string | null | undefined): Promise<boolean> {
  await Promise.resolve();
  if (!googleId) return false;
  const superAdminGoogleId = env.ADMIN_GOOGLE_ID;
  return Boolean(superAdminGoogleId && googleId === superAdminGoogleId);
}

export async function getSupportId(): Promise<string | null> {
  const user = await getUserByEmail();
  if (!user) return null;

  return user.googleId ?? user._id ?? null;
}
