"use client";

import { useEffect, useRef } from "react";
import { activeAircraft, type PositionUpdate } from "~/lib/aircraft-store";

const ACTIVE_FLIGHT_PATH_API_URL =
  "https://sse.radarthing.com/api/active-flight-path";
const RETRY_INTERVAL_MS = 15000;

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

// Loads the selected aircraft's route so far into the aircraft store once. The
// stream then extends it, so this only fetches again if the store drops the
// history (for example when a reconnect snapshot clears it), or retries until
// the server has a route to return.
export function useActiveFlightPath(aircraft: PositionUpdate | null) {
  const aircraftPathKey = getAircraftPathKey(aircraft);
  const storeId = aircraft ? aircraft.callsign || aircraft.id : null;
  const needsHistory =
    storeId !== null && !activeAircraft.hasFlightPathHistory(storeId);
  const aircraftRef = useRef(aircraft);

  useEffect(() => {
    aircraftRef.current = aircraft;
  });

  useEffect(() => {
    const current = aircraftRef.current;
    if (!current || !storeId || !needsHistory) return;

    const params = getFlightQueryParams(current);
    if (params.size === 0) return;

    let isMounted = true;
    let retryId: ReturnType<typeof setTimeout> | null = null;

    const fetchPath = async () => {
      try {
        const response = await fetch(
          `${ACTIVE_FLIGHT_PATH_API_URL}?${params.toString()}`,
          {
            cache: "no-store",
          },
        );

        if (response.ok) {
          const data = (await response.json()) as {
            routeData?: unknown;
          };

          const path = Array.isArray(data.routeData)
            ? data.routeData.filter(isCoordinatePair)
            : [];

          if (!isMounted) return;
          if (path.length >= 2) {
            activeAircraft.mergeFlightPath(storeId, path);
            if (activeAircraft.hasFlightPathHistory(storeId)) return;
          }
        }
      } catch {
        // Retry below; the live path keeps growing from the stream meanwhile.
      }

      if (isMounted) {
        retryId = setTimeout(() => {
          void fetchPath();
        }, RETRY_INTERVAL_MS);
      }
    };

    void fetchPath();

    return () => {
      isMounted = false;
      if (retryId) {
        clearTimeout(retryId);
      }
    };
  }, [aircraftPathKey, storeId, needsHistory]);
}
