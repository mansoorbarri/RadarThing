// hooks/useProStatus.ts
import { useConvexAuth, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { hasActiveTrial, hasEffectiveProAccess } from "~/lib/proAccess";

export const useProStatus = () => {
  const { user, isLoaded } = useUser();
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const clerkId = user?.id;
  const canQueryUserStatus = Boolean(clerkId && isAuthenticated);

  // Real-time query - auto-updates when data changes in Convex
  const dbUser = useQuery(
    api.users.getByClerkId,
    canQueryUserStatus ? { clerkId: clerkId! } : "skip",
  );
  const superAdminQuery = useQuery(
    api.users.isSuperAdmin,
    canQueryUserStatus ? {} : "skip",
  );
  // Server-side so it also accounts for older records with the same identity.
  const canStartTrialQuery = useQuery(
    api.users.canStartMyFreeTrial,
    canQueryUserStatus ? {} : "skip",
  );

  const isSuperAdmin = superAdminQuery ?? false;
  const isLoading =
    !isLoaded ||
    isConvexAuthLoading ||
    (clerkId &&
      (!isAuthenticated ||
        dbUser === undefined ||
        superAdminQuery === undefined ||
        canStartTrialQuery === undefined));
  const isRoleAdmin =
    dbUser?.role === "ADMIN" && !dbUser.activeBanId && !dbUser.isDeleted;
  const isAdminUser = isRoleAdmin || isSuperAdmin;
  const isProUser = hasEffectiveProAccess(dbUser);
  const isTrialUser =
    hasActiveTrial(dbUser) && dbUser?.role === "FREE" && !isSuperAdmin;

  return {
    isProUser: isProUser || isSuperAdmin, // Super admins also have PRO access
    isAdminUser,
    isSuperAdmin,
    // Signed-in users who can still claim the one-time no-card trial.
    canStartTrial: Boolean(canStartTrialQuery) && !isSuperAdmin,
    isTrialUser,
    // Set for FREE users who have used the no-card trial, active or ended.
    trialEndsAt:
      dbUser?.role === "FREE" && !isSuperAdmin
        ? (dbUser.trialEndsAt ?? null)
        : null,
    isLoading: Boolean(isLoading),
  };
};
