import { useCallback, useEffect, useState } from "react";
import type L from "leaflet";

interface MetarData {
  raw?: string;
  flight_category?: string;
  temperature?: { value: number };
  wind_speed?: { value: number };
  visibility?: { value: number };
  time_of_obs?: string;
}

export type MetarStatus = "idle" | "loading" | "ready" | "not-found" | "error";

const REFRESH_MS = 5 * 60 * 1000;

/**
 * Loads the METAR for an airport and refreshes it every 5 minutes. Changing
 * the airport clears the old report and cancels any request still in flight,
 * so a slow or failed lookup can never show another airport's weather.
 */
export const useMetarOverlay = (
  _mapInstance: React.MutableRefObject<L.Map | null>,
  icao: string | undefined,
) => {
  const [metar, setMetar] = useState<MetarData | null>(null);
  const [status, setStatus] = useState<MetarStatus>("idle");
  // The airport the current status belongs to. For one render after the
  // airport changes, status still describes the previous one.
  const [statusIcao, setStatusIcao] = useState<string | null>(null);
  // Bumped by retry() to run the lookup again straight away.
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    setMetar(null);
    if (!icao || icao.length < 4) {
      setStatus("idle");
      return;
    }

    let controller: AbortController | null = null;
    const fetchMetar = async (isRefresh: boolean) => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      if (!isRefresh) setStatus("loading");
      try {
        const res = await fetch(
          `/api/weather/metar?icao=${encodeURIComponent(icao)}`,
          { signal: current.signal },
        );
        // AVWX answers an unknown station with 400/404, or 204 when it has
        // no current report.
        if (res.status === 400 || res.status === 404 || res.status === 204) {
          setMetar(null);
          setStatus("not-found");
          return;
        }
        if (!res.ok) throw new Error(`METAR request failed (${res.status})`);
        const data = (await res.json()) as MetarData | null;
        if (current.signal.aborted) return;
        if (!data?.raw) {
          setMetar(null);
          setStatus("not-found");
          return;
        }
        setMetar(data);
        setStatus("ready");
        setStatusIcao(icao);
      } catch (err) {
        if (current.signal.aborted) return;
        console.error("METAR fetch error:", err);
        // Keep a report we already have on a failed background refresh.
        if (!isRefresh) {
          setMetar(null);
          setStatus("error");
        }
      }
    };
    void fetchMetar(false);

    const interval = setInterval(() => void fetchMetar(true), REFRESH_MS);
    return () => {
      clearInterval(interval);
      controller?.abort();
    };
  }, [icao, attempt]);

  return { metar, status, statusIcao, retry };
};
