const AIRLINE_CODE_PATTERN = /^[A-Z0-9]{2,3}$/;

export function getAirlineCodeCandidates(value?: string): string[] {
  if (!value) return [];

  const input = value.trim().toUpperCase();
  if (!input) return [];

  const candidates: string[] = [];

  if (AIRLINE_CODE_PATTERN.test(input)) {
    candidates.push(input);
  }

  const icaoCode = /^[A-Z]{3}(?=\d|$)/.exec(input)?.[0];
  if (icaoCode) candidates.push(icaoCode);

  const iataCode = /^[A-Z0-9]{2}(?=\d|$)/.exec(input)?.[0];
  if (iataCode) candidates.push(iataCode);

  const fallbackPrefix = /^[A-Z0-9]{2,3}/.exec(input)?.[0];
  if (fallbackPrefix) {
    candidates.push(fallbackPrefix);
    if (fallbackPrefix.length === 3) {
      candidates.push(fallbackPrefix.slice(0, 2));
    }
  }

  return Array.from(
    new Set(candidates.filter((candidate) => candidate.length >= 2)),
  );
}

export function getAirlineLogoUrl(value?: string): string | null {
  const lookup = value?.trim().toUpperCase();
  if (!lookup) return null;

  return `/api/airline-logo?code=${encodeURIComponent(lookup)}`;
}
