const US_CHART_PREFIXES = [
  "K",
  "PA",
  "PF",
  "PH",
  "PJ",
  "PO",
  "PP",
  "TJ",
] as const;

const US_CHART_ICAO_ALLOWLIST = new Set([
  "NSTU",
  "PGUM",
  "PGSN",
  "PGRO",
  "PGWT",
  "TIST",
  "TISX",
]);

export function isFreeChartIcao(icao: string | null | undefined): boolean {
  if (!icao) return false;

  const normalized = icao.trim().toUpperCase();
  if (!normalized) return false;

  return (
    US_CHART_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ||
    US_CHART_ICAO_ALLOWLIST.has(normalized)
  );
}
