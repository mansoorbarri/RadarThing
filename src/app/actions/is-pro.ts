"use server";

import { currentUser } from "@clerk/nextjs/server";
import { convex, api } from "~/server/convex";
import { hasEffectiveProAccess } from "~/lib/proAccess";

const SUPER_ADMIN_EMAIL = "mansoor.eb.ak@gmail.com";

function isSuperAdminEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

async function getUserByEmail(
  clerkUser: Awaited<ReturnType<typeof currentUser>>,
) {
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
  const clerkUser = await currentUser();
  const isSuperAdmin = isCurrentClerkUserSuperAdmin(clerkUser);
  const user = await getUserByEmail(clerkUser);
  if (!user) return isSuperAdmin;

  // Admins also have PRO access
  if (hasEffectiveProAccess(user)) return true;

  return isSuperAdmin;
}

export async function isAdmin() {
  const clerkUser = await currentUser();
  const isSuperAdmin = isCurrentClerkUserSuperAdmin(clerkUser);
  const user = await getUserByEmail(clerkUser);
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
  const isSuperAdminUser = isCurrentClerkUserSuperAdmin(clerkUser);
  const user = await getUserByEmail(clerkUser);
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
  return isCurrentClerkUserSuperAdmin(await currentUser());
}

export async function checkIsSuperAdmin(): Promise<boolean> {
  return isCurrentClerkUserSuperAdmin(await currentUser());
}

export async function getSupportId(): Promise<string | null> {
  const user = await getUserByEmail(await currentUser());
  if (!user) return null;

  return user.googleId ?? user._id ?? null;
}
