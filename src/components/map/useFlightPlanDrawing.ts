// components/map/useFlightPlanDrawing.ts
import { useCallback, useRef } from "react";
import L from "leaflet";
import { type PositionUpdate } from "~/lib/aircraft-store";
import {
  findActiveWaypointIndex,
  splitPathAtAntimeridian,
} from "~/lib/map-utils";
import {
  WaypointIcon,
  ActiveWaypointIcon,
  RadarWaypointIcon,
  RadarActiveWaypointIcon,
} from "./MapIcons";

// Colors for multiple aircraft flight paths
const FLIGHT_PATH_COLORS = [
  "#00ff00", // green
  "#ff6b6b", // red
  "#4dabf7", // blue
  "#ffd43b", // yellow
  "#da77f2", // purple
  "#69db7c", // light green
  "#ff922b", // orange
  "#22b8cf", // cyan
];

interface UseFlightPlanDrawingProps {
  mapInstance: React.MutableRefObject<L.Map | null>;
  flightPlanLayerGroup: React.MutableRefObject<L.LayerGroup | null>;
  historyLayerGroup: React.MutableRefObject<L.LayerGroup | null>;
  isRadarMode: boolean;
}

export const useFlightPlanDrawing = ({
  mapInstance,
  flightPlanLayerGroup,
  historyLayerGroup,
  isRadarMode,
}: UseFlightPlanDrawingProps) => {
  const currentSelectedAircraftRef = useRef<string | null>(null);
  const currentSelectedIdsRef = useRef<Set<string>>(new Set());

  // Draw flight plans for multiple aircraft
  const drawMultipleFlightPlans = useCallback(
    (aircrafts: PositionUpdate[], shouldZoom = false) => {
      if (
        !mapInstance.current ||
        !flightPlanLayerGroup.current ||
        !historyLayerGroup.current
      )
        return;

      // Clear previous layers
      flightPlanLayerGroup.current.clearLayers();
      historyLayerGroup.current.clearLayers();

      // Update the selected IDs ref
      currentSelectedIdsRef.current = new Set(
        aircrafts.map((ac) => ac.callsign || ac.id)
      );

      // Draw flight path for each aircraft
      aircrafts.forEach((aircraft, index) => {
        const color = FLIGHT_PATH_COLORS[index % FLIGHT_PATH_COLORS.length]!;

        // Draw history/flight path in two parts:
        // 1. Main path (all except last point) - solid, where aircraft has been
        // 2. Trailing segment (last two points) - faded, current trajectory
        const history = aircraft.flightPath || [];

        if (history.length >= 2) {
          // Draw the main historical path (excluding last point)
          const mainPath = history.slice(0, -1);
          if (mainPath.length >= 2) {
            for (const segment of splitPathAtAntimeridian(mainPath)) {
              if (segment.length >= 2) {
                const historyPolyline = L.polyline(segment, {
                  color: color,
                  weight: isRadarMode ? 2 : 4,
                  opacity: isRadarMode ? 0.7 : 0.8,
                  smoothFactor: 1,
                  dashArray: isRadarMode ? "5, 5" : "",
                });
                historyLayerGroup.current!.addLayer(historyPolyline);
              }
            }
          }

          // Draw faded trailing segment (connects to aircraft's current position)
          const trailingSegment = history.slice(-2);
          if (trailingSegment.length === 2) {
            for (const segment of splitPathAtAntimeridian(trailingSegment)) {
              if (segment.length >= 2) {
                const trailingPolyline = L.polyline(segment, {
                  color: color,
                  weight: isRadarMode ? 1 : 2,
                  opacity: isRadarMode ? 0.3 : 0.4,
                  smoothFactor: 1,
                  dashArray: "4, 4",
                });
                historyLayerGroup.current!.addLayer(trailingPolyline);
              }
            }
          }
        }

        // Draw flight plan waypoints
        if (aircraft.flightPlan) {
          try {
            const waypoints = JSON.parse(aircraft.flightPlan);

            if (waypoints.length > 0) {
              const coordinates: [number, number][] = [];
              const activeWaypointIndex = findActiveWaypointIndex(
                aircraft,
                waypoints
              );

              waypoints.forEach((wp: any, wpIndex: number) => {
                if (wp.lat && wp.lon) {
                  coordinates.push([wp.lat, wp.lon]);

                  const popupContent = `
                    <div style="font-family: system-ui; padding: 4px; color: ${
                      isRadarMode ? "#00ff00" : "#333"
                    }; background-color: ${
                      isRadarMode ? "rgba(0,0,0,0.8)" : "white"
                    }; border: ${isRadarMode ? "1px solid #00ff00" : "none"};">
                      <div style="font-size: 10px; color: ${color}; margin-bottom: 4px;">${aircraft.flightNo || aircraft.callsign}</div>
                      <strong style="color: ${
                        isRadarMode ? "#00ffff" : "#f542e3"
                      }; font-size: 14px;">${wp.ident}</strong>
                      <div style="font-size: 11px; color: ${
                        isRadarMode ? "#99ff99" : "#666"
                      }; margin-top: 2px;">${wp.type}</div>
                      <div style="margin-top: 6px; font-size: 12px;">
                        <div>Alt: <strong>${
                          wp.alt ? wp.alt + " ft" : "N/A"
                        }</strong></div>
                        <div>Speed: <strong>${
                          wp.spd ? wp.spd + " kt" : "N/A"
                        }</strong></div>
                      </div>
                    </div>
                  `;

                  const icon = isRadarMode
                    ? wpIndex === activeWaypointIndex
                      ? RadarActiveWaypointIcon
                      : RadarWaypointIcon
                    : wpIndex === activeWaypointIndex
                      ? ActiveWaypointIcon
                      : WaypointIcon;

                  const waypointMarker = L.marker([wp.lat, wp.lon], {
                    icon: icon,
                    title: wp.ident,
                    zIndexOffset: 100,
                  })
                    .bindPopup(popupContent, {
                      className: isRadarMode ? "radar-popup" : "",
                    })
                    .addTo(flightPlanLayerGroup.current!);

                  waypointMarker.on("click", (e) => {
                    L.DomEvent.stopPropagation(e);
                  });
                }
              });

              if (coordinates.length >= 2) {
                for (const segment of splitPathAtAntimeridian(coordinates)) {
                  if (segment.length >= 2) {
                    const plannedPolyline = L.polyline(segment, {
                      color: color,
                      weight: isRadarMode ? 2 : 3,
                      opacity: isRadarMode ? 0.7 : 0.6,
                      dashArray: isRadarMode ? "8, 8" : "10, 5",
                    });
                    flightPlanLayerGroup.current!.addLayer(plannedPolyline);
                  }
                }
              }
            }
          } catch (error) {
            console.error("Error parsing flight plan:", error);
          }
        }
      });

      // Update current selected ref with the last aircraft
      if (aircrafts.length > 0) {
        const lastAircraft = aircrafts[aircrafts.length - 1]!;
        currentSelectedAircraftRef.current =
          lastAircraft.callsign || lastAircraft.id;
      }
    },
    [isRadarMode, mapInstance, flightPlanLayerGroup, historyLayerGroup]
  );

  // Legacy single aircraft drawing (for backwards compatibility)
  const drawFlightPlan = useCallback(
    (aircraft: PositionUpdate, shouldZoom = false) => {
      drawMultipleFlightPlans([aircraft], shouldZoom);
    },
    [drawMultipleFlightPlans]
  );

  const clearHistoryPolyline = useCallback(() => {
    currentSelectedIdsRef.current.clear();
  }, []);

  return {
    drawFlightPlan,
    drawMultipleFlightPlans,
    currentSelectedAircraftRef,
    clearHistoryPolyline,
  };
};
