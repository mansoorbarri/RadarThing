"use server";

import { currentUser } from "@clerk/nextjs/server";
import { convex, api } from "~/server/convex";
import { hasEffectiveProAccess } from "~/lib/proAccess";

const SUPER_ADMIN_EMAIL = "mansoor.eb.ak@gmail.com";

function isSuperAdminEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

// Helper to get user by email (consistent across Clerk dev/prod)
async function getUserByEmail() {
  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress;
  if (!email) return null;

  return await convex.query(api.users.getByEmail, { email });
}

function isCurrentClerkUserSuperAdmin(
  clerkUser: Awaited<ReturnType<typeof currentUser>>,
) {
  return (
    clerkUser?.emailAddresses.some((email) =>
      isSuperAdminEmail(email.emailAddress),
    ) ?? false
  );
}

export async function isPro() {
  const user = await getUserByEmail();
  if (!user) return false;

  // Admins also have PRO access
  if (hasEffectiveProAccess(user)) return true;

  return isSuperAdminEmail(user.email);
}

export async function isAdmin() {
  const user = await getUserByEmail();
  if (!user) return false;

  // Role-based admin check
  if (user.role === "ADMIN") return true;

  return isSuperAdminEmail(user.email);
}

// Combined query to get both pro and admin status with a single DB call
// This avoids the duplicate queries in useProStatus hook
export async function getProAndAdminStatus(): Promise<{
  isPro: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}> {
  const user = await getUserByEmail();
  if (!user) return { isPro: false, isAdmin: false, isSuperAdmin: false };

  // Role-based admin check
  const isRoleAdmin = user.role === "ADMIN";

  const isSuperAdminUser = isSuperAdminEmail(user.email);

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
  return isCurrentClerkUserSuperAdmin(await currentUser());
}

export async function checkIsSuperAdmin(): Promise<boolean> {
  return isCurrentClerkUserSuperAdmin(await currentUser());
}

export async function getSupportId(): Promise<string | null> {
  const user = await getUserByEmail();
  if (!user) return null;

  return user.googleId ?? user._id ?? null;
}
