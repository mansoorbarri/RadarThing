"use client";

import React, { useState, useCallback, useEffect, useContext, createContext } from "react";
import { getCookie, setCookie } from "~/lib/cookies";
import {
  type SpeedUnit,
  type AltitudeUnit,
  type UnitPreferences,
  DEFAULT_UNIT_PREFERENCES,
} from "~/lib/units";

const SPEED_COOKIE = "unit_speed";
const ALTITUDE_COOKIE = "unit_altitude";

interface UnitPreferencesContextValue extends UnitPreferences {
  setSpeedUnit: (unit: SpeedUnit) => void;
  setAltitudeUnit: (unit: AltitudeUnit) => void;
}

const UnitPreferencesContext = createContext<UnitPreferencesContextValue | null>(
  null,
);

export function UnitPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [speedUnit, setSpeedUnitState] = useState<SpeedUnit>(
    DEFAULT_UNIT_PREFERENCES.speedUnit,
  );
  const [altitudeUnit, setAltitudeUnitState] = useState<AltitudeUnit>(
    DEFAULT_UNIT_PREFERENCES.altitudeUnit,
  );

  // Load from cookies on mount
  useEffect(() => {
    const savedSpeed = getCookie(SPEED_COOKIE) as SpeedUnit | null;
    const savedAltitude = getCookie(ALTITUDE_COOKIE) as AltitudeUnit | null;
    if (savedSpeed === "kts" || savedSpeed === "mach") {
      setSpeedUnitState(savedSpeed);
    }
    if (
      savedAltitude === "auto" ||
      savedAltitude === "feet" ||
      savedAltitude === "fl"
    ) {
      setAltitudeUnitState(savedAltitude);
    }
  }, []);

  const setSpeedUnit = useCallback((unit: SpeedUnit) => {
    setSpeedUnitState(unit);
    setCookie(SPEED_COOKIE, unit);
  }, []);

  const setAltitudeUnit = useCallback((unit: AltitudeUnit) => {
    setAltitudeUnitState(unit);
    setCookie(ALTITUDE_COOKIE, unit);
  }, []);

  const value: UnitPreferencesContextValue = {
    speedUnit,
    altitudeUnit,
    setSpeedUnit,
    setAltitudeUnit,
  };

  return React.createElement(
    UnitPreferencesContext.Provider,
    { value },
    children,
  );
}

export function useUnitPreferences() {
  const context = useContext(UnitPreferencesContext);
  if (!context) {
    // Fallback for components outside the provider (e.g., FlightCard)
    return {
      ...DEFAULT_UNIT_PREFERENCES,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      setSpeedUnit: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      setAltitudeUnit: () => {},
    };
  }
  return context;
}
