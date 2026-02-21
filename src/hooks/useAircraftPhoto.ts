import { useEffect, useState } from "react";
import { getAircraftImage, type AircraftImage } from "~/app/actions/aircraft-images";
import { normalizeAircraftType } from "~/lib/utils";

// In-memory cache for aircraft photos (persists across component instances)
// Cache entry can be null (no image found) or AircraftPhotoData
interface CacheEntry {
  data: AircraftPhotoData | null;
  timestamp: number;
}

const imageCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(airlineCode: string, aircraftType: string): string {
  return `${airlineCode}:${aircraftType}`;
}

function getCachedImage(key: string): AircraftPhotoData | null | undefined {
  const entry = imageCache.get(key);
  if (!entry) return undefined; // Not in cache
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    imageCache.delete(key);
    return undefined; // Expired
  }
  return entry.data; // Can be null (meaning "no image exists")
}

function setCachedImage(key: string, data: AircraftPhotoData | null): void {
  imageCache.set(key, { data, timestamp: Date.now() });
}

// Extract airline code from flight number/callsign
// Supports both IATA (2-letter, e.g., "EK90" -> "EK") and ICAO (3-letter, e.g., "UAE90" -> "UAE")
function extractAirlineCode(flightNo: string | undefined): string | null {
  if (!flightNo) return null;
  const regex = /^([A-Z]{2,3})/;
  const match = regex.exec(flightNo.trim().toUpperCase());
  return match?.[1] ?? null;
}


export interface AircraftPhotoData {
  imageUrl: string;
  discordUsername: string | null;
}

export const useAircraftPhoto = (
  callsign: string | undefined,
  aircraftType: string | undefined
) => {
  const [photo, setPhoto] = useState<AircraftPhotoData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const airlineCode = extractAirlineCode(callsign);
    const normalizedType = normalizeAircraftType(aircraftType);

    if (!airlineCode || !normalizedType) {
      setPhoto(null);
      return;
    }

    const cacheKey = getCacheKey(airlineCode, normalizedType);

    // Check cache first
    const cached = getCachedImage(cacheKey);
    if (cached !== undefined) {
      // Cache hit (can be null if no image exists)
      setPhoto(cached);
      return;
    }

    const fetchPhoto = async () => {
      setLoading(true);
      try {
        const image = await getAircraftImage(airlineCode, normalizedType);
        if (image) {
          const photoData = {
            imageUrl: image.imageUrl,
            discordUsername: image.discordUsername,
          };
          setCachedImage(cacheKey, photoData);
          setPhoto(photoData);
        } else {
          // Cache the "no image" result too to avoid repeated lookups
          setCachedImage(cacheKey, null);
          setPhoto(null);
        }
      } catch (err) {
        console.error("Aircraft photo fetch error:", err);
        setPhoto(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPhoto();
  }, [callsign, aircraftType]);

  return { photo, loading };
};
