import type {
  AirportChart,
  ChartType,
  ChartsByType,
} from "~/types/airportCharts";

/**
 * Organize charts by type
 */
export function organizeChartsByType(charts: AirportChart[]): ChartsByType {
  const result: ChartsByType = {
    TAXI: [],
    SID: [],
    STAR: [],
    APPROACH: [],
    GENERAL: [],
  };

  for (const chart of charts) {
    result[chart.chartType].push(chart);
  }

  // Sort charts within each type by name
  for (const type of Object.keys(result) as ChartType[]) {
    result[type].sort((a, b) => a.chartName.localeCompare(b.chartName));
  }

  return result;
}

/**
 * Get chart counts by type
 */
export function getChartCounts(charts: AirportChart[]): Record<ChartType, number> {
  const organized = organizeChartsByType(charts);
  return {
    TAXI: organized.TAXI.length,
    SID: organized.SID.length,
    STAR: organized.STAR.length,
    APPROACH: organized.APPROACH.length,
    GENERAL: organized.GENERAL.length,
  };
}

/**
 * Check if any charts are available
 */
export function hasChartsAvailable(charts: AirportChart[]): boolean {
  return charts.length > 0;
}
