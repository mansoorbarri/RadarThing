import {
  type AirportChart,
  type AirportChartIndex,
} from "~/types/airportCharts";

const CHARTS_URL =
  "https://raw.githubusercontent.com/mansoorbarri/geofs-charts/main/charts.json";

let cache: AirportChartIndex | null = null;
let lastFetch = 0;
const CACHE_TTL = 1000 * 60 * 60;

export async function loadAirportCharts(): Promise<AirportChartIndex> {
  const now = Date.now();

  if (cache && now - lastFetch < CACHE_TTL) {
    return cache;
  }

  const res = await fetch(CHARTS_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to load airport charts");
  }

  const data = (await res.json()) as AirportChartIndex;
  cache = data;
  lastFetch = now;
  return data;
}

export async function getAirportChart(
  icao: string,
): Promise<AirportChart | null> {
  const charts = await loadAirportCharts();
  return charts[icao.toUpperCase()] ?? null;
}
