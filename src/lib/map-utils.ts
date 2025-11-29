// lib/map-utils.ts

import { type PositionUpdate } from "~/lib/aircraft-store";

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  unit: "km" | "miles" = "km",
): number => {
  const R_km = 6371;
  const R_miles = 3958.8;

  const R = unit === "miles" ? R_miles : R_km;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const calculateBearing = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = toDeg(Math.atan2(y, x));

  return (θ + 360) % 360;
};

export const findActiveWaypointIndex = (
  aircraft: PositionUpdate,
  waypoints: any[],
): number => {
  if (waypoints.length < 1) return -1;

  const currentLat = aircraft.lat;
  const currentLon = aircraft.lon;
  const currentHeading = aircraft.heading;

  let closestWaypointIndex = -1;
  let minDistanceKm = Infinity;

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    if (!wp.lat || !wp.lon) continue;

    const distance = calculateDistance(currentLat, currentLon, wp.lat, wp.lon);

    if (distance < minDistanceKm) {
      minDistanceKm = distance;
      closestWaypointIndex = i;
    }
  }

  if (minDistanceKm > 100) {
    return -1;
  }

  if (minDistanceKm < 50 && closestWaypointIndex < waypoints.length - 1) {
    const nextWp = waypoints[closestWaypointIndex + 1];
    if (nextWp.lat && nextWp.lon) {
      const bearingToNext = calculateBearing(
        currentLat,
        currentLon,
        nextWp.lat,
        nextWp.lon,
      );

      let headingDiff = Math.abs(currentHeading - bearingToNext);
      if (headingDiff > 180) headingDiff = 360 - headingDiff;

      if (headingDiff < 90) {
        return closestWaypointIndex + 1;
      }
    }
  }

  return closestWaypointIndex;
};
