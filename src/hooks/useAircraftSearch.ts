// hooks/useAircraftSearch.ts
import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { type PositionUpdate } from "~/lib/aircraft-store";

interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
}

export interface SearchResults {
  aircrafts: SearchableAircraft[];
  airports: Airport[];
  pilots: SearchablePilot[];
}

export interface SearchableAircraft extends PositionUpdate {
  pilotDiscordUsername?: string | null;
}

export interface SearchablePilot {
  _id: string;
  discordUsername: string | null;
  pilotCallsign: string | null;
  totalFlights: number;
  role: "FREE" | "PRO" | "ADMIN";
}

const normalizeDiscordSearchValue = (value: string) =>
  value.trim().toLowerCase().replace(/^@/, "");
const EMPTY_PILOT_RESULTS: SearchablePilot[] = [];

export const useAircraftSearch = (
  aircrafts: PositionUpdate[],
  airports: Airport[],
  pilotDiscordUsernamesByGoogleId: Record<string, string>,
  onSearchStart?: () => void,
) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults>({
    aircrafts: [],
    airports: [],
    pilots: [],
  });
  const normalizedPilotSearchTerm = searchTerm.trim().replace(/^@/, "");
  const pilotSearchResults = useQuery(
    api.users.searchPilotsByDiscordUsername,
    normalizedPilotSearchTerm.length >= 2
      ? { searchTerm: normalizedPilotSearchTerm, limit: 8 }
      : "skip",
  );
  const pilots = pilotSearchResults ?? EMPTY_PILOT_RESULTS;

  // Trigger airport fetch when user starts searching
  useEffect(() => {
    if (searchTerm && onSearchStart) {
      onSearchStart();
    }
  }, [searchTerm, onSearchStart]);

  // Memoize search results to avoid recalculating on every render
  const memoizedSearchResults = useMemo(() => {
    if (!searchTerm) {
      return { aircrafts: [], airports: [], pilots: [] };
    }

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const normalizedDiscordSearchTerm =
      normalizeDiscordSearchValue(searchTerm);
    const matchedAircrafts: SearchableAircraft[] = [];
    const matchedAirports: Airport[] = [];
    const matchedPilots = [...pilots];

    aircrafts.forEach((ac) => {
      const pilotDiscordUsername = ac.googleId
        ? pilotDiscordUsernamesByGoogleId[ac.googleId] ?? null
        : null;
      const matchesDiscordUsername = pilotDiscordUsername
        ? normalizeDiscordSearchValue(pilotDiscordUsername).includes(
            normalizedDiscordSearchTerm,
          )
        : false;

      if (
        ac.callsign?.toLowerCase().includes(lowerCaseSearchTerm) ||
        ac.flightNo?.toLowerCase().includes(lowerCaseSearchTerm) ||
        ac.departure?.toLowerCase().includes(lowerCaseSearchTerm) ||
        ac.arrival?.toLowerCase().includes(lowerCaseSearchTerm) ||
        ac.squawk?.toLowerCase().includes(lowerCaseSearchTerm) ||
        matchesDiscordUsername
      ) {
        matchedAircrafts.push({
          ...ac,
          pilotDiscordUsername,
        });
      }
    });

    airports.forEach((airport) => {
      if (
        airport.icao.toLowerCase().includes(lowerCaseSearchTerm) ||
        airport.name.toLowerCase().includes(lowerCaseSearchTerm)
      ) {
        matchedAirports.push(airport);
      }
    });

    // Sort aircrafts alphabetically by callsign/flightNo
    matchedAircrafts.sort((a, b) => {
      const aName = (a.callsign || a.flightNo || "").toLowerCase();
      const bName = (b.callsign || b.flightNo || "").toLowerCase();
      return aName.localeCompare(bName);
    });

    // Sort airports alphabetically by ICAO code
    matchedAirports.sort((a, b) => a.icao.localeCompare(b.icao));

    matchedPilots.sort((a, b) =>
      (a.discordUsername ?? "").localeCompare(b.discordUsername ?? ""),
    );

    return {
      aircrafts: matchedAircrafts,
      airports: matchedAirports,
      pilots: matchedPilots,
    };
  }, [searchTerm, aircrafts, airports, pilots, pilotDiscordUsernamesByGoogleId]);

  const performSearch = useCallback(() => {
    setSearchResults(memoizedSearchResults);
  }, [memoizedSearchResults]);

  useEffect(() => {
    const handler = setTimeout(() => {
      performSearch();
    }, 300); // Debounce search

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, performSearch]);

  return { searchTerm, setSearchTerm, searchResults };
};
