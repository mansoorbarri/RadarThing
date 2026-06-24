"use client";

import { useCallback, useEffect, useState } from "react";
import { getBooleanCookie, setBooleanCookie } from "~/lib/cookies";

const HIDE_PERSONAL_INFO_COOKIE = "hide_personal_info";

export function usePrivacyPreferences() {
  const [hidePersonalInfo, setHidePersonalInfoState] = useState(false);

  useEffect(() => {
    setHidePersonalInfoState(
      getBooleanCookie(HIDE_PERSONAL_INFO_COOKIE, false),
    );
  }, []);

  const setHidePersonalInfo = useCallback((value: boolean) => {
    setHidePersonalInfoState(value);
    setBooleanCookie(HIDE_PERSONAL_INFO_COOKIE, value);
  }, []);

  return {
    hidePersonalInfo,
    setHidePersonalInfo,
  };
}
