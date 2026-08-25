import { getAircraftCategories } from "./aircraftCategories";
import { getAircraftTypeLookupCandidates } from "./utils";

/**
 * ICAO designators used by manufacturers for factory and test flights.
 * Keep this list limited to callsigns used by approved generic images.
 */
export function getAircraftFactoryCallsignCandidates(
  aircraftType: string | undefined,
): string[] {
  const factoryCallsigns = new Set<string>();
  const categories = getAircraftCategories(aircraftType);
  const aircraftTypes = getAircraftTypeLookupCandidates(aircraftType);

  if (categories.includes("airbus")) {
    factoryCallsigns.add("AIB");
  }

  if (categories.includes("boeing")) {
    factoryCallsigns.add("BOE");
  }

  if (aircraftTypes.some((type) => /^(E\d{3}|ERJ\d{3})$/.test(type))) {
    factoryCallsigns.add("EMB");
  }

  if (aircraftTypes.some((type) => /^(CRJ\d*|CL\d{2}|LJ\d{2})$/.test(type))) {
    factoryCallsigns.add("BBA");
  }

  return Array.from(factoryCallsigns);
}
