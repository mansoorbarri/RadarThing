// components/map/useFlightPlanDrawing.ts
import { useCallback, useRef } from "react";
import L from "leaflet";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { findActiveWaypointIndex } from "~/lib/map-utils";
import {
  WaypointIcon,
  ActiveWaypointIcon,
  RadarWaypointIcon,
  RadarActiveWaypointIcon,
} from "./MapIcons";

interface UseFlightPlanDrawingProps {
  mapInstance: React.MutableRefObject<L.Map | null>;
  flightPlanLayerGroup: React.MutableRefObject<L.LayerGroup | null>;
  historyLayerGroup: React.MutableRefObject<L.LayerGroup | null>;
  isRadarMode: boolean;
  onAircraftSelect: (aircraft: PositionUpdate | null) => void;
  setSelectedAircraftId: React.Dispatch<React.SetStateAction<string | null>>;
}

export const aircraftHistoryRef = {
  current: new Map<string, L.LatLngTuple[]>(),
};

export const useFlightPlanDrawing = ({
  mapInstance,
  flightPlanLayerGroup,
  historyLayerGroup,
  isRadarMode,
  onAircraftSelect,
  setSelectedAircraftId,
}: UseFlightPlanDrawingProps) => {
  const currentSelectedAircraftRef = useRef<string | null>(null);

  const drawFlightPlan = useCallback(
    (aircraft: PositionUpdate, shouldZoom = false) => {
      if (
        !mapInstance.current ||
        !flightPlanLayerGroup.current ||
        !historyLayerGroup.current
      )
        return;

      flightPlanLayerGroup.current.clearLayers();
      historyLayerGroup.current.clearLayers();
      const newSelectedAircraftId = aircraft.id || aircraft.callsign;
      currentSelectedAircraftRef.current = newSelectedAircraftId;
      setSelectedAircraftId(newSelectedAircraftId);

      const aircraftId = aircraft.id || aircraft.callsign;
      const history = aircraftHistoryRef.current.get(aircraftId) || [];

      if (history.length >= 2) {
        const historyPolyline = L.polyline(history, {
          color: isRadarMode ? "#00ff00" : "#00ff00",
          weight: isRadarMode ? 2 : 4,
          opacity: isRadarMode ? 0.7 : 0.8,
          smoothFactor: 1,
          dashArray: isRadarMode ? "5, 5" : "",
        });
        historyLayerGroup.current.addLayer(historyPolyline);
      }

      if (aircraft.flightPlan) {
        try {
          const waypoints = JSON.parse(aircraft.flightPlan);

          if (waypoints.length > 0) {
            const coordinates: L.LatLngTuple[] = [];
            const activeWaypointIndex = findActiveWaypointIndex(
              aircraft,
              waypoints,
            );

            waypoints.forEach((wp: any, index: number) => {
              if (wp.lat && wp.lon) {
                coordinates.push([wp.lat, wp.lon]);

                const popupContent = `
                  <div style="font-family: system-ui; padding: 4px; color: ${
                    isRadarMode ? "#00ff00" : "#333"
                  }; background-color: ${
                    isRadarMode ? "rgba(0,0,0,0.8)" : "white"
                  }; border: ${isRadarMode ? "1px solid #00ff00" : "none"};">
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
                  ? index === activeWaypointIndex
                    ? RadarActiveWaypointIcon
                    : RadarWaypointIcon
                  : index === activeWaypointIndex
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
              const plannedPolyline = L.polyline(coordinates, {
                color: isRadarMode ? "#00ffff" : "#ff00ff",
                weight: isRadarMode ? 2 : 3,
                opacity: isRadarMode ? 0.7 : 0.6,
                dashArray: isRadarMode ? "8, 8" : "10, 5",
              });
              flightPlanLayerGroup.current.addLayer(plannedPolyline);
            }
          }
        } catch (error) {
          console.error("Error parsing flight plan:", error);
        }
      }
    },
    [
      isRadarMode,
      setSelectedAircraftId,
      mapInstance,
      flightPlanLayerGroup,
      historyLayerGroup,
    ],
  );

  return { drawFlightPlan, currentSelectedAircraftRef };
};
