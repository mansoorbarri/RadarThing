import { getCookie, setCookie } from "~/lib/cookies";

export type RadarTrailMode = "minutes" | "nm";

export interface RadarTrailPreferences {
  enabled: boolean;
  mode: RadarTrailMode;
  minutes: number;
  distanceNm: number;
}

const RADAR_TRAIL_ENABLED_COOKIE = "radar_trail_enabled";
const RADAR_TRAIL_MODE_COOKIE = "radar_trail_mode";
const RADAR_TRAIL_MINUTES_COOKIE = "radar_trail_minutes";
const RADAR_TRAIL_DISTANCE_COOKIE = "radar_trail_distance_nm";

export const DEFAULT_RADAR_TRAIL_PREFERENCES: RadarTrailPreferences = {
  enabled: true,
  mode: "minutes",
  minutes: 10,
  distanceNm: 5,
};

function clampTimeInterval(value: number) {
  return Math.min(60, Math.max(2, Math.round(value)));
}

function clampDistanceInterval(value: number) {
  return Math.min(10, Math.max(1, Math.round(value)));
}

function parseTimeIntervalCookie(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? clampTimeInterval(parsed) : fallback;
}

function parseDistanceIntervalCookie(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? clampDistanceInterval(parsed) : fallback;
}

export function normalizeRadarTrailPreferences(
  preferences: Partial<RadarTrailPreferences> | null | undefined,
): RadarTrailPreferences {
  return {
    enabled:
      typeof preferences?.enabled === "boolean"
        ? preferences.enabled
        : DEFAULT_RADAR_TRAIL_PREFERENCES.enabled,
    mode: preferences?.mode === "nm" ? "nm" : "minutes",
    minutes: clampTimeInterval(
      preferences?.minutes ?? DEFAULT_RADAR_TRAIL_PREFERENCES.minutes,
    ),
    distanceNm: clampDistanceInterval(
      preferences?.distanceNm ?? DEFAULT_RADAR_TRAIL_PREFERENCES.distanceNm,
    ),
  };
}

export function getStoredRadarTrailPreferences(): RadarTrailPreferences {
  const enabledCookie = getCookie(RADAR_TRAIL_ENABLED_COOKIE);
  const modeCookie = getCookie(RADAR_TRAIL_MODE_COOKIE);

  return normalizeRadarTrailPreferences({
    enabled:
      enabledCookie === null
        ? undefined
        : enabledCookie === "true" || enabledCookie === "1",
    mode:
      modeCookie === "minutes" || modeCookie === "nm" ? modeCookie : undefined,
    minutes: parseTimeIntervalCookie(
      getCookie(RADAR_TRAIL_MINUTES_COOKIE),
      DEFAULT_RADAR_TRAIL_PREFERENCES.minutes,
    ),
    distanceNm: parseDistanceIntervalCookie(
      getCookie(RADAR_TRAIL_DISTANCE_COOKIE),
      DEFAULT_RADAR_TRAIL_PREFERENCES.distanceNm,
    ),
  });
}

export function setStoredRadarTrailPreferences(
  preferences: RadarTrailPreferences,
): RadarTrailPreferences {
  const normalized = normalizeRadarTrailPreferences(preferences);
  setCookie(RADAR_TRAIL_ENABLED_COOKIE, normalized.enabled ? "true" : "false");
  setCookie(RADAR_TRAIL_MODE_COOKIE, normalized.mode);
  setCookie(RADAR_TRAIL_MINUTES_COOKIE, String(normalized.minutes));
  setCookie(RADAR_TRAIL_DISTANCE_COOKIE, String(normalized.distanceNm));
  return normalized;
}
