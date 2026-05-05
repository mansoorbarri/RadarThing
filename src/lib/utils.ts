import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function normalizeCallsign(callsign: string | undefined): string {
  return String(callsign || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/** Normalize aircraft type (e.g., "Boeing 777-300ER" -> "B777", "Airbus A350-900" -> "A350") */
export function normalizeAircraftType(type: string | undefined): string | null {
  if (!type) return null;
  const cleaned = type.trim().toUpperCase();

  const airbusMatch = /A\d{3}/.exec(cleaned);
  if (airbusMatch) return airbusMatch[0];

  const boeingMatch = /B\d{3}/.exec(cleaned);
  if (boeingMatch) return boeingMatch[0];

  const boeingNameMatch = /\b(7[0-9]7)\b/.exec(cleaned);
  if (boeingNameMatch) return `B${boeingNameMatch[1]}`;

  const embraerMatch = /E\d{3}|ERJ\d{3}|CRJ\d{3}/.exec(cleaned);
  if (embraerMatch) return embraerMatch[0];

  // ATR aliases: "ATR 72-600", "ATR72", "ATR-42", "AT72" -> "ATR72", "ATR42"
  const atrMatch = /\bATR?[\s-]?(\d{2})\b/.exec(cleaned);
  if (atrMatch) return `ATR${atrMatch[1]}`;

  // GA: Piper "PA-28", "PA-44", etc. -> "PA28", "PA44"
  const piperMatch = /PA-?(\d{2,3})/.exec(cleaned);
  if (piperMatch) return `PA${piperMatch[1]}`;

  // GA: Cessna "172", "152", "182", "206", "210" -> "C172", "C152", etc.
  const cessnaMatch = /\bCESSNA\s+(\d{3})/.exec(cleaned);
  if (cessnaMatch) return `C${cessnaMatch[1]}`;
  // Already short format "C172"
  const cessnaShort = /\bC(\d{3})\b/.exec(cleaned);
  if (cessnaShort) return `C${cessnaShort[1]}`;

  // GA: Cirrus "SR20", "SR22" -> "SR20", "SR22"
  const cirrusMatch = /SR\d{2}/.exec(cleaned);
  if (cirrusMatch) return cirrusMatch[0];

  // GA: Diamond "DA40", "DA42", "DA62" -> "DA40", "DA42", "DA62"
  const diamondMatch = /DA\d{2}/.exec(cleaned);
  if (diamondMatch) return diamondMatch[0];

  // GA: Beechcraft "BE36", "BE58", "King Air 350" etc.
  const beechMatch = /BE\d{2}/.exec(cleaned);
  if (beechMatch) return beechMatch[0];

  // McDonnell Douglas: "MD-11", "MD-80", "MD-90" -> "MD11", "MD80", "MD90"
  const mdMatch = /MD-?(\d{2,3})/.exec(cleaned);
  if (mdMatch) return `MD${mdMatch[1]}`;

  // Douglas: "DC-10", "DC-8", "DC-9" -> "DC10", "DC8", "DC9"
  const dcMatch = /DC-?(\d{1,2})/.exec(cleaned);
  if (dcMatch) return `DC${dcMatch[1]}`;

  // Lockheed: "L-1011", "L1011" -> "L1011"
  const lockheedMatch = /L-?(1011)\b/.exec(cleaned);
  if (lockheedMatch) return `L${lockheedMatch[1]}`;

  // Military: Sukhoi "SU-35", "SU-27", "SU-57" -> "SU35", "SU27", "SU57"
  const suMatch = /SU-?(\d{2,3})/.exec(cleaned);
  if (suMatch) return `SU${suMatch[1]}`;

  // Military: Mikoyan "MIG-29", "MIG-21", "MIG-31" -> "MIG29", "MIG21", "MIG31"
  const migMatch = /MIG-?(\d{2})/.exec(cleaned);
  if (migMatch) return `MIG${migMatch[1]}`;

  // Military: Tupolev "TU-95", "TU-160", "TU-22" -> "TU95", "TU160", "TU22"
  const tuMatch = /TU-?(\d{2,3})/.exec(cleaned);
  if (tuMatch) return `TU${tuMatch[1]}`;

  // Military: US designations "F-16", "F-22", "F-35", "F-35B", "B-2", "B-52", "C-17", "KC-135", "AH-64", "UH-60"
  const milMatch = /\b(KC|AH|UH|CH|MH|HH|[FBTCA])-?(\d{1,3})\b/.exec(cleaned);
  if (milMatch) return `${milMatch[1]}${milMatch[2]}`;

  // Military suffix variants should normalize to the base airframe for lookup
  // while still allowing callers to try the full variant separately.
  const milVariantMatch =
    /\b(KC|AH|UH|CH|MH|HH|[FBTCA])-?(\d{1,3})([A-Z])\b/.exec(cleaned);
  if (milVariantMatch) return `${milVariantMatch[1]}${milVariantMatch[2]}`;

  const firstWord = cleaned.split(/[\s-]/)[0];
  return firstWord || null;
}

export function getAircraftTypeLookupCandidates(
  type: string | undefined,
): string[] {
  if (!type) return [];

  const cleaned = type.trim().toUpperCase();
  if (!cleaned) return [];

  const candidates = new Set<string>();
  const normalized = normalizeAircraftType(type);

  if (normalized) {
    candidates.add(normalized);
  }

  // Preserve military suffix variants such as F-35B when available,
  // while still trying the base model first (F35).
  const militaryVariantMatch =
    /\b(KC|AH|UH|CH|MH|HH|[FBTCA])-?(\d{1,3})([A-Z])\b/.exec(cleaned);
  if (militaryVariantMatch) {
    candidates.add(
      `${militaryVariantMatch[1]}${militaryVariantMatch[2]}`,
    );
    candidates.add(
      `${militaryVariantMatch[1]}${militaryVariantMatch[2]}${militaryVariantMatch[3]}`,
    );
  }

  return Array.from(candidates);
}
