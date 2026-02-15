import { useEffect, useState, useCallback, useRef } from "react";
import type { ChartType, ChartsByType, AirportChart } from "~/types/airportCharts";

const memoryCache = new Map<string, ChartsByType>();
const STORAGE_KEY = "radarthing-airport-charts-v2";

// Cache for viewer state (selected type, chart index) per ICAO
const viewerStateCache = new Map<string, { selectedType: ChartType; selectedChartIndex: number }>();

export function getViewerState(icao: string) {
  return viewerStateCache.get(icao.toUpperCase());
}

export function setViewerState(icao: string, state: { selectedType: ChartType; selectedChartIndex: number }) {
  viewerStateCache.set(icao.toUpperCase(), state);
}

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

  // Initialize from cache if available
  const cachedState = icao ? getViewerState(icao) : undefined;
  const [selectedType, setSelectedTypeInternal] = useState<ChartType>(cachedState?.selectedType ?? "GENERAL");
  const [selectedChartIndex, setSelectedChartIndexInternal] = useState(cachedState?.selectedChartIndex ?? 0);

  // Track if this is the first render with cached state
  const isInitialMount = useRef(!!cachedState);

  // Wrapped setters that also update cache
  const setSelectedType = useCallback((type: ChartType) => {
    setSelectedTypeInternal(type);
    // Reset chart index when changing types (different types have different charts)
    setSelectedChartIndexInternal(0);
    if (icao) {
      setViewerState(icao, { selectedType: type, selectedChartIndex: 0 });
    }
  }, [icao]);

  const setSelectedChartIndex = useCallback((index: number) => {
    setSelectedChartIndexInternal(index);
    if (icao) {
      const current = getViewerState(icao);
      setViewerState(icao, { selectedType: current?.selectedType ?? "GENERAL", selectedChartIndex: index });
    }
  }, [icao]);

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
      setSelectedChartIndexInternal(0);
      return;
    }

    const key = icao.toUpperCase();
    // Only reset state if we don't have cached viewer state for this ICAO
    const hasViewerState = !!getViewerState(key);

    if (memoryCache.has(key)) {
      setCharts(memoryCache.get(key)!);
      if (!hasViewerState) setSelectedChartIndexInternal(0);
      return;
    }

    const stored = loadFromStorage();
    if (stored[key]) {
      memoryCache.set(key, stored[key]);
      setCharts(stored[key]);
      if (!hasViewerState) setSelectedChartIndexInternal(0);
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
        // Always reset when fetching fresh data (no cache existed)
        setSelectedChartIndexInternal(0);

        saveToStorage({ ...stored, [key]: chartData });
      })
      .catch((e) => {
        setError(e.message);
        setCharts(createEmptyChartsByType());
      })
      .finally(() => setLoading(false));
  }, [icao]);

  // Reset initial mount flag after first render
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
  }, []);

  // Auto-select first type with charts if current type is empty
  useEffect(() => {
    if (!charts || charts[selectedType].length > 0) return;
    const types: ChartType[] = ["TAXI", "SID", "STAR", "APPROACH", "GENERAL"];
    const firstWithCharts = types.find((t) => charts[t].length > 0);
    if (firstWithCharts) {
      setSelectedType(firstWithCharts);
    }
  }, [charts, selectedType, setSelectedType]);

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
