import { useEffect, useState, useCallback } from "react";
import type { ChartType, ChartsByType, AirportChart } from "~/types/airportCharts";

const memoryCache = new Map<string, ChartsByType>();
const STORAGE_KEY = "radarthing-airport-charts-v2";

function loadFromStorage(): Record<string, ChartsByType> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveToStorage(data: Record<string, ChartsByType>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function createEmptyChartsByType(): ChartsByType {
  return {
    TAXI: [],
    SID: [],
    STAR: [],
    APPROACH: [],
    GENERAL: [],
  };
}

export function useAirportCharts(icao?: string) {
  const [charts, setCharts] = useState<ChartsByType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ChartType>("GENERAL");
  const [selectedChartIndex, setSelectedChartIndex] = useState(0);

  const refetch = useCallback(() => {
    if (!icao) return;

    const key = icao.toUpperCase();
    memoryCache.delete(key);

    const stored = loadFromStorage();
    delete stored[key];
    saveToStorage(stored);

    setLoading(true);
    setError(null);

    fetch(`/api/charts/${key}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to fetch charts");
        }
        return res.json();
      })
      .then((data) => {
        const chartData = data.charts ?? createEmptyChartsByType();
        memoryCache.set(key, chartData);
        setCharts(chartData);

        const newStored = loadFromStorage();
        saveToStorage({ ...newStored, [key]: chartData });
      })
      .catch((e) => {
        setError(e.message);
        setCharts(createEmptyChartsByType());
      })
      .finally(() => setLoading(false));
  }, [icao]);

  useEffect(() => {
    if (!icao) {
      setCharts(null);
      setSelectedChartIndex(0);
      return;
    }

    const key = icao.toUpperCase();

    if (memoryCache.has(key)) {
      setCharts(memoryCache.get(key)!);
      setSelectedChartIndex(0);
      return;
    }

    const stored = loadFromStorage();
    if (stored[key]) {
      memoryCache.set(key, stored[key]);
      setCharts(stored[key]);
      setSelectedChartIndex(0);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/charts/${key}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to fetch charts");
        }
        return res.json();
      })
      .then((data) => {
        const chartData = data.charts ?? createEmptyChartsByType();
        memoryCache.set(key, chartData);
        setCharts(chartData);
        setSelectedChartIndex(0);

        saveToStorage({ ...stored, [key]: chartData });
      })
      .catch((e) => {
        setError(e.message);
        setCharts(createEmptyChartsByType());
      })
      .finally(() => setLoading(false));
  }, [icao]);

  // Reset selected chart index when type changes
  useEffect(() => {
    setSelectedChartIndex(0);
  }, [selectedType]);

  // Get current charts for selected type
  const currentCharts = charts?.[selectedType] ?? [];
  const selectedChart = currentCharts[selectedChartIndex] ?? null;

  // Get chart counts
  const chartCounts: Record<ChartType, number> = charts
    ? {
        TAXI: charts.TAXI.length,
        SID: charts.SID.length,
        STAR: charts.STAR.length,
        APPROACH: charts.APPROACH.length,
        GENERAL: charts.GENERAL.length,
      }
    : { TAXI: 0, SID: 0, STAR: 0, APPROACH: 0, GENERAL: 0 };

  const totalCharts = Object.values(chartCounts).reduce((a, b) => a + b, 0);

  return {
    charts,
    loading,
    error,
    selectedType,
    setSelectedType,
    selectedChartIndex,
    setSelectedChartIndex,
    currentCharts,
    selectedChart,
    chartCounts,
    totalCharts,
    refetch,
  };
}

// Legacy hook for backward compatibility
export function useAirportChart(icao?: string) {
  const { charts, loading } = useAirportCharts(icao);

  // Return first taxi chart in legacy format
  const chart =
    charts?.TAXI[0]
      ? {
          name: charts.TAXI[0].chartName,
          taxi_chart_url: charts.TAXI[0].chartUrl,
        }
      : null;

  return { chart, loading };
}
