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

const FT_TO_M = 0.3048;
const ISA_SEA_LEVEL_TEMP_K = 288.15;
const ISA_SEA_LEVEL_PRESSURE_PA = 101325;
const ISA_LAPSE_RATE_K_PER_M = 0.0065;
const ISA_TROPOPAUSE_ALT_M = 11000;
const ISA_GAMMA = 1.4;
const ISA_GAS_CONSTANT = 287.05287;
const STD_GRAVITY_MPS2 = 9.80665;
const SEA_LEVEL_SPEED_OF_SOUND_KTS = 661.5;

const ISA_TROPOPAUSE_TEMP_K =
  ISA_SEA_LEVEL_TEMP_K - ISA_LAPSE_RATE_K_PER_M * ISA_TROPOPAUSE_ALT_M;
const ISA_TROPOPAUSE_PRESSURE_PA =
  ISA_SEA_LEVEL_PRESSURE_PA *
  Math.pow(
    ISA_TROPOPAUSE_TEMP_K / ISA_SEA_LEVEL_TEMP_K,
    STD_GRAVITY_MPS2 / (ISA_GAS_CONSTANT * ISA_LAPSE_RATE_K_PER_M),
  );

/**
 * ISA static pressure (Pa) from pressure altitude (ft).
 */
function isaPressurePa(altFt: number): number {
  const altM = Math.max(altFt, 0) * FT_TO_M;

  if (altM <= ISA_TROPOPAUSE_ALT_M) {
    return (
      ISA_SEA_LEVEL_PRESSURE_PA *
      Math.pow(
        1 - (ISA_LAPSE_RATE_K_PER_M * altM) / ISA_SEA_LEVEL_TEMP_K,
        STD_GRAVITY_MPS2 / (ISA_GAS_CONSTANT * ISA_LAPSE_RATE_K_PER_M),
      )
    );
  }

  return (
    ISA_TROPOPAUSE_PRESSURE_PA *
    Math.exp(
      (-STD_GRAVITY_MPS2 * (altM - ISA_TROPOPAUSE_ALT_M)) /
        (ISA_GAS_CONSTANT * ISA_TROPOPAUSE_TEMP_K),
    )
  );
}

/**
 * Estimate Mach from indicated airspeed using a standard-atmosphere pressure altitude model.
 *
 * The stream currently provides KIAS, not TAS/GS, so the old `speed / local speed of sound`
 * approach substantially under-reported cruise Mach. This is still an estimate because IAS is
 * not perfectly equal to CAS and real atmospheric conditions vary from ISA.
 */
function estimateMachFromKias(speedKias: number, altFt: number): number {
  const clampedKias = Math.max(speedKias, 0);
  const seaLevelMach = clampedKias / SEA_LEVEL_SPEED_OF_SOUND_KTS;
  const gammaFactor = (ISA_GAMMA - 1) / 2;
  const gammaExponent = ISA_GAMMA / (ISA_GAMMA - 1);
  const inverseGammaExponent = (ISA_GAMMA - 1) / ISA_GAMMA;
  const impactPressurePa =
    ISA_SEA_LEVEL_PRESSURE_PA *
    (Math.pow(1 + gammaFactor * seaLevelMach ** 2, gammaExponent) - 1);
  const staticPressurePa = isaPressurePa(altFt);

  return Math.sqrt(
    ((2 / (ISA_GAMMA - 1)) *
      (Math.pow(impactPressurePa / staticPressurePa + 1, inverseGammaExponent) -
        1)),
  );
}

/** Format speed value for display. */
export function formatSpeed(
  speedKts: number,
  unit: SpeedUnit,
  altFt = 0,
): string {
  if (unit === "mach") {
    const mach = estimateMachFromKias(speedKts, altFt);
    return mach.toFixed(2);
  }
  return String(Math.round(speedKts));
}

/** The label shown below the speed value. */
export function speedLabel(unit: SpeedUnit): string {
  return unit === "mach" ? "MACH EST" : "KNOTS IAS";
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
