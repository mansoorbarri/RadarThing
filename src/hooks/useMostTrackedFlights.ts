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

export const MIN_TRACKERS_FOR_MOST_TRACKED = 3;

export function useMostTrackedFlights(aircrafts: PositionUpdate[]) {
  const mostTracked = useQuery(api.activeTrackers.getMostTracked);

  return useMemo(() => {
    if (!mostTracked) return [];

    return mostTracked
      .filter((entry) => entry.count >= MIN_TRACKERS_FOR_MOST_TRACKED)
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
  }, [mostTracked, aircrafts]);
}
