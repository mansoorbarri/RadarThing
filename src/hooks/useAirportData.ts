// hooks/useAirportData.ts
import { useState, useCallback, useRef } from "react";

export interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
  frequencies?: { type: string; frequency: string }[];
}

export interface Runway {
  airportIdent: string;
  leIdent: string;
  heIdent: string;
  leLat: number;
  leLon: number;
  heLat: number;
  heLon: number;
}

// Cache key for localStorage
const AIRPORT_CACHE_KEY = "radarthing_airports_cache";
const AIRPORT_CACHE_VERSION = "v2";
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedAirportData {
  version: string;
  timestamp: number;
  airports: Airport[];
  runways?: Runway[];
}

// Try to get cached data from localStorage
function getCachedAirportData(): {
  airports: Airport[];
  runways: Runway[];
} | null {
  try {
    const cached = localStorage.getItem(AIRPORT_CACHE_KEY);
    if (!cached) return null;

    const data: CachedAirportData = JSON.parse(cached);
    if (data.version !== AIRPORT_CACHE_VERSION) return null;
    if (Date.now() - data.timestamp > CACHE_EXPIRY_MS) return null;

    return {
      airports: data.airports,
      runways: data.runways ?? [],
    };
  } catch {
    return null;
  }
}

// Save airports to localStorage
function setCachedAirportData(airports: Airport[], runways: Runway[]) {
  try {
    const data: CachedAirportData = {
      version: AIRPORT_CACHE_VERSION,
      timestamp: Date.now(),
      airports,
      runways,
    };
    localStorage.setItem(AIRPORT_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

function parseCsvLine(line: string) {
  const fields: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      currentField += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(currentField);
      currentField = "";
    } else {
      currentField += char;
    }
  }

  fields.push(currentField);
  return fields;
}

function cleanCsvField(value: string | undefined) {
  return value?.replace(/"/g, "").trim() ?? "";
}

function parseCsvNumber(value: string | undefined) {
  const parsed = Number.parseFloat(cleanCsvField(value));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function assertRequiredHeaders(
  headers: string[],
  requiredHeaders: Record<string, number>,
) {
  const missingHeaders = Object.entries(requiredHeaders)
    .filter(([, index]) => index < 0)
    .map(([name]) => name);

  if (missingHeaders.length > 0) {
    throw new Error(
      `Missing required OurAirports CSV columns: ${missingHeaders.join(", ")}`,
    );
  }
}

export const useAirportData = () => {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [runways, setRunways] = useState<Runway[]>([]);
  const [airportFetchError, setAirportFetchError] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);

  const fetchAirports = useCallback(async () => {
    // Prevent duplicate fetches
    if (hasFetchedRef.current || isFetchingRef.current) return;

    // Check cache first
    const cached = getCachedAirportData();
    if (cached && cached.airports.length > 0) {
      setAirports(cached.airports);
      setRunways(cached.runways);
      hasFetchedRef.current = true;
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);

    try {
      // Fetch from OurAirports public dataset (CSV format)
      const airportsResponse = await fetch(
        "https://davidmegginson.github.io/ourairports-data/airports.csv",
      );

      if (!airportsResponse.ok) {
        throw new Error(`Airports HTTP error: ${airportsResponse.status}`);
      }

      const airportsCsvText = await airportsResponse.text();

      // Parse CSV manually (simple parser for this specific format)
      const lines = airportsCsvText.split("\n");
      const headers = lines[0]?.split(",") || [];

      // Find column indices
      const icaoIdx = headers.findIndex((h) => h?.includes("ident"));
      const nameIdx = headers.findIndex((h) => h?.includes("name"));
      const latIdx = headers.findIndex((h) => h?.includes("latitude_deg"));
      const lonIdx = headers.findIndex((h) => h?.includes("longitude_deg"));
      const typeIdx = headers.findIndex((h) => h?.includes("type"));
      assertRequiredHeaders(headers, {
        ident: icaoIdx,
        name: nameIdx,
        latitude_deg: latIdx,
        longitude_deg: lonIdx,
        type: typeIdx,
      });

      const airportArray: Airport[] = [];
      const runwayAirportIdentSet = new Set<string>();

      // Parse each line (skip header)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line?.trim()) continue;

        const fields = parseCsvLine(line);

        const icao = cleanCsvField(fields[icaoIdx]);
        const name = cleanCsvField(fields[nameIdx]);
        const lat = parseCsvNumber(fields[latIdx]);
        const lon = parseCsvNumber(fields[lonIdx]);
        const type = cleanCsvField(fields[typeIdx]);

        if (
          icao &&
          icao.length >= 3 &&
          Number.isFinite(lat) &&
          Number.isFinite(lon)
        ) {
          runwayAirportIdentSet.add(icao);
        }

        // Only include medium/large airports with valid ICAO codes
        if (
          icao &&
          icao.length >= 3 &&
          !isNaN(lat) &&
          !isNaN(lon) &&
          (type === "large_airport" || type === "medium_airport")
        ) {
          airportArray.push({
            name: name || icao,
            lat,
            lon,
            icao,
          });
        }
      }

      const runwayArray: Runway[] = [];
      try {
        const runwaysResponse = await fetch(
          "https://davidmegginson.github.io/ourairports-data/runways.csv",
        );
        if (!runwaysResponse.ok) {
          throw new Error(`Runways HTTP error: ${runwaysResponse.status}`);
        }

        const runwayLines = (await runwaysResponse.text()).split("\n");
        const runwayHeaders = runwayLines[0]?.split(",") || [];
        const airportIdentIdx = runwayHeaders.findIndex((h) =>
          h?.includes("airport_ident"),
        );
        const leIdentIdx = runwayHeaders.findIndex((h) =>
          h?.includes("le_ident"),
        );
        const heIdentIdx = runwayHeaders.findIndex((h) =>
          h?.includes("he_ident"),
        );
        const leLatIdx = runwayHeaders.findIndex((h) =>
          h?.includes("le_latitude_deg"),
        );
        const leLonIdx = runwayHeaders.findIndex((h) =>
          h?.includes("le_longitude_deg"),
        );
        const heLatIdx = runwayHeaders.findIndex((h) =>
          h?.includes("he_latitude_deg"),
        );
        const heLonIdx = runwayHeaders.findIndex((h) =>
          h?.includes("he_longitude_deg"),
        );
        assertRequiredHeaders(runwayHeaders, {
          airport_ident: airportIdentIdx,
          le_ident: leIdentIdx,
          he_ident: heIdentIdx,
          le_latitude_deg: leLatIdx,
          le_longitude_deg: leLonIdx,
          he_latitude_deg: heLatIdx,
          he_longitude_deg: heLonIdx,
        });

        for (let i = 1; i < runwayLines.length; i++) {
          const line = runwayLines[i];
          if (!line?.trim()) continue;

          const fields = parseCsvLine(line);
          const airportIdent = cleanCsvField(fields[airportIdentIdx]);
          const leLat = parseCsvNumber(fields[leLatIdx]);
          const leLon = parseCsvNumber(fields[leLonIdx]);
          const heLat = parseCsvNumber(fields[heLatIdx]);
          const heLon = parseCsvNumber(fields[heLonIdx]);

          if (
            !runwayAirportIdentSet.has(airportIdent) ||
            !Number.isFinite(leLat) ||
            !Number.isFinite(leLon) ||
            !Number.isFinite(heLat) ||
            !Number.isFinite(heLon)
          ) {
            continue;
          }

          runwayArray.push({
            airportIdent,
            leIdent: cleanCsvField(fields[leIdentIdx]),
            heIdent: cleanCsvField(fields[heIdentIdx]),
            leLat,
            leLon,
            heLat,
            heLon,
          });
        }
      } catch (runwayError) {
        console.error("Could not load runway data:", runwayError);
        setRunways([]);
      }

      console.log(
        `Loaded ${airportArray.length} airports and ${runwayArray.length} runways from OurAirports API`,
      );
      setAirports(airportArray);
      setRunways(runwayArray);
      setCachedAirportData(airportArray, runwayArray);
      setAirportFetchError(null);
      hasFetchedRef.current = true;
    } catch (e) {
      console.error("Could not load airport data:", e);
      setAirportFetchError("Failed to load airport data from API.");
      setAirports([]);
      setRunways([]);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  return { airports, runways, airportFetchError, isLoading, fetchAirports };
};
