import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
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

  const firstWord = cleaned.split(/[\s-]/)[0];
  return firstWord || null;
}
