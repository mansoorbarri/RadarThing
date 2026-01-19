"use client";

import { useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { getUserGoogleId } from "~/app/actions/get-user-profile";

export function useCurrentUserProfile() {
  const { user, isLoaded: clerkLoaded } = useUser();
  const [googleId, setGoogleId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (clerkLoaded && user) {
      getUserGoogleId()
        .then(setGoogleId)
        .finally(() => setIsLoaded(true));
    } else if (clerkLoaded && !user) {
      setIsLoaded(true);
    }
  }, [clerkLoaded, user]);

  return {
    isLoaded,
    clerkUser: user ?? null,
    googleId,
  };
}
