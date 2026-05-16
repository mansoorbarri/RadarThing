import { normalizeAircraftType } from "~/lib/utils";

export type AircraftWakeCategory =
  | "Light"
  | "Large"
  | "Heavy"
  | "Super";

const SUPER_TYPES = new Set(["A380", "AN225"]);
const HEAVY_TYPES = new Set([
  "A300",
  "A310",
  "A330",
  "A340",
  "A350",
  "B747",
  "B767",
  "B777",
  "B787",
  "MD11",
  "DC10",
  "L1011",
  "IL96",
  "C17",
  "C5",
]);
const LARGE_TYPES = new Set([
  "A220",
  "A318",
  "A319",
  "A320",
  "A321",
  "A400M",
  "ATR42",
  "ATR72",
  "B707",
  "B717",
  "B727",
  "B737",
  "B757",
  "BAE146",
  "C130",
  "CRJ",
  "DH8D",
  "E170",
  "E175",
  "E190",
  "E195",
  "ERJ145",
  "FA7X",
  "F100",
  "F70",
  "GLF5",
]);
const LIGHT_TYPE_PATTERNS = [
  /^(C\d{3}|PA\d{2,3}|SR\d{2}|DA\d{2}|BE\d{2}|LJ\d{0,2})$/,
  /^(AH|UH|CH|MH|HH)\d{1,3}$/,
] as const;

function normalizeWakeCategoryKey(type: string) {
  const cleaned = type.trim().toUpperCase();
  const normalized = normalizeAircraftType(type) ?? cleaned;

  if (SUPER_TYPES.has(normalized)) return normalized;
  if (HEAVY_TYPES.has(normalized)) return normalized;
  if (LARGE_TYPES.has(normalized)) return normalized;

  if (/\bA?20N\b/.test(cleaned)) return "A320";
  if (/\bA?21N\b/.test(cleaned)) return "A321";
  if (/\bA?223\b/.test(cleaned)) return "A220";
  if (/\bA?306\b|\bA?30B\b/.test(cleaned)) return "A300";
  if (/\bA?332\b|\bA?333\b|\bA?338\b|\bA?339\b/.test(cleaned)) return "A330";
  if (/\bA?342\b|\bA?343\b|\bA?345\b|\bA?346\b/.test(cleaned)) return "A340";
  if (/\bA?359\b|\bA?35K\b/.test(cleaned)) return "A350";
  if (/\bA?388\b/.test(cleaned)) return "A380";

  if (/\bB?73[0-9A-Z]\b|\b73[0-9A-Z]\b/.test(cleaned)) return "B737";
  if (/\bB?74[0-9A-Z]\b|\b74[0-9A-Z]\b/.test(cleaned)) return "B747";
  if (/\bB?75[0-9A-Z]\b|\b75[0-9A-Z]\b/.test(cleaned)) return "B757";
  if (/\bB?76[0-9A-Z]\b|\b76[0-9A-Z]\b/.test(cleaned)) return "B767";
  if (/\bB?77[0-9A-Z]\b|\b77[0-9A-Z]\b/.test(cleaned)) return "B777";
  if (/\bB?78[0-9A-Z]\b|\b78[0-9A-Z]\b/.test(cleaned)) return "B787";

  if (/\bE75[LS]?\b/.test(cleaned)) return "E175";
  if (/\bE190\b|\bE90[LS]?\b/.test(cleaned)) return "E190";
  if (/\bE195\b|\bE95[LS]?\b/.test(cleaned)) return "E195";
  if (/\bERJ[- ]?1?(35|40|45)\b|\bE145\b/.test(cleaned)) return "ERJ145";
  if (/\bCRJ[- ]?[1279]\d{2}\b|\bCR[1279]\b|\bCL65\b/.test(cleaned)) {
    return "CRJ";
  }

  if (/\bAT7[26]\b/.test(cleaned)) return "ATR72";
  if (/\bAT4[26]\b/.test(cleaned)) return "ATR42";
  if (/\bDH8[ABCD]?\b|\bQ4?00\b/.test(cleaned)) return "DH8D";

  if (/\bC17\b/.test(cleaned)) return "C17";
  if (/\bC130\b|\bL100\b/.test(cleaned)) return "C130";
  if (/\bC5\b/.test(cleaned)) return "C5";
  if (/\bA400M\b/.test(cleaned)) return "A400M";

  if (/\bFA7X\b|\bFA8X\b/.test(cleaned)) return "FA7X";
  if (/\bGLF[3456]\b|\bG[4-8]00\b|\bGLEX\b|\bGALX\b/.test(cleaned)) {
    return "GLF5";
  }

  return normalized;
}

export function getAircraftWakeCategory(
  type: string | undefined,
): AircraftWakeCategory | null {
  if (!type) return null;

  const raw = type.trim().toUpperCase();
  if (!raw) return null;

  if (/\bSUPER\b/.test(raw)) return "Super";
  if (/\bHEAVY\b/.test(raw)) return "Heavy";
  if (/\bLIGHT\b/.test(raw)) return "Light";
  if (/\bLARGE\b/.test(raw)) return "Large";

  const normalized = normalizeWakeCategoryKey(type);

  if (SUPER_TYPES.has(normalized)) return "Super";
  if (HEAVY_TYPES.has(normalized)) return "Heavy";
  if (LARGE_TYPES.has(normalized)) return "Large";
  if (LIGHT_TYPE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "Light";
  }

  if (
    /\b(CESSNA|PIPER|CIRRUS|DIAMOND|MOONEY|BONANZA|BARON|SKYHAWK|SKYLANE|SENECA|SEMINOLE|BEECHCRAFT)\b/.test(
      raw,
    )
  ) {
    return "Light";
  }

  if (
    /\b(AIRBUS|BOEING|EMBRAER|BOMBARDIER|CANADAIR|ATR|DASH[ -]?8|TURBOPROP|REGIONAL)\b/.test(
      raw,
    )
  ) {
    return "Large";
  }

  return null;
}
