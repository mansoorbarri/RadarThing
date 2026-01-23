// hooks/useProStatus.ts
import { useState, useEffect } from "react";
import { isPro, isAdmin, getSupportId } from "~/app/actions/is-pro";
import { setSentryUser } from "~/lib/sentry";

// Clear any stale cache from previous version
if (typeof window !== "undefined") {
  try {
    sessionStorage.removeItem("radarthing_pro_status");
    sessionStorage.removeItem("radarthing_admin_status");
    sessionStorage.removeItem("radarthing_status_timestamp");
  } catch {
    // Ignore
  }
}

export const useProStatus = () => {
  const [isProUser, setIsProUser] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([isPro(), isAdmin(), getSupportId()])
      .then(([proResult, adminResult, supportId]) => {
        setIsProUser(proResult);
        setIsAdminUser(adminResult);
        // Set Sentry user context for error tracking
        setSentryUser(supportId);
      })
      .catch((error) => {
        console.error("Failed to fetch pro/admin status:", error);
        setIsProUser(false);
        setIsAdminUser(false);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return { isProUser, isAdminUser, isLoading };
};
