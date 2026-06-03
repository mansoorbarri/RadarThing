// hooks/useProStatus.ts
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { hasEffectiveProAccess } from "~/lib/proAccess";

const SUPER_ADMIN_EMAIL = "mansoor.eb.ak@gmail.com";

export const useProStatus = () => {
  const { user, isLoaded } = useUser();
  const clerkId = user?.id;
  const userEmails =
    user?.emailAddresses.map((email) => email.emailAddress) ?? [];

  // Real-time query - auto-updates when data changes in Convex
  const dbUser = useQuery(
    api.users.getByClerkId,
    clerkId ? { clerkId } : "skip",
  );

  const isSuperAdmin = userEmails.some(
    (email) => email.trim().toLowerCase() === SUPER_ADMIN_EMAIL,
  );
  const isLoading = !isLoaded || (clerkId && dbUser === undefined);
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
