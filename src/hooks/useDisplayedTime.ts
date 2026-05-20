"use client";

import { useEffect, useState } from "react";
import { useTimeDisplayPreference } from "~/hooks/useTimeDisplayPreference";
import { formatClockParts } from "~/lib/timeDisplay";

function getInitialClock(timeDisplayMode: "utc" | "local") {
  return {
    time: "--:--:--",
    zoneLabel: timeDisplayMode === "utc" ? "UTC" : "LOCAL",
  };
}

export function useDisplayedTime() {
  const { timeDisplayMode } = useTimeDisplayPreference();
  const [clock, setClock] = useState(() => getInitialClock(timeDisplayMode));

  useEffect(() => {
    const updateClock = () => {
      setClock(formatClockParts(new Date(), timeDisplayMode));
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);

    return () => clearInterval(interval);
  }, [timeDisplayMode]);

  return clock;
}
