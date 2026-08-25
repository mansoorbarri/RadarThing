export interface AirlineTelephony {
  icao: string;
  name: string;
  telephonyDesignator: string;
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

  const icao = getIcaoAirlineDesignator(normalizedFlightIdentifier);
  if (!icao) return telephony;

  const flightId = normalizedFlightIdentifier.slice(icao.length).trim();
  return flightId ? `${telephony} ${flightId}` : telephony;
}
