"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";

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
  const storeUser = useMutation(api.users.storeUser);

  useEffect(() => {
    if (!isAuthenticated || !user || storedRef.current) return;

    const googleId =
      user.externalAccounts?.find((acc) => acc.provider === "google")
        ?.providerUserId ?? undefined;

    storedRef.current = true;
    void storeUser({ googleId }).catch(() => {
        storedRef.current = false;
      });
  }, [isAuthenticated, user, storeUser, storedRef]);

  return children;
}
