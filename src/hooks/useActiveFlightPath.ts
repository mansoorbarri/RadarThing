"use client";

import { useEffect, useState } from "react";
import { type PositionUpdate } from "~/lib/aircraft-store";

const ACTIVE_FLIGHT_PATH_API_URL =
  "https://sse.radarthing.com/api/active-flight-path";
const REFRESH_INTERVAL_MS = 15000;

function isCoordinatePair(point: unknown): point is [number, number] {
  return (
    Array.isArray(point) &&
    point.length >= 2 &&
    typeof point[0] === "number" &&
    Number.isFinite(point[0]) &&
    typeof point[1] === "number" &&
    Number.isFinite(point[1])
  );
}

function getFlightQueryParams(aircraft: PositionUpdate) {
  const params = new URLSearchParams();

  if (aircraft.id) {
    params.set("id", aircraft.id);
  }
  if (aircraft.flightNo || aircraft.callsign) {
    params.set("callsign", aircraft.flightNo || aircraft.callsign);
  }
  if (aircraft.googleId) {
    params.set("googleId", aircraft.googleId);
  }

  return params;
}

export function useActiveFlightPath(aircraft: PositionUpdate | null) {
  const [flightPath, setFlightPath] = useState<[number, number][] | null>(null);

  useEffect(() => {
    if (!aircraft) {
      setFlightPath(null);
      return;
    }

    const params = getFlightQueryParams(aircraft);
    if (params.size === 0) {
      setFlightPath(null);
      return;
    }

    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchPath = async () => {
      try {
        const response = await fetch(
          `${ACTIVE_FLIGHT_PATH_API_URL}?${params.toString()}`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          if (response.status === 404 && isMounted) {
            setFlightPath(null);
          }
          return;
        }

        const data = (await response.json()) as {
          routeData?: unknown;
        };

        const nextPath = Array.isArray(data.routeData)
          ? data.routeData.filter(isCoordinatePair)
          : [];

        if (isMounted) {
          setFlightPath(nextPath.length >= 2 ? nextPath : null);
        }
      } catch {
        // Ignore fetch failures and keep the most recent known path.
      }
    };

    void fetchPath();
    intervalId = setInterval(() => {
      void fetchPath();
    }, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [aircraft]);

  return { flightPath };
}
