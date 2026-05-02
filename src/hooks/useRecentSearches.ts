import { useState, useEffect, useCallback } from "react";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { type SearchablePilot } from "~/hooks/useAircraftSearch";

interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
}

export interface RecentSearch {
  type: "aircraft" | "airport" | "pilot";
  id: string; // callsign/flightNo for aircraft, icao for airport, userId for pilot
  displayName: string;
  subtitle?: string;
  timestamp: number;
}

const STORAGE_KEY = "radarthing_recent_searches";
const MAX_RECENT_SEARCHES = 10;

export const useRecentSearches = () => {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored.trim() !== "") {
        const parsed = JSON.parse(stored) as RecentSearch[];
        // Validate that it's an array
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed);
        } else {
          // Reset if data is corrupted
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error("Failed to load recent searches:", error);
      // Clear corrupted data
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Save to localStorage whenever recentSearches changes
  useEffect(() => {
    // Don't save during SSR or if localStorage is not available
    if (typeof window === "undefined" || !window.localStorage) return;

    try {
      if (recentSearches.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recentSearches));
      }
    } catch (error) {
      console.error("Failed to save recent searches:", error);
    }
  }, [recentSearches]);

  const addAircraftSearch = useCallback((aircraft: PositionUpdate) => {
    if (!aircraft) {
      console.warn("Invalid aircraft data:", aircraft);
      return;
    }

    const id = aircraft.callsign || aircraft.flightNo || aircraft.id;
    if (!id) {
      console.warn("Aircraft has no valid identifier:", aircraft);
      return;
    }

    const displayName = aircraft.callsign || aircraft.flightNo || "N/A";
    const subtitle = `${aircraft.type || "N/A"} • ${aircraft.departure || "N/A"} → ${aircraft.arrival || "UNK"}`;

    setRecentSearches((prev) => {
      // Remove existing entry if present
      const filtered = prev.filter(
        (s) => !(s.type === "aircraft" && s.id === id),
      );

      // Add new entry at the beginning
      const newSearch: RecentSearch = {
        type: "aircraft",
        id,
        displayName,
        subtitle,
        timestamp: Date.now(),
      };

      // Keep only the most recent searches
      return [newSearch, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    });
  }, []);

  const addAirportSearch = useCallback((airport: Airport) => {
    if (!airport?.icao) {
      console.warn("Invalid airport data:", airport);
      return;
    }

    const id = airport.icao;
    const displayName = airport.icao;
    const subtitle = airport.name || "";

    setRecentSearches((prev) => {
      // Remove existing entry if present
      const filtered = prev.filter(
        (s) => !(s.type === "airport" && s.id === id),
      );

      // Add new entry at the beginning
      const newSearch: RecentSearch = {
        type: "airport",
        id,
        displayName,
        subtitle,
        timestamp: Date.now(),
      };

      // Keep only the most recent searches
      return [newSearch, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    });
  }, []);

  const addPilotSearch = useCallback((pilot: SearchablePilot) => {
    if (!pilot?._id || !pilot.discordUsername) {
      console.warn("Invalid pilot data:", pilot);
      return;
    }

    const id = pilot._id;
    const displayName = pilot.discordUsername;
    const subtitle = pilot.pilotCallsign
      ? `Pilot profile • ${pilot.pilotCallsign}`
      : "Pilot profile";

    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => !(s.type === "pilot" && s.id === id));

      const newSearch: RecentSearch = {
        type: "pilot",
        id,
        displayName,
        subtitle,
        timestamp: Date.now(),
      };

      return [newSearch, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error("Failed to clear recent searches:", error);
    }
  }, []);

  return {
    recentSearches,
    addAircraftSearch,
    addAirportSearch,
    addPilotSearch,
    clearRecentSearches,
  };
};
