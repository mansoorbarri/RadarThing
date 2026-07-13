import { useCallback, useRef } from "react";
import L from "leaflet";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { type ImportedFlightPlan } from "~/lib/flightPlanImport";
import {
  findActiveWaypointIndex,
  preparePathForWorldCopy,
  unwrapPath,
} from "~/lib/map-utils";
import {
  WaypointIcon,
  ActiveWaypointIcon,
  RadarWaypointIcon,
  RadarActiveWaypointIcon,
} from "./MapIcons";

const FLIGHT_PATH_COLORS = [
  "#00ff00",
  "#ff6b6b",
  "#4dabf7",
  "#ffd43b",
  "#da77f2",
  "#69db7c",
  "#ff922b",
  "#22b8cf",
];

interface FlightPlanWaypointLike {
  ident?: string;
  type?: string;
  lat?: number | string;
  lon?: number | string;
  alt?: number | string | null;
  spd?: number | string | null;
}

interface ArrivalAirport {
  icao: string;
  lat: number;
  lon: number;
}

interface UseFlightPlanDrawingProps {
  mapInstance: React.MutableRefObject<L.Map | null>;
  flightPlanLayerGroup: React.MutableRefObject<L.LayerGroup | null>;
  importedFlightPlanLayerGroup: React.MutableRefObject<L.LayerGroup | null>;
  historyLayerGroup: React.MutableRefObject<L.LayerGroup | null>;
  isRadarMode: boolean;
  airports: ArrivalAirport[];
  showFlightPlanWaypoints: boolean;
}

function fitMapToCoords(
  map: L.Map,
  coords: [number, number][],
  maxZoom = 10,
  padding: [number, number] = [50, 50],
) {
  if (coords.length === 0) return;

  if (coords.length === 1) {
    const [onlyCoord] = coords;
    if (!onlyCoord) return;

    map.setView(onlyCoord, Math.max(map.getZoom(), 8), { animate: true });
    return;
  }

  map.fitBounds(L.latLngBounds(coords), {
    padding,
    maxZoom,
    animate: true,
  });
}

function getUnwrappedWaypointCoords(
  waypoints: FlightPlanWaypointLike[],
  referenceLon?: number,
) {
  const rawCoords: [number, number][] = [];
  const validWaypoints: { wp: FlightPlanWaypointLike; wpIndex: number }[] = [];

  waypoints.forEach((wp, wpIndex) => {
    const lat =
      typeof wp.lat === "number"
        ? wp.lat
        : typeof wp.lat === "string"
          ? Number(wp.lat)
          : Number.NaN;
    const lon =
      typeof wp.lon === "number"
        ? wp.lon
        : typeof wp.lon === "string"
          ? Number(wp.lon)
          : Number.NaN;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    validWaypoints.push({ wp: { ...wp, lat, lon }, wpIndex });
    rawCoords.push([lat, lon]);
  });

  const coords = unwrapPath(rawCoords);
  if (coords.length >= 2 && referenceLon !== undefined) {
    const midLon = (coords[0]![1] + coords[coords.length - 1]![1]) / 2;
    const shift = Math.round((referenceLon - midLon) / 360) * 360;
    if (shift !== 0) {
      for (const coord of coords) {
        coord[1] += shift;
      }
    }
  }

  return { coords, validWaypoints };
}

export const useFlightPlanDrawing = ({
  mapInstance,
  flightPlanLayerGroup,
  importedFlightPlanLayerGroup,
  historyLayerGroup,
  isRadarMode,
  airports,
  showFlightPlanWaypoints,
}: UseFlightPlanDrawingProps) => {
  const currentSelectedAircraftRef = useRef<string | null>(null);
  const currentSelectedIdsRef = useRef<Set<string>>(new Set());
  const lastDrawnAircraftsRef = useRef<PositionUpdate[]>([]);

  const drawImportedFlightPlan = useCallback(
    (flightPlan: ImportedFlightPlan, shouldZoom = true) => {
      if (!mapInstance.current || !importedFlightPlanLayerGroup.current) return;

      importedFlightPlanLayerGroup.current.clearLayers();

      const { coords, validWaypoints } = getUnwrappedWaypointCoords(
        flightPlan.waypoints,
      );

      coords.forEach((coord, index) => {
        const { wp } = validWaypoints[index]!;
        const altitudeText =
          wp.alt !== null && wp.alt !== undefined && wp.alt !== ""
            ? `${wp.alt} ft`
            : "N/A";
        const speedText =
          wp.spd !== null && wp.spd !== undefined && wp.spd !== ""
            ? `${wp.spd} kt`
            : "N/A";

        const popupContent = `
          <div style="font-family: system-ui; padding: 4px; color: ${
            isRadarMode ? "#c7ffd8" : "#111827"
          }; background-color: ${
            isRadarMode ? "rgba(0,0,0,0.88)" : "white"
          }; border: ${isRadarMode ? "1px solid rgba(34,211,238,0.65)" : "none"};">
            <div style="font-size: 10px; color: ${
              isRadarMode ? "#67e8f9" : "#0f766e"
            }; margin-bottom: 4px;">Imported flight plan</div>
            <strong style="color: ${
              isRadarMode ? "#fef08a" : "#0f172a"
            }; font-size: 14px;">${wp.ident ?? `WP${index + 1}`}</strong>
            <div style="font-size: 11px; color: ${
              isRadarMode ? "#99ff99" : "#475569"
            }; margin-top: 2px;">${wp.type ?? "WPT"}</div>
            <div style="margin-top: 6px; font-size: 12px;">
              <div>Alt: <strong>${altitudeText}</strong></div>
              <div>Speed: <strong>${speedText}</strong></div>
            </div>
          </div>
        `;

        const isEndpoint =
          index === 0 || index === validWaypoints.length - 1;
        const icon = isRadarMode || isEndpoint ? RadarWaypointIcon : WaypointIcon;

        const marker = L.marker(coord, {
          icon,
          title: wp.ident ?? `WP${index + 1}`,
          zIndexOffset: 140,
        })
          .bindPopup(popupContent, {
            className: isRadarMode ? "radar-popup" : "",
          })
          .addTo(importedFlightPlanLayerGroup.current!);

        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
        });
      });

      if (coords.length >= 2) {
        importedFlightPlanLayerGroup.current.addLayer(
          L.polyline(coords, {
            color: isRadarMode ? "#67e8f9" : "#0f766e",
            weight: isRadarMode ? 3 : 4,
            opacity: isRadarMode ? 0.85 : 0.78,
            dashArray: isRadarMode ? "10, 8" : "12, 6",
          }),
        );
      }

      if (shouldZoom) {
        fitMapToCoords(mapInstance.current, coords, 8, [60, 60]);
      }
    },
    [importedFlightPlanLayerGroup, isRadarMode, mapInstance],
  );

  const clearImportedFlightPlan = useCallback(() => {
    importedFlightPlanLayerGroup.current?.clearLayers();
  }, [importedFlightPlanLayerGroup]);

  const drawMultipleFlightPlans = useCallback(
    (aircrafts: PositionUpdate[], shouldZoom = false) => {
      if (
        !mapInstance.current ||
        !flightPlanLayerGroup.current ||
        !historyLayerGroup.current
      ) {
        return;
      }

      flightPlanLayerGroup.current.clearLayers();
      historyLayerGroup.current.clearLayers();
      lastDrawnAircraftsRef.current = aircrafts;

      currentSelectedIdsRef.current = new Set(
        aircrafts.map((aircraft) => aircraft.callsign || aircraft.id),
      );

      const zoomCoords: [number, number][] = [];

      aircrafts.forEach((aircraft, index) => {
        const color = FLIGHT_PATH_COLORS[index % FLIGHT_PATH_COLORS.length]!;
        const history = preparePathForWorldCopy(
          aircraft.flightPath || [],
          aircraft.lon,
        );

        if (history.length >= 2) {
          const mainPath = history.slice(0, -1);
          if (mainPath.length >= 2) {
            historyLayerGroup.current!.addLayer(
              L.polyline(mainPath, {
                color,
                weight: isRadarMode ? 2 : 4,
                opacity: isRadarMode ? 0.7 : 0.8,
                smoothFactor: 1,
                dashArray: isRadarMode ? "5, 5" : "",
              }),
            );
          }

          const trailingSegment = history.slice(-2);
          if (trailingSegment.length === 2) {
            historyLayerGroup.current!.addLayer(
              L.polyline(trailingSegment, {
                color,
                weight: isRadarMode ? 1 : 2,
                opacity: isRadarMode ? 0.3 : 0.4,
                smoothFactor: 1,
                dashArray: "4, 4",
              }),
            );
          }

          zoomCoords.push(...history);
        }

        if (Number.isFinite(aircraft.lat) && Number.isFinite(aircraft.lon)) {
          zoomCoords.push([aircraft.lat, aircraft.lon]);
        }

        const arrivalAirport = airports.find(
          (airport) =>
            airport.icao.trim().toUpperCase() ===
            aircraft.arrival?.trim().toUpperCase(),
        );

        if (!showFlightPlanWaypoints) {
          if (
            arrivalAirport &&
            Number.isFinite(aircraft.lat) &&
            Number.isFinite(aircraft.lon)
          ) {
            const directPath = preparePathForWorldCopy(
              [
                [aircraft.lat, aircraft.lon],
                [arrivalAirport.lat, arrivalAirport.lon],
              ],
              aircraft.lon,
            );
            flightPlanLayerGroup.current!.addLayer(
              L.polyline(directPath, {
                color: "#9ca3af",
                weight: isRadarMode ? 2 : 3,
                opacity: 0.85,
                dashArray: "4, 8",
              }),
            );
          }
          return;
        }

        if (!aircraft.flightPlan) return;

        try {
          const waypoints = JSON.parse(aircraft.flightPlan) as FlightPlanWaypointLike[];
          if (waypoints.length === 0) return;

          const activeWaypointIndex = findActiveWaypointIndex(
            aircraft,
            waypoints,
          );
          const { coords, validWaypoints } = getUnwrappedWaypointCoords(
            waypoints,
            aircraft.lon,
          );

          coords.forEach((coord, waypointArrayIndex) => {
            const { wp, wpIndex } = validWaypoints[waypointArrayIndex]!;
            const hasSpeed =
              wp.spd !== null && wp.spd !== undefined && wp.spd !== "";
            const speedLine = hasSpeed
              ? `<div>Speed: <strong>${wp.spd} kt</strong></div>`
              : "";

            const popupContent = `
              <div style="font-family: system-ui; padding: 4px; color: ${
                isRadarMode ? "#00ff00" : "#333"
              }; background-color: ${
                isRadarMode ? "rgba(0,0,0,0.8)" : "white"
              }; border: ${isRadarMode ? "1px solid #00ff00" : "none"};">
                <div style="font-size: 10px; color: ${color}; margin-bottom: 4px;">${aircraft.flightNo || aircraft.callsign}</div>
                <strong style="color: ${
                  isRadarMode ? "#00ffff" : "#f542e3"
                }; font-size: 14px;">${wp.ident ?? `WP${wpIndex + 1}`}</strong>
                <div style="font-size: 11px; color: ${
                  isRadarMode ? "#99ff99" : "#666"
                }; margin-top: 2px;">${wp.type ?? "WPT"}</div>
                <div style="margin-top: 6px; font-size: 12px;">
                  <div>Alt: <strong>${
                    wp.alt !== null && wp.alt !== undefined && wp.alt !== ""
                      ? `${wp.alt} ft`
                      : "N/A"
                  }</strong></div>
                  ${speedLine}
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

            const marker = L.marker(coord, {
              icon,
              title: wp.ident ?? `WP${wpIndex + 1}`,
              zIndexOffset: 100,
            })
              .bindPopup(popupContent, {
                className: isRadarMode ? "radar-popup" : "",
              })
              .addTo(flightPlanLayerGroup.current!);

            marker.on("click", (e) => {
              L.DomEvent.stopPropagation(e);
            });
          });

          if (coords.length >= 2) {
            flightPlanLayerGroup.current!.addLayer(
              L.polyline(coords, {
                color,
                weight: isRadarMode ? 2 : 3,
                opacity: isRadarMode ? 0.7 : 0.6,
                dashArray: isRadarMode ? "8, 8" : "10, 5",
              }),
            );
            zoomCoords.push(...coords);
          }
        } catch (error) {
          console.error("Error parsing flight plan:", error);
        }
      });

      if (aircrafts.length > 0) {
        const lastAircraft = aircrafts[aircrafts.length - 1]!;
        currentSelectedAircraftRef.current =
          lastAircraft.callsign || lastAircraft.id;
      }

      if (shouldZoom) {
        fitMapToCoords(mapInstance.current, zoomCoords);
      }
    },
    [
      airports,
      flightPlanLayerGroup,
      historyLayerGroup,
      isRadarMode,
      mapInstance,
      showFlightPlanWaypoints,
    ],
  );

  const drawFlightPlan = useCallback(
    (aircraft: PositionUpdate, shouldZoom = false) => {
      drawMultipleFlightPlans([aircraft], shouldZoom);
    },
    [drawMultipleFlightPlans],
  );

  const clearHistoryPolyline = useCallback(() => {
    currentSelectedIdsRef.current.clear();
    lastDrawnAircraftsRef.current = [];
  }, []);

  const redrawFlightPlans = useCallback(() => {
    if (lastDrawnAircraftsRef.current.length > 0) {
      drawMultipleFlightPlans(lastDrawnAircraftsRef.current, false);
    }
  }, [drawMultipleFlightPlans]);

  return {
    drawFlightPlan,
    drawMultipleFlightPlans,
    drawImportedFlightPlan,
    clearImportedFlightPlan,
    currentSelectedAircraftRef,
    clearHistoryPolyline,
    redrawFlightPlans,
  };
};
