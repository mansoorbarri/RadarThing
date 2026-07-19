import { getCookie, setCookie } from "~/lib/cookies";

export type RadarKeybindAction =
  | "follow"
  | "toggleUi"
  | "cycleDisplay"
  | "headingMode";

export type RadarKeybindPreferences = Record<RadarKeybindAction, string>;

const COOKIE_NAMES: Record<RadarKeybindAction, string> = {
  follow: "radar_keybind_follow",
  toggleUi: "radar_keybind_toggle_ui",
  cycleDisplay: "radar_keybind_cycle_display",
  headingMode: "radar_keybind_heading_mode",
};

export const DEFAULT_RADAR_KEYBINDS: RadarKeybindPreferences = {
  follow: "KeyF",
  toggleUi: "KeyU",
  cycleDisplay: "KeyL",
  headingMode: "KeyT",
};

function isSupportedCode(value: string | null): value is string {
  return Boolean(
    value && /^(Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2]))$/.test(value),
  );
}

export function getStoredRadarKeybindPreferences(): RadarKeybindPreferences {
  return Object.fromEntries(
    (Object.keys(DEFAULT_RADAR_KEYBINDS) as RadarKeybindAction[]).map(
      (action) => {
        const value = getCookie(COOKIE_NAMES[action]);
        return [
          action,
          isSupportedCode(value) ? value : DEFAULT_RADAR_KEYBINDS[action],
        ];
      },
    ),
  ) as RadarKeybindPreferences;
}

export function setStoredRadarKeybindPreferences(
  preferences: RadarKeybindPreferences,
): RadarKeybindPreferences {
  const normalized = getNormalizedRadarKeybindPreferences(preferences);
  (Object.keys(normalized) as RadarKeybindAction[]).forEach((action) => {
    setCookie(COOKIE_NAMES[action], normalized[action]);
  });
  return normalized;
}

export function getNormalizedRadarKeybindPreferences(
  preferences: Partial<RadarKeybindPreferences>,
): RadarKeybindPreferences {
  return {
    follow: isSupportedCode(preferences.follow)
      ? preferences.follow
      : DEFAULT_RADAR_KEYBINDS.follow,
    toggleUi: isSupportedCode(preferences.toggleUi)
      ? preferences.toggleUi
      : DEFAULT_RADAR_KEYBINDS.toggleUi,
    cycleDisplay: isSupportedCode(preferences.cycleDisplay)
      ? preferences.cycleDisplay
      : DEFAULT_RADAR_KEYBINDS.cycleDisplay,
    headingMode: isSupportedCode(preferences.headingMode)
      ? preferences.headingMode
      : DEFAULT_RADAR_KEYBINDS.headingMode,
  };
}

export function formatRadarKeybind(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}
