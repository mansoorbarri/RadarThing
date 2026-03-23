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

function getAircraftPathKey(aircraft: PositionUpdate | null) {
  if (!aircraft) return null;

  return [
    aircraft.id || "",
    aircraft.flightNo || "",
    aircraft.callsign || "",
    aircraft.googleId || "",
  ].join("|");
}

export function useActiveFlightPath(aircraft: PositionUpdate | null) {
  const aircraftPathKey = getAircraftPathKey(aircraft);
  const [activePathState, setActivePathState] = useState<{
    aircraftPathKey: string | null;
    flightPath: [number, number][] | null;
  }>({
    aircraftPathKey: null,
    flightPath: null,
  });

  useEffect(() => {
    if (!aircraft) {
      setActivePathState({
        aircraftPathKey: null,
        flightPath: null,
      });
      return;
    }

    const params = getFlightQueryParams(aircraft);
    if (params.size === 0) {
      setActivePathState({
        aircraftPathKey,
        flightPath: null,
      });
      return;
    }

    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    setActivePathState({
      aircraftPathKey,
      flightPath: null,
    });

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
            setActivePathState({
              aircraftPathKey,
              flightPath: null,
            });
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
          setActivePathState({
            aircraftPathKey,
            flightPath: nextPath.length >= 2 ? nextPath : null,
          });
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
  }, [aircraft, aircraftPathKey]);

  return {
    flightPath:
      activePathState.aircraftPathKey === aircraftPathKey
        ? activePathState.flightPath
        : null,
  };
}
