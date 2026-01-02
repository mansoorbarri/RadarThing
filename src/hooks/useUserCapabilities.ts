"use client";

import { hasPremium } from "~/lib/capabilities";
import { useUserProfile } from "~/hooks/useUserProfile";

export function useUserCapabilities() {
  const { profile, loading } = useUserProfile();

  return {
    isPremium: hasPremium(profile?.role),
    canViewTaxiCharts: hasPremium(profile?.role),
    loading,
  };
}