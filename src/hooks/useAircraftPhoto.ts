import { useEffect, useState } from "react";
import {
  getAircraftImage,
  type AircraftImage,
} from "~/app/actions/aircraft-images";
import { getVirtualAirlineFlightContext } from "~/app/actions/virtual-airlines";
import { getAircraftTypeLookupCandidates } from "~/lib/utils";

// In-memory cache for aircraft photos (persists across component instances)
// Cache entry can be null (no image found) or AircraftPhotoData
interface CacheEntry {
  data: CachedAircraftPhotoData | null;
  timestamp: number;
}

interface CachedAircraftPhotoData {
  photo: AircraftPhotoData | null;
  virtualAirline: VirtualAirlinePhotoData | null;
}

const imageCache = new Map<string, CacheEntry>();
const HIT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MISS_CACHE_TTL = 30 * 1000; // 30 seconds

function getCacheKey(
  callsign: string | undefined,
  aircraftType: string | undefined,
  googleId: string | undefined,
  af?: string,
): string {
  return [
    googleId?.trim() ?? "",
    af?.trim().toUpperCase() ?? "",
    callsign?.trim().toUpperCase() ?? "",
    aircraftType?.trim().toUpperCase() ?? "",
  ].join(":");
}

function getCachedImage(
  key: string,
): CachedAircraftPhotoData | null | undefined {
  const entry = imageCache.get(key);
  if (!entry) return undefined; // Not in cache
  const ttl = entry.data?.photo ? HIT_CACHE_TTL : MISS_CACHE_TTL;
  if (Date.now() - entry.timestamp > ttl) {
    imageCache.delete(key);
    return undefined; // Expired
  }
  return entry.data; // Can be null (meaning "no image exists")
}

function setCachedImage(key: string, data: CachedAircraftPhotoData | null): void {
  imageCache.set(key, { data, timestamp: Date.now() });
}

// Extract airline code from flight number/callsign
// Supports IATA (2-letter, e.g., "EK90" -> "EK"), ICAO (3-letter, e.g., "UAE90" -> "UAE"),
// and N-numbers (e.g., "N489IF" -> "N") for general aviation aircraft
function extractAirlineCode(flightNo: string | undefined): string | null {
  if (!flightNo) return null;
  const trimmed = flightNo.trim().toUpperCase();
  // Detect N-numbers (US GA registration: N followed by digits, optionally ending with letters)
  if (/^N\d/.test(trimmed)) return "N";
  const regex = /^([A-Z]{2,3})/;
  const match = regex.exec(trimmed);
  return match?.[1] ?? null;
}

function getAirlineCodeCandidates(
  callsign: string | undefined,
  af?: string,
): string[] {
  const candidates = new Set<string>();
  const trimmedAf = af?.trim().toUpperCase();
  const trimmedCallsign = callsign?.trim().toUpperCase();

  if (trimmedAf) {
    candidates.add(trimmedAf);
  }

  const extracted = extractAirlineCode(callsign);
  if (extracted) {
    candidates.add(extracted);
  }

  // Military identifiers can come through as bare alpha flight numbers
  // like "USAF" even when `af` is blank, so try the raw token too.
  if (trimmedCallsign && /^[A-Z]{2,10}$/.test(trimmedCallsign)) {
    candidates.add(trimmedCallsign);
  }

  return Array.from(candidates);
}

export interface AircraftPhotoData {
  imageUrl: string;
  discordUsername: string | null;
}

export interface VirtualAirlinePhotoData {
  id: string;
  name: string;
  callsignPrefix: string;
  website: string | null;
}

export const useAircraftPhoto = (
  callsign: string | undefined,
  aircraftType: string | undefined,
  googleId?: string,
  af?: string,
) => {
  const [photo, setPhoto] = useState<AircraftPhotoData | null>(null);
  const [virtualAirline, setVirtualAirline] =
    useState<VirtualAirlinePhotoData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const resolvedCallsign = callsign?.trim();
    const airlineCodes = getAirlineCodeCandidates(callsign, af);
    const aircraftTypes = getAircraftTypeLookupCandidates(aircraftType);
    let isCancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    if (!resolvedCallsign) {
      setLoading(false);
      setPhoto(null);
      setVirtualAirline(null);
      return;
    }

    const flightCallsign = resolvedCallsign;

    const cacheKey = getCacheKey(callsign, aircraftType, googleId, af);

    const scheduleRetry = () => {
      if (retryTimeout || isCancelled) return;

      retryTimeout = setTimeout(() => {
        retryTimeout = null;
        imageCache.delete(cacheKey);
        void fetchPhoto();
      }, MISS_CACHE_TTL);
    };

    const applyPhotoState = (nextState: CachedAircraftPhotoData | null) => {
      if (isCancelled) return;
      setPhoto(nextState?.photo ?? null);
      setVirtualAirline(nextState?.virtualAirline ?? null);
    };

    // Check cache first
    const cached = getCachedImage(cacheKey);
    if (cached !== undefined) {
      // Cache hit (can be null if no image exists)
      setLoading(false);
      applyPhotoState(cached);
      if (!cached?.photo) {
        scheduleRetry();
      }
      return () => {
        isCancelled = true;
        if (retryTimeout) clearTimeout(retryTimeout);
      };
    }

    async function fetchPhoto() {
      if (isCancelled) return;
      setLoading(true);
      try {
        const vaContext = await getVirtualAirlineFlightContext(
          flightCallsign,
          aircraftType ?? "",
          googleId,
        );

        const nextVirtualAirline = vaContext.virtualAirline
            ? {
              id: vaContext.virtualAirline.id,
              name: vaContext.virtualAirline.name,
              callsignPrefix: vaContext.virtualAirline.callsignPrefix,
              website: vaContext.virtualAirline.website,
            }
          : null;

        if (vaContext.image) {
          const nextState = {
            photo: {
              imageUrl: vaContext.image.imageUrl,
              discordUsername: null,
            },
            virtualAirline: nextVirtualAirline,
          };
          setCachedImage(cacheKey, nextState);
          applyPhotoState(nextState);
          return;
        }

        let image: AircraftImage | null = null;

        if (airlineCodes.length > 0 && aircraftTypes.length > 0) {
          for (const airlineCode of airlineCodes) {
            for (const aircraftTypeKey of aircraftTypes) {
              image = await getAircraftImage(airlineCode, aircraftTypeKey);
              if (image) break;
            }
            if (image) break;
          }
        }

        if (!image) {
          const nextState = nextVirtualAirline
            ? {
                photo: null,
                virtualAirline: nextVirtualAirline,
              }
            : null;
          setCachedImage(cacheKey, nextState);
          applyPhotoState(nextState);
          scheduleRetry();
          return;
        }

        const nextState = {
          photo: {
            imageUrl: image.imageUrl,
            discordUsername: image.discordUsername,
          },
          virtualAirline: nextVirtualAirline,
        };
        setCachedImage(cacheKey, nextState);
        applyPhotoState(nextState);
      } catch (err) {
        console.error("Aircraft photo fetch error:", err);
        applyPhotoState(null);
        scheduleRetry();
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    void fetchPhoto();

    return () => {
      isCancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [callsign, aircraftType, googleId, af]);

  return { photo, virtualAirline, loading };
};
