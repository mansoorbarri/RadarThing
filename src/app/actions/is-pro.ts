"use server";

import { currentUser } from "@clerk/nextjs/server";
import { convex, api } from "~/server/convex";
import { hasEffectiveProAccess } from "~/lib/proAccess";

const SUPER_ADMIN_GOOGLE_ID = "101233162035372298523";

async function getUserByEmail(
  clerkUser: Awaited<ReturnType<typeof currentUser>>,
) {
  const email = clerkUser?.primaryEmailAddress?.emailAddress;
  if (!email) return null;

  return await convex.query(api.users.getByEmail, { email });
}

function isSuperAdminUserRecord(
  user: Awaited<ReturnType<typeof getUserByEmail>>,
) {
  return user?.googleId === SUPER_ADMIN_GOOGLE_ID;
}

export async function isPro() {
  const clerkUser = await currentUser();
  const user = await getUserByEmail(clerkUser);
  const isSuperAdmin = isSuperAdminUserRecord(user);
  if (!user) return isSuperAdmin;

  // Admins also have PRO access
  if (hasEffectiveProAccess(user)) return true;

  return isSuperAdmin;
}

export async function isAdmin() {
  const clerkUser = await currentUser();
  const user = await getUserByEmail(clerkUser);
  const isSuperAdmin = isSuperAdminUserRecord(user);
  if (!user) return isSuperAdmin;

  // Role-based admin check
  if (user.role === "ADMIN") return true;

  return isSuperAdmin;
}

// Combined query to get both pro and admin status with a single DB call
// This avoids the duplicate queries in useProStatus hook
export async function getProAndAdminStatus(): Promise<{
  isPro: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}> {
  const clerkUser = await currentUser();
  const user = await getUserByEmail(clerkUser);
  const isSuperAdminUser = isSuperAdminUserRecord(user);
  if (!user) {
    return {
      isPro: isSuperAdminUser,
      isAdmin: isSuperAdminUser,
      isSuperAdmin: isSuperAdminUser,
    };
  }

  // Role-based admin check
  const isRoleAdmin = user.role === "ADMIN";

  const isAdminUser = isRoleAdmin || isSuperAdminUser;
  const isProUser = hasEffectiveProAccess(user) || isSuperAdminUser;

  return {
    isPro: isProUser,
    isAdmin: isAdminUser,
    isSuperAdmin: isSuperAdminUser,
  };
}

// Check if the current logged-in user is the configured super admin
export async function isSuperAdminUser(): Promise<boolean> {
  return isSuperAdminUserRecord(await getUserByEmail(await currentUser()));
}

export async function checkIsSuperAdmin(): Promise<boolean> {
  return isSuperAdminUser();
}

export async function getSupportId(): Promise<string | null> {
  const user = await getUserByEmail(await currentUser());
  if (!user) return null;

  return user.googleId ?? user._id ?? null;
}
