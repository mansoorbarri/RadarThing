import { useEffect, useRef } from "react";
import L from "leaflet";
import {
  filterNavFixesInBounds,
  loadNavFixes,
  type NavFix,
} from "~/lib/navFixes";

interface UseWaypointOverlayLayerProps {
  mapInstance: React.MutableRefObject<L.Map | null>;
  mapReady: boolean;
  enabled: boolean;
}

const MIN_WAYPOINT_ZOOM = 7;
const QUERY_DEBOUNCE_MS = 250;
const MAX_RENDERED_FIXES = 2500;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getWaypointIcon(fix: NavFix) {
  const label = escapeHtml(fix.ident);

  return L.divIcon({
    className: "leaflet-rnav-waypoint-icon",
    html: `
      <div class="rnav-waypoint">
        <span class="rnav-waypoint-symbol"></span>
        <span class="rnav-waypoint-label">${label}</span>
      </div>
    `,
    iconSize: [96, 18],
    iconAnchor: [6, 9],
  });
}

function getBounds(map: L.Map) {
  const bounds = map.getBounds();
  const west = Math.max(-180, bounds.getWest());
  const east = Math.min(180, bounds.getEast());

  return {
    south: bounds.getSouth(),
    west,
    north: bounds.getNorth(),
    east,
  };
}

export function useWaypointOverlayLayer({
  mapInstance,
  mapReady,
  enabled,
}: UseWaypointOverlayLayerProps) {
  const layerRef = useRef<L.LayerGroup | null>(null);
  const requestSignatureRef = useRef("");

  useEffect(() => {
    if (!mapReady) return;

    const map = mapInstance.current;
    if (!map) return;

    if (!layerRef.current) {
      layerRef.current = L.layerGroup();
    }

    const layer = layerRef.current;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const clearLayer = () => {
      requestSignatureRef.current = "";
      layer.clearLayers();
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    };

    const renderFixes = (fixes: NavFix[]) => {
      layer.clearLayers();

      fixes.forEach((fix) => {
        const marker = L.marker([fix.lat, fix.lon], {
          icon: getWaypointIcon(fix),
          keyboard: false,
          riseOnHover: true,
          title: fix.ident,
          zIndexOffset: 350,
        }).bindPopup(
          `<div class="font-bold text-white">${escapeHtml(fix.ident)}</div>`,
          {
            className: "radar-popup",
          },
        );
        layer.addLayer(marker);
      });

      if (!map.hasLayer(layer)) {
        layer.addTo(map);
      }
    };

    const loadFixes = () => {
      if (!enabled || map.getZoom() < MIN_WAYPOINT_ZOOM) {
        clearLayer();
        return;
      }

      const bounds = map.getBounds();
      const signature = `${bounds.getSouth().toFixed(2)}:${bounds.getWest().toFixed(2)}:${bounds.getNorth().toFixed(2)}:${bounds.getEast().toFixed(2)}:${Math.floor(map.getZoom())}`;
      if (signature === requestSignatureRef.current) return;
      requestSignatureRef.current = signature;

      loadNavFixes()
        .then((fixes) => {
          renderFixes(
            filterNavFixesInBounds(fixes, getBounds(map), MAX_RENDERED_FIXES),
          );
        })
        .catch(() => {
          layer.clearLayers();
        });
    };

    const scheduleLoad = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(loadFixes, QUERY_DEBOUNCE_MS);
    };

    scheduleLoad();
    map.on("moveend", scheduleLoad);
    map.on("zoomend", scheduleLoad);

    return () => {
      if (timeout) clearTimeout(timeout);
      map.off("moveend", scheduleLoad);
      map.off("zoomend", scheduleLoad);
      clearLayer();
    };
  }, [enabled, mapInstance, mapReady]);
}
