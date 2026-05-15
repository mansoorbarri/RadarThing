"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import {
  clearPersistedReferralCode,
  persistReferralCode,
  readPersistedReferralCode,
} from "~/lib/referralAttribution";
import { isReferralCode, normalizeReferralCode } from "~/lib/referrals";

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
    const referralCode = normalizeReferralCode(
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("ref"),
    );
    if (user || !isReferralCode(referralCode)) return;
    persistReferralCode(referralCode);
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated || !user || storedRef.current) return;

    const googleId =
      user.externalAccounts?.find((acc) => acc.provider === "google")
        ?.providerUserId ?? undefined;
    const persistedReferralCode = readPersistedReferralCode() ?? undefined;

    storedRef.current = true;
    void storeUser({ googleId, referralCode: persistedReferralCode })
      .then(() => {
        clearPersistedReferralCode();
      })
      .catch(() => {
        storedRef.current = false;
      });
  }, [isAuthenticated, user, storeUser, storedRef]);

  return children;
}
