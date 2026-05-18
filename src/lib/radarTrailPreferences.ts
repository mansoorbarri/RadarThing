import { getCookie, setCookie } from "~/lib/cookies";

export type RadarTrailMode = "minutes" | "nm";

export interface RadarTrailPreferences {
  mode: RadarTrailMode;
  minutes: number;
  distanceNm: number;
}

const RADAR_TRAIL_MODE_COOKIE = "radar_trail_mode";
const RADAR_TRAIL_MINUTES_COOKIE = "radar_trail_minutes";
const RADAR_TRAIL_DISTANCE_COOKIE = "radar_trail_distance_nm";

export const DEFAULT_RADAR_TRAIL_PREFERENCES: RadarTrailPreferences = {
  mode: "minutes",
  minutes: 1,
  distanceNm: 5,
};

function clampInterval(value: number) {
  return Math.min(10, Math.max(1, Math.round(value)));
}

function parseIntervalCookie(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? clampInterval(parsed) : fallback;
}

export function normalizeRadarTrailPreferences(
  preferences: Partial<RadarTrailPreferences> | null | undefined,
): RadarTrailPreferences {
  return {
    mode: preferences?.mode === "nm" ? "nm" : "minutes",
    minutes: clampInterval(
      preferences?.minutes ?? DEFAULT_RADAR_TRAIL_PREFERENCES.minutes,
    ),
    distanceNm: clampInterval(
      preferences?.distanceNm ?? DEFAULT_RADAR_TRAIL_PREFERENCES.distanceNm,
    ),
  };
}

export function getStoredRadarTrailPreferences(): RadarTrailPreferences {
  const modeCookie = getCookie(RADAR_TRAIL_MODE_COOKIE);
  return normalizeRadarTrailPreferences({
    mode:
      modeCookie === "minutes" || modeCookie === "nm" ? modeCookie : undefined,
    minutes: parseIntervalCookie(
      getCookie(RADAR_TRAIL_MINUTES_COOKIE),
      DEFAULT_RADAR_TRAIL_PREFERENCES.minutes,
    ),
    distanceNm: parseIntervalCookie(
      getCookie(RADAR_TRAIL_DISTANCE_COOKIE),
      DEFAULT_RADAR_TRAIL_PREFERENCES.distanceNm,
    ),
  });
}

export function setStoredRadarTrailPreferences(
  preferences: RadarTrailPreferences,
): RadarTrailPreferences {
  const normalized = normalizeRadarTrailPreferences(preferences);
  setCookie(RADAR_TRAIL_MODE_COOKIE, normalized.mode);
  setCookie(RADAR_TRAIL_MINUTES_COOKIE, String(normalized.minutes));
  setCookie(RADAR_TRAIL_DISTANCE_COOKIE, String(normalized.distanceNm));
  return normalized;
}

export function getRadarTrailIntervalLabel(
  preferences: RadarTrailPreferences,
) {
  return preferences.mode === "minutes"
    ? `${preferences.minutes} min`
    : `${preferences.distanceNm} NM`;
}
