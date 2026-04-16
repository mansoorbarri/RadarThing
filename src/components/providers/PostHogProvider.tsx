"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Analytics } from "~/lib/analytics";
import { ClientDiagnosticsProvider } from "./ClientDiagnosticsProvider";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded: clerkLoaded } = useUser();
  const clerkId = user?.id;

  // Get user data from Convex for role info
  const dbUser = useQuery(
    api.users.getByClerkId,
    clerkId ? { clerkId } : "skip",
  );

  // Initialize PostHog on mount
  useEffect(() => {
    Analytics.init();
  }, []);

  // Identify user when they load
  useEffect(() => {
    if (!clerkLoaded) return;

    if (!user) {
      // User logged out
      Analytics.reset();
      return;
    }

    if (dbUser) {
      // Identify user with their properties
      Analytics.identify(user.id, {
        email: dbUser.email,
        role: dbUser.role,
        googleId: dbUser.googleId,
        stripeCustomerId: dbUser.stripeCustomerId,
      });
    }
  }, [clerkLoaded, user, dbUser]);

  return (
    <>
      <ClientDiagnosticsProvider />
      {children}
    </>
  );
}
