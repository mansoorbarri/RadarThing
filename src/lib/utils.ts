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

  const firstWord = cleaned.split(/[\s-]/)[0];
  return firstWord || null;
}
