"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { type PositionUpdate } from "~/lib/aircraft-store";

export interface MostTrackedFlight {
  callsign: string;
  count: number;
  aircraft: PositionUpdate | null;
}

export function useMostTrackedFlights(aircrafts: PositionUpdate[]) {
  const mostTracked = useQuery(api.activeTrackers.getMostTracked);

  const isDev = process.env.NODE_ENV === "development";
  const threshold = isDev ? -1 : 3;

  return useMemo(() => {
    if (!mostTracked) return [];

    return mostTracked
      .filter((entry) => entry.count > threshold)
      .map((entry) => ({
        callsign: entry.callsign,
        count: entry.count,
        aircraft:
          aircrafts.find(
            (ac) =>
              ac.callsign === entry.callsign ||
              ac.flightNo === entry.callsign,
          ) ?? null,
      }));
  }, [mostTracked, aircrafts, threshold]);
}
