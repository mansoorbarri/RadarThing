import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import { calculateDistance, calculateBearing } from "~/lib/map-utils";

interface UseHeadingModeInteractionProps {
  mapInstance: React.MutableRefObject<L.Map | null>;
  isHeadingMode: boolean;
  isRadarMode: boolean;
}

export const useHeadingModeInteraction = ({
  mapInstance,
  isHeadingMode,
  isRadarMode,
}: UseHeadingModeInteractionProps) => {
  const headingStartPointRef = useRef<L.LatLng | null>(null);
  const headingLineRef = useRef<L.Polyline | null>(null);
  const headingTooltipRef = useRef<L.Tooltip | null>(null);
  const headingMarkerRef = useRef<L.Marker | null>(null);

  const cleanupHeadingModeRef = useRef<(() => void) | undefined>(undefined);

  const handleGlobalMouseUp = useCallback(() => {
    if (!mapInstance.current || !isHeadingMode) return;
    cleanupHeadingModeRef.current?.();
  }, [mapInstance, isHeadingMode]);

  const cleanupHeadingMode = useCallback(() => {
    const map = mapInstance.current;
    if (!map) return;

    if (headingLineRef.current) {
      map.removeLayer(headingLineRef.current);
      headingLineRef.current = null;
    }
    if (headingTooltipRef.current) {
      map.removeLayer(headingTooltipRef.current);
      headingTooltipRef.current = null;
    }
    if (headingMarkerRef.current) {
      map.removeLayer(headingMarkerRef.current);
      headingMarkerRef.current = null;
    }

    headingStartPointRef.current = null;

    if (!map.dragging.enabled()) {
      map.dragging.enable();
    }
    map.getContainer().style.cursor = "";

    map.off("mousemove");
    map.off("mousedown");
    document.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [mapInstance, handleGlobalMouseUp]);

  useEffect(() => {
    cleanupHeadingModeRef.current = cleanupHeadingMode;
  }, [cleanupHeadingMode]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const handleMouseDown = (e: L.LeafletMouseEvent) => {
      if (!isHeadingMode || !map.dragging.enabled()) return;

      headingStartPointRef.current = e.latlng;

      if (headingMarkerRef.current) {
        map.removeLayer(headingMarkerRef.current);
      }
      headingMarkerRef.current = L.marker(e.latlng, {
        icon: L.divIcon({
          className: "",
          html: `<div style="background-color: ${
            isRadarMode ? "#00ff00" : "#2563eb"
          }; width: 10px; height: 10px; border-radius: 50%;"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        }),
      }).addTo(map);

      map.dragging.disable();
      map.on("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleGlobalMouseUp);
    };

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      if (!isHeadingMode || !headingStartPointRef.current) return;

      const start = headingStartPointRef.current;
      const end = e.latlng;

      if (headingLineRef.current) {
        headingLineRef.current.setLatLngs([start, end]);
      } else {
        headingLineRef.current = L.polyline([start, end], {
          color: isRadarMode ? "#00ff00" : "blue",
          weight: 3,
          dashArray: "5, 5",
        }).addTo(map);
      }

      const distanceKm = calculateDistance(
        start.lat,
        start.lng,
        end.lat,
        end.lng,
        "km",
      );
      const distanceMiles = calculateDistance(
        start.lat,
        start.lng,
        end.lat,
        end.lng,
        "miles",
      );
      const heading = calculateBearing(start.lat, start.lng, end.lat, end.lng);

      const tooltipContent = `
        <div style="font-weight: bold;">
          Heading: ${heading.toFixed(1)}°
        </div>
        <div>
          Distance: ${distanceKm.toFixed(1)} km / ${distanceMiles.toFixed(1)} miles
        </div>
      `;

      if (headingTooltipRef.current) {
        headingTooltipRef.current.setLatLng(end).setContent(tooltipContent);
      } else {
        headingTooltipRef.current = L.tooltip({
          permanent: true,
          direction: "auto",
          className: "heading-tooltip",
        })
          .setLatLng(end)
          .setContent(tooltipContent)
          .addTo(map);
      }
    };

    if (isHeadingMode) {
      map.on("mousedown", handleMouseDown);
      map.getContainer().style.cursor = "crosshair";
    } else {
      cleanupHeadingMode();
      map.off("mousedown", handleMouseDown);
      map.getContainer().style.cursor = "";
    }

    return () => {
      cleanupHeadingMode();
      map.off("mousedown", handleMouseDown);
      map.off("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [
    isHeadingMode,
    isRadarMode,
    mapInstance,
    cleanupHeadingMode,
    handleGlobalMouseUp,
  ]);
};
