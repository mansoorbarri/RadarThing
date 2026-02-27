"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useCurrentUserProfile() {
  const { user, isLoaded: clerkLoaded } = useUser();
  const clerkId = user?.id;

  // Real-time query - auto-updates when user data changes in Convex
  const dbUser = useQuery(
    api.users.getByClerkId,
    clerkId ? { clerkId } : "skip",
  );

  // Loading state: Clerk not loaded OR (user exists but Convex query still pending)
  const isLoaded = clerkLoaded && (clerkId ? dbUser !== undefined : true);

  return {
    isLoaded,
    clerkUser: user ?? null,
    googleId: dbUser?.googleId ?? null,
  };
}
