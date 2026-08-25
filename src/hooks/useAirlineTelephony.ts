"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getIcaoAirlineDesignator,
  type AirlineTelephony,
} from "~/lib/airlineTelephony";
import { type PositionUpdate } from "~/lib/aircraft-store";

const STORAGE_KEY = "radarthing:airline-telephony:v1";
const CLIENT_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  value: AirlineTelephony | null;
  expiresAt: number;
}

type TelephonyCache = Record<string, CacheEntry>;

function readCache(): TelephonyCache {
  if (typeof window === "undefined") return {};

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "{}",
    ) as TelephonyCache;
    const now = Date.now();

    return Object.fromEntries(
      Object.entries(stored).filter(
        ([code, entry]) =>
          /^[A-Z]{3}$/.test(code) &&
          entry &&
          typeof entry.expiresAt === "number" &&
          entry.expiresAt > now,
      ),
    );
  } catch {
    return {};
  }
}

function writeCache(cache: TelephonyCache) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Storage can be unavailable or full; the server cache still prevents churn.
  }
}

export function useAirlineTelephony(
  aircrafts: PositionUpdate[],
): PositionUpdate[] {
  const [cache, setCache] = useState<TelephonyCache>({});
  const [cacheHydrated, setCacheHydrated] = useState(false);
  const requestedCodesRef = useRef(new Set<string>());

  useEffect(() => {
    setCache(readCache());
    setCacheHydrated(true);
  }, []);

  const codes = useMemo(
    () =>
      Array.from(
        new Set(
          aircrafts
            .map((aircraft) => getIcaoAirlineDesignator(aircraft.flightNo))
            .filter((code): code is string => Boolean(code)),
        ),
      ).sort(),
    [aircrafts],
  );
  const codesKey = codes.join(",");

  useEffect(() => {
    if (!cacheHydrated) return;

    const requestedCodes = codesKey ? codesKey.split(",") : [];
    const missingCodes = requestedCodes.filter(
      (code) => !cache[code] && !requestedCodesRef.current.has(code),
    );
    if (missingCodes.length === 0) return;

    missingCodes.forEach((code) => requestedCodesRef.current.add(code));

    void fetch(
      `/api/airlines/telephony?icao=${encodeURIComponent(missingCodes.join(","))}`,
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`Telephony lookup returned ${response.status}`);
        return (await response.json()) as {
          airlines: Record<string, AirlineTelephony | null>;
        };
      })
      .then(({ airlines }) => {
        const expiresAt = Date.now() + CLIENT_CACHE_TTL_MS;
        setCache((current) => {
          const next = { ...current };
          for (const code of missingCodes) {
            if (Object.hasOwn(airlines, code)) {
              next[code] = { value: airlines[code] ?? null, expiresAt };
            } else {
              requestedCodesRef.current.delete(code);
            }
          }
          writeCache(next);
          return next;
        });
      })
      .catch((error: unknown) => {
        missingCodes.forEach((code) => requestedCodesRef.current.delete(code));
        console.warn("Unable to load airline telephony designators", error);
      });
  }, [cache, cacheHydrated, codesKey]);

  return useMemo(
    () =>
      aircrafts.map((aircraft) => {
        const code = getIcaoAirlineDesignator(aircraft.flightNo);
        const telephonyDesignator = code
          ? cache[code]?.value?.telephonyDesignator
          : null;
        const airlineName = code ? cache[code]?.value?.name : null;

        if (!telephonyDesignator && !airlineName) return aircraft;
        return {
          ...aircraft,
          telephonyDesignator: telephonyDesignator ?? undefined,
          airlineName: airlineName ?? undefined,
        };
      }),
    [aircrafts, cache],
  );
}
