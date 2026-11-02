"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Analytics } from "~/lib/analytics";
import { getEffectiveAccessRole } from "~/lib/proAccess";
import { ClientDiagnosticsProvider } from "./ClientDiagnosticsProvider";
import { usePrivacyConsent } from "~/components/privacy/PrivacyConsentProvider";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { analyticsAllowed, isResolved } = usePrivacyConsent();
  const { user, isLoaded: clerkLoaded } = useUser();
  const clerkId = user?.id;

  // Get user data from Convex for role info
  const dbUser = useQuery(
    api.users.getByClerkId,
    clerkId ? { clerkId } : "skip",
  );

  // Initialize PostHog on mount
  useEffect(() => {
    if (!isResolved) return;
    if (analyticsAllowed) {
      Analytics.init();
      Analytics.optIn();
    } else {
      Analytics.optOut();
    }
  }, [analyticsAllowed, isResolved]);

  // Identify user when they load
  useEffect(() => {
    if (!clerkLoaded || !analyticsAllowed) return;

    if (!user) {
      // User logged out
      Analytics.reset();
      return;
    }

    if (dbUser) {
      // Identify user with their properties
      Analytics.identify(user.id, {
        email: dbUser.email,
        role: getEffectiveAccessRole(dbUser),
        googleId: dbUser.googleId,
        stripeCustomerId: dbUser.stripeCustomerId,
      });
    }
  }, [analyticsAllowed, clerkLoaded, user, dbUser]);

  // OAuth sign-in finishes with a full page load, so report each new Clerk
  // sign-in timestamp once instead of watching for a signed-out → signed-in change.
  const lastSignInAt = user?.lastSignInAt?.getTime();
  useEffect(() => {
    if (!analyticsAllowed || !dbUser || !lastSignInAt) return;
    // Ignore old sessions so existing users are not reported as fresh sign-ins.
    if (Date.now() - lastSignInAt > 10 * 60 * 1000) return;
    const storageKey = "analytics_last_reported_sign_in";
    try {
      if (window.localStorage.getItem(storageKey) === String(lastSignInAt))
        return;
      window.localStorage.setItem(storageKey, String(lastSignInAt));
    } catch {
      return;
    }
    Analytics.signedIn();
  }, [analyticsAllowed, dbUser, lastSignInAt]);

  return (
    <>
      <ClientDiagnosticsProvider />
      {children}
    </>
  );
}
