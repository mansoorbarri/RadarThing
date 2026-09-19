"use client";

import { useEffect, useRef } from "react";
import { useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { syncCurrentAccount } from "~/app/actions/sync-account";

export function useStoreUserEffect() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const storedRef = useRef(false);

  useEffect(() => {
    // Reset when user signs out so next sign-in triggers a fresh store
    if (!isAuthenticated) {
      storedRef.current = false;
    }
  }, [isAuthenticated]);

  return { isAuthenticated, user, storedRef };
}

export function StoreUserProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, storedRef } = useStoreUserEffect();

  useEffect(() => {
    if (!isAuthenticated || !user || storedRef.current) return;

    storedRef.current = true;
    void syncCurrentAccount().catch(() => {
      storedRef.current = false;
    });
  }, [isAuthenticated, user, storedRef]);

  return children;
}
