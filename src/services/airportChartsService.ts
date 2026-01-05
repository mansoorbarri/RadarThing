import {
  type AirportChart,
  type AirportChartIndex,
} from "~/types/airportCharts";

const CHARTS_URL =
  "https://raw.githubusercontent.com/mansoorbarri/geofs-charts/main/charts.json";
const OPENNAV_URL = "https://opennav.com/diagrams";

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

async function checkOpenNav(icao: string): Promise<string | null> {
  try {
    const url = `${OPENNAV_URL}/${icao.toUpperCase()}.svg`;
    const res = await fetch(url, { method: "HEAD" });
    
    if (res.ok) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getAirportChart(
  icao: string,
): Promise<AirportChart | null> {
  const upperIcao = icao.toUpperCase();
  
  // First, check OpenNav
  const openNavUrl = await checkOpenNav(upperIcao);
  if (openNavUrl) {
    return {
      name: upperIcao,
      taxi_chart_url: openNavUrl,
    };
  }

  // Fall back to JSON file
  const charts = await loadAirportCharts();
  return charts[upperIcao] ?? null;
}