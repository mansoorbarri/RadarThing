import { useEffect, useState } from "react";
import { type AirportChart } from "~/types/airportCharts";

const memoryCache = new Map<string, AirportChart | null>();
const STORAGE_KEY = "radarthing-airport-charts";

function loadFromStorage(): Record<string, AirportChart> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveToStorage(data: Record<string, AirportChart>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useAirportChart(icao?: string) {
  const [chart, setChart] = useState<AirportChart | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!icao) return;

    const key = icao.toUpperCase();

    if (memoryCache.has(key)) {
      setChart(memoryCache.get(key) ?? null);
      return;
    }

    const stored = loadFromStorage();
    if (stored[key]) {
      memoryCache.set(key, stored[key]);
      setChart(stored[key]);
      return;
    }

    setLoading(true);

    fetch(`/api/charts/${key}`)
      .then((res) => res.json())
      .then((data) => {
        memoryCache.set(key, data.chart ?? null);
        setChart(data.chart ?? null);

        if (data.chart) {
          saveToStorage({ ...stored, [key]: data.chart });
        }
      })
      .finally(() => setLoading(false));
  }, [icao]);

  return { chart, loading };
}