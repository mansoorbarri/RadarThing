// hooks/useProStatus.ts
import { useConvexAuth, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { hasEffectiveProAccess } from "~/lib/proAccess";

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

  const isSuperAdmin = superAdminQuery ?? false;
  const isLoading =
    !isLoaded ||
    isConvexAuthLoading ||
    (clerkId &&
      (!isAuthenticated ||
        dbUser === undefined ||
        superAdminQuery === undefined));
  const isRoleAdmin = dbUser?.role === "ADMIN";
  const isAdminUser = isRoleAdmin || isSuperAdmin;
  const isProUser = hasEffectiveProAccess(dbUser);

  return {
    isProUser: isProUser || isSuperAdmin, // Super admins also have PRO access
    isAdminUser,
    isSuperAdmin,
    isLoading: Boolean(isLoading),
  };
};
