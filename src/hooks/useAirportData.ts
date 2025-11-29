// hooks/useAirportData.ts
import { useState, useEffect, useCallback } from "react";

interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
  frequencies?: { type: string; frequency: string }[];
}

export const useAirportData = () => {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [airportFetchError, setAirportFetchError] = useState<string | null>(
    null,
  );

  const fetchAirports = useCallback(async () => {
    try {
      const response = await fetch("/airports.json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const airportMap: Record<string, Airport> = await response.json();
      const airportArray: Airport[] = Object.values(airportMap);
      setAirports(airportArray);
      setAirportFetchError(null);
    } catch (e) {
      console.warn("Could not load airports.json:", e);
      setAirportFetchError("Failed to load airport data.");
    }
  }, []);

  useEffect(() => {
    fetchAirports();
  }, [fetchAirports]);

  return { airports, airportFetchError };
};
