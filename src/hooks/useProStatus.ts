// hooks/useProStatus.ts
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { checkIsSuperAdmin } from "~/app/actions/is-pro";

export const useProStatus = () => {
  const { user, isLoaded } = useUser();
  const clerkId = user?.id;

  // Real-time query - auto-updates when data changes in Convex
  const dbUser = useQuery(
    api.users.getByClerkId,
    clerkId ? { clerkId } : "skip"
  );

  // Check for env-based super admin (break-glass access)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  useEffect(() => {
    if (dbUser?.googleId) {
      checkIsSuperAdmin(dbUser.googleId)
        .then(setIsSuperAdmin)
        .catch(() => setIsSuperAdmin(false));
    } else if (dbUser !== undefined) {
      setIsSuperAdmin(false);
    }
  }, [dbUser]);

  const isLoading = !isLoaded || (clerkId && dbUser === undefined);
  const isRoleAdmin = dbUser?.role === "ADMIN";
  const isAdminUser = isRoleAdmin || isSuperAdmin;
  const isProUser = dbUser?.role === "PRO" || dbUser?.role === "ADMIN";

  return {
    isProUser: isProUser || isSuperAdmin, // Super admins also have PRO access
    isAdminUser,
    isLoading: Boolean(isLoading),
  };
};
