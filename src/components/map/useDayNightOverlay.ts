import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import L from "leaflet";

// Approximate solar declination and terminator line to shade night area
function solarDeclination(date: Date): number {
  const N = Math.floor(
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
      Date.UTC(date.getUTCFullYear(), 0, 0)) /
      86400000,
  );
  return (23.44 * Math.sin(((2 * Math.PI) / 365) * (N + 284))) * (Math.PI / 180);
}

function localSolarTime(date: Date, lon: number): number {
  // UTC hours + longitude offset (15° per hour)
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  return utcHours + lon / 15;
}

function terminatorLatAtLon(date: Date, lon: number): number {
  const phiDecl = solarDeclination(date);
  const LST = localSolarTime(date, lon);
  const H = ((LST - 12) * 15) * (Math.PI / 180); // hour angle radians
  // Solve for latitude where solar elevation = 0: sinφ sinδ + cosφ cosδ cosH = 0
  // tanφ = -cosδ cosH / sinδ
  const denom = Math.sin(phiDecl);
  const numer = Math.cos(phiDecl) * Math.cos(H);
  const tanPhi = denom === 0 ? 0 : -numer / denom;
  const phi = Math.atan(tanPhi);
  return (phi * 180) / Math.PI;
}

function buildNightPolygon(date: Date): L.LatLngExpression[] {
  const points: L.LatLngExpression[] = [];
  // Sample longitudes from -180 to 180
  for (let lon = -180; lon <= 180; lon += 2) {
    const lat = terminatorLatAtLon(date, lon);
    points.push([lat, lon]);
  }
  // Close polygon by connecting around the poles
  // Determine which side is night by sampling a point
  const sampleLon = 0;
  const sampleLat = terminatorLatAtLon(date, sampleLon);
  // Night is the hemisphere opposite the sun; we take the pole side below the line.
  // Build polygon from terminator to south pole and back to start
  const southPole = -89.5;
  const poly: L.LatLngExpression[] = [];
  for (let i = 0; i < points.length; i++) poly.push(points[i]);
  poly.push([southPole, 180]);
  poly.push([southPole, -180]);
  poly.push(points[0]);
  return poly;
}

export function useDayNightOverlay(
  mapRef: MutableRefObject<L.Map | null>,
  enabled: boolean,
) {
  const layerRef = useRef<L.Polygon | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateLayer = () => {
      const now = new Date();
      const poly = buildNightPolygon(now);
      if (!layerRef.current) {
        layerRef.current = L.polygon(poly, {
          color: "#001b2e",
          fillColor: "#001b2e",
          weight: 0,
          fillOpacity: 0.35,
          interactive: false,
        });
      } else {
        layerRef.current.setLatLngs(poly);
      }
      if (enabled) {
        if (!map.hasLayer(layerRef.current)) {
          layerRef.current.addTo(map);
        }
        layerRef.current.bringToBack();
      } else if (map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current);
      }
    };

    updateLayer();
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(updateLayer, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      const map2 = mapRef.current;
      if (map2 && layerRef.current && map2.hasLayer(layerRef.current)) {
        map2.removeLayer(layerRef.current);
      }
      layerRef.current = null;
    };
  }, [mapRef, enabled]);
}
