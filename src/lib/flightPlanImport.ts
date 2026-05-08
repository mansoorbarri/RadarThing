export interface ImportedFlightPlanWaypoint {
  ident: string;
  type: string;
  lat: number;
  lon: number;
  alt: number | null;
  spd: string | number | null;
  heading?: number | null;
}

export interface ImportedFlightPlan {
  sourceName: string;
  displayName: string;
  waypoints: ImportedFlightPlanWaypoint[];
}

export interface ImportedFlightPlanLegSummary {
  fromIdent: string;
  toIdent: string;
  distanceNm: number;
  estimatedSpeedKts: number;
  estimatedDurationMinutes: number;
}

export interface ImportedFlightPlanSummary {
  totalDistanceNm: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  legs: ImportedFlightPlanLegSummary[];
}

function getString(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function getNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function parseSpeedKts(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistanceNm(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
) {
  const earthRadiusNm = 3440.065;
  const dLat = toRadians(toLat - fromLat);
  const dLon = toRadians(toLon - fromLon);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusNm * c;
}

function estimateFallbackSpeedKts(
  from: ImportedFlightPlanWaypoint,
  to: ImportedFlightPlanWaypoint,
) {
  const averageAltitude =
    ((from.alt ?? 0) + (to.alt ?? 0)) / 2;

  if (averageAltitude >= 32000) return 460;
  if (averageAltitude >= 18000) return 380;
  if (averageAltitude >= 10000) return 300;
  return 220;
}

function buildDisplayName(
  fileName: string,
  waypoints: ImportedFlightPlanWaypoint[],
) {
  const departure = waypoints.find((waypoint) => waypoint.type === "DPT");
  const arrival = [...waypoints].reverse().find((waypoint) => waypoint.type === "DST");

  if (departure?.ident && arrival?.ident) {
    return `${departure.ident} -> ${arrival.ident}`;
  }

  return stripFileExtension(fileName);
}

export function parseImportedFlightPlan(
  text: string,
  fileName: string,
): ImportedFlightPlan {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Flight plan file is not valid JSON");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Flight plan JSON must be an array of waypoints");
  }

  const waypoints = parsed
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;

      const waypoint = entry as Record<string, unknown>;
      const lat = getNullableNumber(waypoint.lat);
      const lon = getNullableNumber(waypoint.lon);

      if (lat === null || lon === null) return null;

      return {
        ident: getString(waypoint.ident, `WP${index + 1}`),
        type: getString(waypoint.type, "WPT"),
        lat,
        lon,
        alt: getNullableNumber(waypoint.alt),
        spd:
          typeof waypoint.spd === "number" || typeof waypoint.spd === "string"
            ? waypoint.spd
            : null,
        heading: getNullableNumber(waypoint.heading),
      } satisfies ImportedFlightPlanWaypoint;
    })
    .filter((waypoint): waypoint is ImportedFlightPlanWaypoint => waypoint !== null);

  if (waypoints.length < 2) {
    throw new Error("Flight plan needs at least two waypoints with coordinates");
  }

  const sourceName = stripFileExtension(fileName);

  return {
    sourceName,
    displayName: buildDisplayName(fileName, waypoints),
    waypoints,
  };
}

export function getImportedFlightPlanSummary(
  flightPlan: ImportedFlightPlan,
): ImportedFlightPlanSummary {
  let previousKnownSpeed: number | null = null;

  const legs = flightPlan.waypoints.slice(0, -1).map((waypoint, index) => {
    const nextWaypoint = flightPlan.waypoints[index + 1]!;
    const distanceNm = calculateDistanceNm(
      waypoint.lat,
      waypoint.lon,
      nextWaypoint.lat,
      nextWaypoint.lon,
    );
    const explicitSpeed =
      parseSpeedKts(nextWaypoint.spd) ?? parseSpeedKts(waypoint.spd);
    const estimatedSpeedKts =
      explicitSpeed ??
      previousKnownSpeed ??
      estimateFallbackSpeedKts(waypoint, nextWaypoint);

    if (explicitSpeed) {
      previousKnownSpeed = explicitSpeed;
    } else if (previousKnownSpeed === null) {
      previousKnownSpeed = estimatedSpeedKts;
    }

    return {
      fromIdent: waypoint.ident,
      toIdent: nextWaypoint.ident,
      distanceNm,
      estimatedSpeedKts,
      estimatedDurationMinutes: (distanceNm / estimatedSpeedKts) * 60,
    };
  });

  const totalDistanceNm = legs.reduce((sum, leg) => sum + leg.distanceNm, 0);
  const totalDurationMinutes = legs.reduce(
    (sum, leg) => sum + leg.estimatedDurationMinutes,
    0,
  );

  return {
    totalDistanceNm,
    totalDistanceKm: totalDistanceNm * 1.852,
    totalDurationMinutes,
    legs,
  };
}
