import { getCookie, setCookie } from "~/lib/cookies";
import {
  DEFAULT_RUNWAY_CENTERLINE_PREFERENCES,
  clampRunwayCenterlineLength,
  normalizeRunwayCenterlinePreferences,
  type RunwayCenterlinePreferences,
} from "~/lib/runwayCenterlines";

const RUNWAY_CENTERLINE_ENABLED_COOKIE = "runway_centerline_enabled";
const RUNWAY_CENTERLINE_LENGTH_COOKIE = "runway_centerline_length_nm";

function parseLengthCookie(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed)
    ? clampRunwayCenterlineLength(parsed)
    : fallback;
}

export function getStoredRunwayCenterlinePreferences(): RunwayCenterlinePreferences {
  const enabledCookie = getCookie(RUNWAY_CENTERLINE_ENABLED_COOKIE);

  return normalizeRunwayCenterlinePreferences({
    enabled:
      enabledCookie === null
        ? undefined
        : enabledCookie === "true" || enabledCookie === "1",
    lengthNm: parseLengthCookie(
      getCookie(RUNWAY_CENTERLINE_LENGTH_COOKIE),
      DEFAULT_RUNWAY_CENTERLINE_PREFERENCES.lengthNm,
    ),
  });
}

export function setStoredRunwayCenterlinePreferences(
  preferences: RunwayCenterlinePreferences,
): RunwayCenterlinePreferences {
  const normalized = normalizeRunwayCenterlinePreferences(preferences);
  setCookie(
    RUNWAY_CENTERLINE_ENABLED_COOKIE,
    normalized.enabled ? "true" : "false",
  );
  setCookie(RUNWAY_CENTERLINE_LENGTH_COOKIE, String(normalized.lengthNm));
  return normalized;
}
