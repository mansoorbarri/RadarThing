"use client";

import React, {
  useCallback,
  useContext,
  useEffect,
  useState,
  createContext,
} from "react";
import { getBooleanCookie, setBooleanCookie } from "~/lib/cookies";
import { type TimeDisplayMode } from "~/lib/timeDisplay";

const TIME_DISPLAY_LOCAL_COOKIE = "radar_time_local";

interface TimeDisplayPreferenceContextValue {
  useLocalTime: boolean;
  timeDisplayMode: TimeDisplayMode;
  setUseLocalTime: (enabled: boolean) => void;
}

const TimeDisplayPreferenceContext =
  createContext<TimeDisplayPreferenceContextValue | null>(null);

export function TimeDisplayPreferenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [useLocalTimeState, setUseLocalTimeState] = useState(false);

  useEffect(() => {
    setUseLocalTimeState(getBooleanCookie(TIME_DISPLAY_LOCAL_COOKIE, false));
  }, []);

  const setUseLocalTime = useCallback((enabled: boolean) => {
    setUseLocalTimeState(enabled);
    setBooleanCookie(TIME_DISPLAY_LOCAL_COOKIE, enabled);
  }, []);

  const value: TimeDisplayPreferenceContextValue = {
    useLocalTime: useLocalTimeState,
    timeDisplayMode: useLocalTimeState ? "local" : "utc",
    setUseLocalTime,
  };

  return React.createElement(
    TimeDisplayPreferenceContext.Provider,
    { value },
    children,
  );
}

export function useTimeDisplayPreference() {
  const context = useContext(TimeDisplayPreferenceContext);

  if (!context) {
    return {
      useLocalTime: false,
      timeDisplayMode: "utc" as const,
      setUseLocalTime: () => {},
    };
  }

  return context;
}
