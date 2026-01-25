// hooks/useProStatus.ts
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { checkIsAdminByGoogleId } from "~/app/actions/is-pro";

export const useProStatus = () => {
  const { user, isLoaded } = useUser();
  const clerkId = user?.id;

  // Real-time query - auto-updates when data changes in Convex
  const dbUser = useQuery(
    api.users.getByClerkId,
    clerkId ? { clerkId } : "skip"
  );

  // Admin check via lightweight server action (uses googleId from dbUser, no extra DB query)
  const [isAdminUser, setIsAdminUser] = useState(false);
  useEffect(() => {
    if (dbUser?.googleId) {
      checkIsAdminByGoogleId(dbUser.googleId)
        .then(setIsAdminUser)
        .catch(() => setIsAdminUser(false));
    } else if (dbUser !== undefined) {
      // User loaded but no googleId
      setIsAdminUser(false);
    }
  }, [dbUser?.googleId]);

  const isLoading = !isLoaded || (clerkId && dbUser === undefined);
  const isProUser = dbUser?.role === "PRO";

  return {
    isProUser: isProUser || isAdminUser, // Admins also have PRO access
    isAdminUser,
    isLoading: Boolean(isLoading),
  };
};
