// hooks/useAircraftSearch.ts
import { useState, useEffect, useCallback } from "react";
import { type PositionUpdate } from "~/lib/aircraft-store";

interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
}

export interface SearchResults {
  aircrafts: PositionUpdate[];
  airports: Airport[];
}

export const useAircraftSearch = (
  aircrafts: PositionUpdate[],
  airports: Airport[],
  onSearchStart?: () => void,
) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults>({
    aircrafts: [],
    airports: [],
  });

  // Trigger airport fetch when user starts searching
  useEffect(() => {
    if (searchTerm && onSearchStart) {
      onSearchStart();
    }
  }, [searchTerm, onSearchStart]);

  const performSearch = useCallback(() => {
    if (!searchTerm) {
      setSearchResults({ aircrafts: [], airports: [] });
      return;
    }

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const matchedAircrafts: PositionUpdate[] = [];
    const matchedAirports: Airport[] = [];

    aircrafts.forEach((ac) => {
      if (
        ac.callsign?.toLowerCase().includes(lowerCaseSearchTerm) ||
        ac.flightNo?.toLowerCase().includes(lowerCaseSearchTerm) ||
        ac.departure?.toLowerCase().includes(lowerCaseSearchTerm) ||
        ac.arrival?.toLowerCase().includes(lowerCaseSearchTerm) ||
        ac.squawk?.toLowerCase().includes(lowerCaseSearchTerm)
      ) {
        matchedAircrafts.push(ac);
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

    setSearchResults({ aircrafts: matchedAircrafts, airports: matchedAirports });
  }, [searchTerm, aircrafts, airports]);

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
