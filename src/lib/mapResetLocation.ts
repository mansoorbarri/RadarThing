const STORAGE_KEY = "radarthing.map_reset_location.v1";

interface StoredResetLocation {
  lat: number;
  lng: number;
}

function readStoredResetLocation(): StoredResetLocation | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredResetLocation>;
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

function writeStoredResetLocation(location: StoredResetLocation) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  } catch {
    // Ignore storage failures.
  }
}

export async function getUserResetLocation(): Promise<StoredResetLocation | null> {
  const stored = readStoredResetLocation();
  if (stored) return stored;

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
