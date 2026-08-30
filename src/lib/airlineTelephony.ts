export interface AirlineTelephony {
  icao: string;
  name: string;
  telephonyDesignator: string;
}

export function getAirlineDesignator(
  flightIdentifier: string | null | undefined,
): string | null {
  const normalized = flightIdentifier?.trim().toUpperCase();
  if (!normalized) return null;

  const icaoMatch = /^([A-Z]{3})(?=[0-9])/.exec(normalized);
  if (icaoMatch) return icaoMatch[1] ?? null;

  const iataMatch = /^([A-Z0-9]{2})(?=[0-9])/.exec(normalized);
  const iata = iataMatch?.[1];
  return iata && /[A-Z]/.test(iata) ? iata : null;
}

export function getIcaoAirlineDesignator(
  flightIdentifier: string | null | undefined,
): string | null {
  const normalized = flightIdentifier?.trim().toUpperCase();
  if (!normalized) return null;

  const match = /^([A-Z]{3})(?=[0-9])/.exec(normalized);
  return match?.[1] ?? null;
}

export function formatTelephonyCallsign(
  flightIdentifier: string | null | undefined,
  telephonyDesignator: string | null | undefined,
): string | null {
  const telephony = telephonyDesignator?.trim().toUpperCase();
  const normalizedFlightIdentifier = flightIdentifier?.trim().toUpperCase();
  if (!telephony || !normalizedFlightIdentifier) return null;

  const airlineDesignator = getAirlineDesignator(normalizedFlightIdentifier);
  if (!airlineDesignator) return telephony;

  const flightId = normalizedFlightIdentifier
    .slice(airlineDesignator.length)
    .trim();
  return flightId ? `${telephony} ${flightId}` : telephony;
}
