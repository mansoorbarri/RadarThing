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

  return (
    <>
      <ClientDiagnosticsProvider />
      {children}
    </>
  );
}
