import type { ChartCalibration } from "~/types/airportCharts";

export interface ChartTransform {
  a: number;
  b: number;
  tx: number;
  ty: number;
  refLat: number;
  refLon: number;
}

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS = 6371000; // meters

/** Convert lat/lon to local meters relative to a reference point (flat-Earth approximation) */
export function geoToMeters(
  lat: number,
  lon: number,
  refLat: number,
  refLon: number,
): [number, number] {
  const mx = (lon - refLon) * DEG_TO_RAD * EARTH_RADIUS * Math.cos(refLat * DEG_TO_RAD);
  const my = (lat - refLat) * DEG_TO_RAD * EARTH_RADIUS;
  return [mx, my];
}

/** Compute similarity transform coefficients from two-point calibration */
export function computeTransform(cal: ChartCalibration): ChartTransform | null {
  const refLat = cal.p1Lat;
  const refLon = cal.p1Lon;

  const [dmx, dmy] = geoToMeters(cal.p2Lat, cal.p2Lon, refLat, refLon);
  const denom = dmx * dmx + dmy * dmy;

  // Points must be >100m apart
  if (denom < 10000) return null;

  const dpx = cal.p2PixelX - cal.p1PixelX;
  const dpy = cal.p2PixelY - cal.p1PixelY;

  const a = (dpx * dmx - dpy * dmy) / denom;
  const b = (dpy * dmx + dpx * dmy) / denom;

  return {
    a,
    b,
    tx: cal.p1PixelX,
    ty: cal.p1PixelY,
    refLat,
    refLon,
  };
}

/** Project a lat/lon position to fractional chart coordinates */
export function projectToChart(
  lat: number,
  lon: number,
  transform: ChartTransform,
): [number, number] {
  const [mx, my] = geoToMeters(lat, lon, transform.refLat, transform.refLon);
  const fracX = transform.a * mx + transform.b * my + transform.tx;
  const fracY = transform.b * mx - transform.a * my + transform.ty;
  return [fracX, fracY];
}

/** Check if fractional coordinates fall within chart bounds (with margin) */
export function isOnChart(fracX: number, fracY: number, margin = 0.05): boolean {
  return (
    fracX >= -margin &&
    fracX <= 1 + margin &&
    fracY >= -margin &&
    fracY <= 1 + margin
  );
}
