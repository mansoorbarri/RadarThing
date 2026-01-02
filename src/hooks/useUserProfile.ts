"use client";

import { useEffect, useState } from "react";
import { type UserRole } from "~/lib/capabilities";
import { getUserProfile } from "~/app/actions/get-user-profile";

interface UserProfile {
  role: UserRole;
  radarKey: string | null;
  airlineLogo: string | null;
  googleId: string | null;
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserProfile()
      .then((data) => setProfile(data))
      .finally(() => setLoading(false));
  }, []);

  return { profile, loading };
}