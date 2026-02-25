// ICAO prefix to region mapping
const prefixToRegion: Record<string, string> = {
  K: "North America (US)",
  C: "Canada",
  E: "Europe",
  L: "Europe",
  V: "Asia",
  Z: "Asia",
  R: "Asia",
  W: "Asia",
  O: "Middle East",
  D: "Africa",
  F: "Africa",
  G: "Africa",
  H: "Africa",
  S: "South America",
  Y: "Oceania",
  N: "Oceania",
};

export function getRegionForICAO(icao: string): string | null {
  if (!icao || icao.length === 0) return null;
  const prefix = icao.charAt(0).toUpperCase();
  return prefixToRegion[prefix] ?? null;
}

export function icaoMatchesPrefixes(
  icao: string,
  prefixes: string[],
): boolean {
  if (!icao || icao.length === 0) return false;
  const upper = icao.toUpperCase();
  return prefixes.some((p) => upper.startsWith(p.toUpperCase()));
}
