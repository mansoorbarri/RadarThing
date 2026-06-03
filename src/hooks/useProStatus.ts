// hooks/useProStatus.ts
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { hasEffectiveProAccess } from "~/lib/proAccess";

export const useProStatus = () => {
  const { user, isLoaded } = useUser();
  const clerkId = user?.id;

  // Real-time query - auto-updates when data changes in Convex
  const dbUser = useQuery(
    api.users.getByClerkId,
    clerkId ? { clerkId } : "skip",
  );
  const superAdminQuery = useQuery(
    api.users.isSuperAdmin,
    clerkId ? {} : "skip",
  );

  const isSuperAdmin = superAdminQuery ?? false;
  const isLoading =
    !isLoaded ||
    (clerkId && (dbUser === undefined || superAdminQuery === undefined));
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
