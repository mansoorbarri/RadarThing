const STORAGE_KEY = "radarthing.map_reset_location.v1";

export interface MapResetLocation {
  lat: number;
  lng: number;
}

interface LocationApiResponse {
  lat: number | null;
  lng: number | null;
}

function readStoredResetLocation(): MapResetLocation | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<MapResetLocation>;
    const { lat, lng } = parsed;
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return null;
    }

    return {
      lat,
      lng,
    };
  } catch {
    return null;
  }
}

function writeStoredResetLocation(location: MapResetLocation) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  } catch {
    // Ignore storage failures.
  }
}

async function getApproximateResetLocation(): Promise<MapResetLocation | null> {
  if (typeof window === "undefined") return null;

  try {
    const response = await fetch("/api/location", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = (await response.json()) as Partial<LocationApiResponse>;
    if (
      typeof data.lat !== "number" ||
      typeof data.lng !== "number" ||
      !Number.isFinite(data.lat) ||
      !Number.isFinite(data.lng)
    ) {
      return null;
    }

    const next = {
      lat: data.lat,
      lng: data.lng,
    };
    writeStoredResetLocation(next);
    return next;
  } catch {
    return null;
  }
}

async function getBrowserResetLocation(): Promise<MapResetLocation | null> {
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    !("geolocation" in navigator)
  ) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        writeStoredResetLocation(next);
        resolve(next);
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 1000 * 60 * 60 * 24 * 14,
      },
    );
  });
}

export async function getUserResetLocation(): Promise<MapResetLocation | null> {
  const stored = readStoredResetLocation();
  if (stored) return stored;

  const precise = await getBrowserResetLocation();
  if (precise) return precise;

  const approximate = await getApproximateResetLocation();
  if (approximate) return approximate;

  return null;
}
