/**
 * Unit formatting utilities for the radar display.
 *
 * Speed can be shown in knots (kts) or Mach.
 * Altitude can be shown in feet, flight level (FL), or auto (FL above 18 000 ft).
 */

export type SpeedUnit = "kts" | "mach";
export type AltitudeUnit = "auto" | "feet" | "fl";

export interface UnitPreferences {
  speedUnit: SpeedUnit;
  altitudeUnit: AltitudeUnit;
}

export const DEFAULT_UNIT_PREFERENCES: UnitPreferences = {
  speedUnit: "kts",
  altitudeUnit: "auto",
};

/**
 * Approximate speed of sound (kts) at a given altitude (ft) using ISA model.
 */
function speedOfSoundKts(altFt: number): number {
  const altM = altFt * 0.3048;
  // Temperature in ISA below tropopause (11 000 m)
  const tempK = 288.15 - 0.0065 * Math.min(altM, 11000);
  // speed of sound = 661.5 * sqrt(T / 288.15)  (kts at sea-level reference)
  return 661.5 * Math.sqrt(tempK / 288.15);
}

/** Format speed value for display. */
export function formatSpeed(
  speedKts: number,
  unit: SpeedUnit,
  altFt = 0,
): string {
  if (unit === "mach") {
    const sos = speedOfSoundKts(altFt);
    const mach = speedKts / sos;
    return mach.toFixed(2);
  }
  return String(Math.round(speedKts));
}

/** The label shown below the speed value. */
export function speedLabel(unit: SpeedUnit): string {
  return unit === "mach" ? "MACH GS" : "KNOTS GS";
}

/** Short unit suffix appended inline. */
export function speedSuffix(unit: SpeedUnit): string {
  return unit === "mach" ? "M" : "kt";
}

/** Format altitude value for display. */
export function formatAltitude(
  altFt: number,
  unit: AltitudeUnit,
): string {
  switch (unit) {
    case "fl":
      return `FL${String(Math.round(altFt / 100)).padStart(3, "0")}`;
    case "feet":
      return Math.round(altFt).toLocaleString();
    case "auto":
    default:
      return altFt >= 18000
        ? `FL${Math.round(altFt / 100)}`
        : Math.round(altFt).toLocaleString();
  }
}

/** The label shown below the altitude value. */
export function altitudeLabel(unit: AltitudeUnit): string {
  switch (unit) {
    case "fl":
      return "FL MSL";
    case "feet":
      return "FT MSL";
    case "auto":
    default:
      return "FT MSL";
  }
}
