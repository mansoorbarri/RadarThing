import type {
  AirportChart,
  ChartType,
  ChartsByType,
} from "~/types/airportCharts";

export const ALL_RUNWAYS_KEY = "all";

export interface RunwayChartGroup {
  key: string;
  label: string;
  charts: AirportChart[];
}

function sortChartsByName(charts: AirportChart[]): AirportChart[] {
  return [...charts].sort((a, b) => a.chartName.localeCompare(b.chartName));
}

function normalizeRunwayNumber(value: string): string {
  return value.padStart(2, "0");
}

function expandRunwayToken(token: string): string[] {
  const segments = token.toUpperCase().split("/");
  const runways: string[] = [];
  let lastRunwayNumber = "";

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const absoluteMatch = /^(\d{1,2})([LCR])?$/.exec(trimmed);
    if (absoluteMatch) {
      lastRunwayNumber = normalizeRunwayNumber(absoluteMatch[1]!);
      runways.push(`${lastRunwayNumber}${absoluteMatch[2] ?? ""}`);
      continue;
    }

    const relativeMatch = /^([LCR])$/.exec(trimmed);
    if (relativeMatch && lastRunwayNumber) {
      runways.push(`${lastRunwayNumber}${relativeMatch[1]}`);
    }
  }

  return [...new Set(runways)];
}

export function getAirportChartKey(chart: AirportChart): string {
  return chart.id ?? `${chart.chartUrl}::${chart.chartName}`;
}

export function extractChartRunways(chartName: string): string[] {
  const normalizedName = chartName.replace(/\.[^.]+$/, "").trim();
  const runwayMatch =
    /(?:\(|\b)RWY\s+([0-9]{1,2}(?:[LCR])?(?:\/(?:[0-9]{1,2}(?:[LCR])?|[LCR]))*)(?:-\d+)?\)?$/i.exec(
      normalizedName,
    );

  if (!runwayMatch?.[1]) {
    return [];
  }

  return expandRunwayToken(runwayMatch[1]);
}

function compareRunwayKeys(a: string, b: string): number {
  const aMatch = /^(\d{2})([LCR]?)$/.exec(a);
  const bMatch = /^(\d{2})([LCR]?)$/.exec(b);

  if (!aMatch || !bMatch) {
    return a.localeCompare(b);
  }

  const numberDiff = Number(aMatch[1]) - Number(bMatch[1]);
  if (numberDiff !== 0) return numberDiff;

  const suffixOrder = { "": 0, L: 1, C: 2, R: 3 };
  return suffixOrder[aMatch[2] as keyof typeof suffixOrder] -
    suffixOrder[bMatch[2] as keyof typeof suffixOrder];
}

export function buildRunwayChartGroups(
  charts: AirportChart[],
): RunwayChartGroup[] {
  const allCharts = sortChartsByName(charts);
  const genericCharts: AirportChart[] = [];
  const runwayBuckets = new Map<string, AirportChart[]>();

  for (const chart of allCharts) {
    const runways = extractChartRunways(chart.chartName);

    if (runways.length === 0) {
      genericCharts.push(chart);
      continue;
    }

    for (const runway of runways) {
      const existingCharts = runwayBuckets.get(runway) ?? [];
      existingCharts.push(chart);
      runwayBuckets.set(runway, existingCharts);
    }
  }

  const runwayKeys = [...runwayBuckets.keys()].sort(compareRunwayKeys);
  const groups: RunwayChartGroup[] = [
    {
      key: ALL_RUNWAYS_KEY,
      label: "All",
      charts: allCharts,
    },
  ];

  for (const runwayKey of runwayKeys) {
    const chartsForRunway = runwayBuckets.get(runwayKey) ?? [];
    const mergedCharts = sortChartsByName([...chartsForRunway, ...genericCharts]);
    groups.push({
      key: runwayKey,
      label: `RWY ${runwayKey}`,
      charts: mergedCharts,
    });
  }

  return groups;
}

/**
 * Organize charts by type
 */
export function organizeChartsByType(charts: AirportChart[]): ChartsByType {
  const result: ChartsByType = {
    TAXI: [],
    SID: [],
    STAR: [],
    APPROACH: [],
  };

  for (const chart of charts) {
    result[chart.chartType].push(chart);
  }

  // Sort charts within each type by name
  for (const type of Object.keys(result) as ChartType[]) {
    result[type] = sortChartsByName(result[type]);
  }

  return result;
}

/**
 * Get chart counts by type
 */
export function getChartCounts(
  charts: AirportChart[],
): Record<ChartType, number> {
  const organized = organizeChartsByType(charts);
  return {
    TAXI: organized.TAXI.length,
    SID: organized.SID.length,
    STAR: organized.STAR.length,
    APPROACH: organized.APPROACH.length,
  };
}

/**
 * Check if any charts are available
 */
export function hasChartsAvailable(charts: AirportChart[]): boolean {
  return charts.length > 0;
}
