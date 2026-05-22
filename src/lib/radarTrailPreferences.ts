import { getCookie, setCookie } from "~/lib/cookies";

export type RadarTrailMode = "minutes" | "nm";

export interface RadarIntervalPreferences {
  enabled: boolean;
  mode: RadarTrailMode;
  minutes: number;
  distanceNm: number;
}

export type RadarTrailPreferences = RadarIntervalPreferences;

export type RadarModeLinePreferences = RadarIntervalPreferences;

const RADAR_TRAIL_ENABLED_COOKIE = "radar_trail_enabled";
const RADAR_TRAIL_MODE_COOKIE = "radar_trail_mode";
const RADAR_TRAIL_MINUTES_COOKIE = "radar_trail_minutes";
const RADAR_TRAIL_DISTANCE_COOKIE = "radar_trail_distance_nm";
const RADAR_MODE_LINE_ENABLED_COOKIE = "radar_mode_line_enabled";
const RADAR_MODE_LINE_MODE_COOKIE = "radar_mode_line_mode";
const RADAR_MODE_LINE_MINUTES_COOKIE = "radar_mode_line_minutes";
const RADAR_MODE_LINE_DISTANCE_COOKIE = "radar_mode_line_distance_nm";

export const DEFAULT_RADAR_TRAIL_PREFERENCES: RadarTrailPreferences = {
  enabled: true,
  mode: "minutes",
  minutes: 10,
  distanceNm: 5,
};

export const DEFAULT_RADAR_MODE_LINE_PREFERENCES: RadarModeLinePreferences = {
  enabled: true,
  mode: "minutes",
  minutes: 60,
  distanceNm: 5,
};

function clampTrailTimeInterval(value: number) {
  return Math.min(60, Math.max(2, Math.round(value)));
}

function clampModeLineTimeInterval(value: number) {
  return Math.min(300, Math.max(60, Math.round(value)));
}

function clampDistanceInterval(value: number) {
  return Math.min(10, Math.max(1, Math.round(value)));
}

function parseTrailTimeIntervalCookie(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? clampTrailTimeInterval(parsed) : fallback;
}

function parseModeLineTimeIntervalCookie(
  value: string | null,
  fallback: number,
) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? clampModeLineTimeInterval(parsed) : fallback;
}

function parseDistanceIntervalCookie(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? clampDistanceInterval(parsed) : fallback;
}

function normalizeRadarIntervalPreferences<T extends RadarIntervalPreferences>(
  preferences: Partial<T> | null | undefined,
  fallback: T,
): T {
  return {
    enabled:
      typeof preferences?.enabled === "boolean"
        ? preferences.enabled
        : fallback.enabled,
    mode: preferences?.mode === "nm" ? "nm" : "minutes",
    minutes: clampTrailTimeInterval(preferences?.minutes ?? fallback.minutes),
    distanceNm: clampDistanceInterval(
      preferences?.distanceNm ?? fallback.distanceNm,
    ),
  } as T;
}

export function normalizeRadarTrailPreferences(
  preferences: Partial<RadarTrailPreferences> | null | undefined,
): RadarTrailPreferences {
  return normalizeRadarIntervalPreferences(
    preferences,
    DEFAULT_RADAR_TRAIL_PREFERENCES,
  );
}

export function normalizeRadarModeLinePreferences(
  preferences: Partial<RadarModeLinePreferences> | null | undefined,
): RadarModeLinePreferences {
  return {
    enabled:
      typeof preferences?.enabled === "boolean"
        ? preferences.enabled
        : DEFAULT_RADAR_MODE_LINE_PREFERENCES.enabled,
    mode: preferences?.mode === "nm" ? "nm" : "minutes",
    minutes: clampModeLineTimeInterval(
      preferences?.minutes ?? DEFAULT_RADAR_MODE_LINE_PREFERENCES.minutes,
    ),
    distanceNm: clampDistanceInterval(
      preferences?.distanceNm ??
        DEFAULT_RADAR_MODE_LINE_PREFERENCES.distanceNm,
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
    minutes: parseTrailTimeIntervalCookie(
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

export function getStoredRadarModeLinePreferences(): RadarModeLinePreferences {
  const enabledCookie = getCookie(RADAR_MODE_LINE_ENABLED_COOKIE);
  const modeCookie = getCookie(RADAR_MODE_LINE_MODE_COOKIE);

  return normalizeRadarModeLinePreferences({
    enabled:
      enabledCookie === null
        ? undefined
        : enabledCookie === "true" || enabledCookie === "1",
    mode:
      modeCookie === "minutes" || modeCookie === "nm" ? modeCookie : undefined,
    minutes: parseModeLineTimeIntervalCookie(
      getCookie(RADAR_MODE_LINE_MINUTES_COOKIE),
      DEFAULT_RADAR_MODE_LINE_PREFERENCES.minutes,
    ),
    distanceNm: parseDistanceIntervalCookie(
      getCookie(RADAR_MODE_LINE_DISTANCE_COOKIE),
      DEFAULT_RADAR_MODE_LINE_PREFERENCES.distanceNm,
    ),
  });
}

export function setStoredRadarModeLinePreferences(
  preferences: RadarModeLinePreferences,
): RadarModeLinePreferences {
  const normalized = normalizeRadarModeLinePreferences(preferences);
  setCookie(
    RADAR_MODE_LINE_ENABLED_COOKIE,
    normalized.enabled ? "true" : "false",
  );
  setCookie(RADAR_MODE_LINE_MODE_COOKIE, normalized.mode);
  setCookie(RADAR_MODE_LINE_MINUTES_COOKIE, String(normalized.minutes));
  setCookie(RADAR_MODE_LINE_DISTANCE_COOKIE, String(normalized.distanceNm));
  return normalized;
}
