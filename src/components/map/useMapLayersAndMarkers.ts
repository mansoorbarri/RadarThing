// components/map/useMapLayersAndMarkers.ts
import { useEffect, useRef } from "react";
import L from "leaflet";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { type Airport } from "~/components/map"; // Adjusted path
import {
  getAircraftDivIcon,
  getRadarAircraftDivIcon,
  AirportIcon,
  RadarAirportIcon,
} from "./MapIcons";

// Track active animations to cancel them when new position arrives
const activeAnimations = new Map<L.Marker, number>();

// Track animation target destinations to avoid restarting animations on re-renders
const animationTargets = new Map<L.Marker, { lat: number; lng: number }>();

// Track last update time per marker to measure actual update intervals
const lastUpdateTimes = new Map<L.Marker, number>();

// Track whether the map is currently zooming - pause all marker DOM mutations during zoom
let isZooming = false;

// Cancel all running animations without touching marker positions (used on zoomstart).
// Leaflet's CSS zoom transform will handle visual scaling — calling setLatLng here
// would fight with that transform and cause jumping.
function cancelAllAnimations() {
  activeAnimations.forEach((frameId) => cancelAnimationFrame(frameId));
  activeAnimations.clear();
}

// Track tab visibility - skip animation when returning from hidden
let wasTabHidden = false;
let skipNextAnimation = false;

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      wasTabHidden = true;
    } else if (wasTabHidden) {
      // Tab just became visible after being hidden - skip animation for next update
      skipNextAnimation = true;
      wasTabHidden = false;
      // Reset flag after a short delay to allow normal animation to resume
      setTimeout(() => {
        skipNextAnimation = false;
      }, 100);
    }
  });
}

// Smoothly animate marker to new position (or jump if returning from hidden tab)
function slideTo(
  marker: L.Marker,
  destLat: number,
  destLng: number,
) {
  // Cancel any existing animation for this marker
  const existingAnimation = activeAnimations.get(marker);
  if (existingAnimation) {
    cancelAnimationFrame(existingAnimation);
    activeAnimations.delete(marker);
  }

  // Store the target destination
  animationTargets.set(marker, { lat: destLat, lng: destLng });

  // If map is zooming, don't animate or call setLatLng — Leaflet's
  // CSS zoom transform handles visual positioning during zoom.
  // The target is stored above so the next post-zoom update picks it up.
  if (isZooming) {
    return;
  }

  // Measure actual interval between position updates to use as animation duration
  const now = performance.now();
  const lastUpdate = lastUpdateTimes.get(marker);
  lastUpdateTimes.set(marker, now);
  const duration = lastUpdate ? Math.min(now - lastUpdate, 10000) : 3000;

  // If returning from hidden tab, jump directly to position
  if (skipNextAnimation) {
    marker.setLatLng([destLat, destLng]);
    return;
  }

  const start = performance.now();
  const startLat = marker.getLatLng().lat;
  const startLng = marker.getLatLng().lng;
  const deltaLat = destLat - startLat;
  const deltaLng = destLng - startLng;

  function animate(currentTime: number) {
    // If zoom started mid-animation, stop — don't call setLatLng during zoom
    if (isZooming) {
      activeAnimations.delete(marker);
      return;
    }

    const elapsed = currentTime - start;
    const progress = Math.min(elapsed / duration, 1);

    // Linear interpolation for constant speed movement
    const newLat = startLat + deltaLat * progress;
    const newLng = startLng + deltaLng * progress;

    marker.setLatLng([newLat, newLng]);

    if (progress < 1) {
      const frameId = requestAnimationFrame(animate);
      activeAnimations.set(marker, frameId);
    } else {
      activeAnimations.delete(marker);
    }
  }

  const frameId = requestAnimationFrame(animate);
  activeAnimations.set(marker, frameId);
}

interface UseMapLayersAndMarkersProps {
  mapInstance: React.MutableRefObject<L.Map | null>;
  aircraftMarkersLayer: React.MutableRefObject<L.LayerGroup | null>;
  airportMarkersLayer: React.MutableRefObject<L.LayerGroup | null>;
  osmLayer: React.MutableRefObject<L.TileLayer | null>;
  satelliteHybridLayer: React.MutableRefObject<L.TileLayer | null>;
  radarBaseLayer: React.MutableRefObject<L.TileLayer | null>;
  openAIPLayer: React.MutableRefObject<L.TileLayer | null>;
  aircrafts: PositionUpdate[];
  airports: Airport[];
  isOSMMode: boolean;
  isRadarMode: boolean;
  isOpenAIPEnabled: boolean;
  selectedAircraftIds: string[];
  selectedAirport?: Airport;
  currentSelectedAircraftRef: React.MutableRefObject<string | null>;
  drawFlightPlan: (aircraft: PositionUpdate, shouldZoom?: boolean) => void;
  onAircraftSelect: (aircraft: PositionUpdate | null, ctrlKey?: boolean) => void;
  onAirportSelect?: (airport: Airport) => void;
  showTags: boolean;
  showConflicts: boolean;
  onConflictsChange?: (conflicts: ConflictAlertSummary[]) => void;
  mapReady: boolean;
  isMobile: boolean;
}

type ConflictSeverity = "high" | "medium" | "low";

interface ConflictAlert {
  aircraftA: PositionUpdate;
  aircraftB: PositionUpdate;
  horizontalSeparationNm: number;
  verticalSeparationFt: number;
  timeToCpaMinutes: number;
  severity: ConflictSeverity;
  cpaMidpoint: [number, number];
}

export interface ConflictAlertSummary {
  id: string;
  callsignA: string;
  callsignB: string;
  severity: ConflictSeverity;
  horizontalSeparationNm: number;
  verticalSeparationFt: number;
  timeToCpaMinutes: number;
}

const NM_PER_DEG_LAT = 60;
const LOOKAHEAD_MINUTES = 6;
const MAX_INITIAL_DISTANCE_NM = 30;
const HORIZONTAL_THRESHOLD_NM = 3;
const VERTICAL_THRESHOLD_FT = 1200;
const MAX_DISPLAYED_CONFLICTS = 40;

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function getVelocityVectorNmPerMinute(aircraft: PositionUpdate) {
  const speedKts = Math.max(0, toFiniteNumber(aircraft.speed, 0));
  const headingRad = toRadians(toFiniteNumber(aircraft.heading, 0));
  const speedNmPerMinute = speedKts / 60;

  return {
    east: speedNmPerMinute * Math.sin(headingRad),
    north: speedNmPerMinute * Math.cos(headingRad),
  };
}

function getRelativeOffsetNm(
  from: PositionUpdate,
  to: PositionUpdate,
): { east: number; north: number; cosLat: number } {
  const avgLatRad = toRadians((from.lat + to.lat) / 2);
  const cosLat = Math.max(0.2, Math.cos(avgLatRad));

  return {
    east: (to.lon - from.lon) * NM_PER_DEG_LAT * cosLat,
    north: (to.lat - from.lat) * NM_PER_DEG_LAT,
    cosLat,
  };
}

function getConflictSeverity(
  horizontalSeparationNm: number,
  verticalSeparationFt: number,
): ConflictSeverity {
  if (horizontalSeparationNm <= 1.2 && verticalSeparationFt <= 700) {
    return "high";
  }
  if (horizontalSeparationNm <= 2 && verticalSeparationFt <= 1000) {
    return "medium";
  }
  return "low";
}

function getConflictStyle(severity: ConflictSeverity) {
  if (severity === "high") {
    return { color: "#ef4444", weight: 3, radius: 7 };
  }
  if (severity === "medium") {
    return { color: "#f59e0b", weight: 2.5, radius: 6 };
  }
  return { color: "#facc15", weight: 2, radius: 5 };
}

function detectConflicts(aircrafts: PositionUpdate[]): ConflictAlert[] {
  const conflicts: ConflictAlert[] = [];

  for (let i = 0; i < aircrafts.length; i++) {
    const aircraftA = aircrafts[i];
    if (!aircraftA) continue;

    const velocityA = getVelocityVectorNmPerMinute(aircraftA);
    const altitudeA = toFiniteNumber(aircraftA.altMSL ?? aircraftA.alt, 0);
    const vSpeedA = toFiniteNumber(aircraftA.vspeed, 0) / 60;

    for (let j = i + 1; j < aircrafts.length; j++) {
      const aircraftB = aircrafts[j];
      if (!aircraftB) continue;

      const offset = getRelativeOffsetNm(aircraftA, aircraftB);
      const currentHorizontalNm = Math.hypot(offset.east, offset.north);

      if (currentHorizontalNm > MAX_INITIAL_DISTANCE_NM) {
        continue;
      }

      const velocityB = getVelocityVectorNmPerMinute(aircraftB);
      const relativeVelocityEast = velocityB.east - velocityA.east;
      const relativeVelocityNorth = velocityB.north - velocityA.north;
      const relativeVelocitySquared =
        relativeVelocityEast * relativeVelocityEast +
        relativeVelocityNorth * relativeVelocityNorth;

      let timeToCpa = 0;
      if (relativeVelocitySquared > 1e-8) {
        timeToCpa =
          -(
            offset.east * relativeVelocityEast +
            offset.north * relativeVelocityNorth
          ) / relativeVelocitySquared;
      }
      timeToCpa = Math.min(Math.max(timeToCpa, 0), LOOKAHEAD_MINUTES);

      const cpaEast = offset.east + relativeVelocityEast * timeToCpa;
      const cpaNorth = offset.north + relativeVelocityNorth * timeToCpa;
      const horizontalSeparationNm = Math.hypot(cpaEast, cpaNorth);

      if (horizontalSeparationNm > HORIZONTAL_THRESHOLD_NM) {
        continue;
      }

      const altitudeB = toFiniteNumber(aircraftB.altMSL ?? aircraftB.alt, 0);
      const vSpeedB = toFiniteNumber(aircraftB.vspeed, 0) / 60;
      const verticalSeparationFt = Math.abs(
        altitudeB +
          vSpeedB * timeToCpa -
          (altitudeA + vSpeedA * timeToCpa),
      );

      if (verticalSeparationFt > VERTICAL_THRESHOLD_FT) {
        continue;
      }

      const aircraftAXAtCpa = velocityA.east * timeToCpa;
      const aircraftAYAtCpa = velocityA.north * timeToCpa;
      const aircraftBXAtCpa = offset.east + velocityB.east * timeToCpa;
      const aircraftBYAtCpa = offset.north + velocityB.north * timeToCpa;
      const midpointEast = (aircraftAXAtCpa + aircraftBXAtCpa) / 2;
      const midpointNorth = (aircraftAYAtCpa + aircraftBYAtCpa) / 2;
      const cpaLat = aircraftA.lat + midpointNorth / NM_PER_DEG_LAT;
      const cpaLon =
        aircraftA.lon + midpointEast / (NM_PER_DEG_LAT * offset.cosLat);

      conflicts.push({
        aircraftA,
        aircraftB,
        horizontalSeparationNm,
        verticalSeparationFt,
        timeToCpaMinutes: timeToCpa,
        severity: getConflictSeverity(horizontalSeparationNm, verticalSeparationFt),
        cpaMidpoint: [cpaLat, cpaLon],
      });
    }
  }

  return conflicts.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return a.horizontalSeparationNm - b.horizontalSeparationNm;
  });
}

export const useMapLayersAndMarkers = ({
  mapInstance,
  aircraftMarkersLayer,
  airportMarkersLayer,
  osmLayer,
  satelliteHybridLayer,
  radarBaseLayer,
  openAIPLayer,
  aircrafts,
  airports,
  isOSMMode,
  isRadarMode,
  isOpenAIPEnabled,
  selectedAircraftIds,
  selectedAirport,
  currentSelectedAircraftRef,
  drawFlightPlan,
  onAircraftSelect,
  onAirportSelect,
  showTags,
  showConflicts,
  onConflictsChange,
  mapReady,
  isMobile,
}: UseMapLayersAndMarkersProps) => {
  // Track existing markers by aircraft ID for smooth updates
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const conflictLayerRef = useRef<L.LayerGroup | null>(null);

  // Use refs for callbacks to avoid stale closures in event handlers
  const onAircraftSelectRef = useRef(onAircraftSelect);
  const drawFlightPlanRef = useRef(drawFlightPlan);
  const aircraftsRef = useRef(aircrafts);

  useEffect(() => {
    onAircraftSelectRef.current = onAircraftSelect;
  }, [onAircraftSelect]);

  useEffect(() => {
    drawFlightPlanRef.current = drawFlightPlan;
  }, [drawFlightPlan]);

  useEffect(() => {
    aircraftsRef.current = aircrafts;
  }, [aircrafts]);

  // Pause marker animations during zoom to prevent jitter
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const onZoomStart = () => {
      isZooming = true;
      cancelAllAnimations();
    };
    const onZoomEnd = () => {
      isZooming = false;
    };

    map.on("zoomstart", onZoomStart);
    map.on("zoomend", onZoomEnd);

    return () => {
      map.off("zoomstart", onZoomStart);
      map.off("zoomend", onZoomEnd);
    };
  }, [mapInstance]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return;

    if (!conflictLayerRef.current) {
      conflictLayerRef.current = L.layerGroup().addTo(map);
    }

    return () => {
      if (!conflictLayerRef.current) return;
      map.removeLayer(conflictLayerRef.current);
      conflictLayerRef.current = null;
    };
  }, [mapInstance, mapReady]);

  // Effect for managing base layers (OSM/Satellite/Radar)
  useEffect(() => {
    if (
      !mapInstance.current ||
      !osmLayer.current ||
      !satelliteHybridLayer.current ||
      !radarBaseLayer.current
    )
      return;

    const map = mapInstance.current;

    // Remove all base layers first
    if (map.hasLayer(osmLayer.current)) {
      map.removeLayer(osmLayer.current);
    }
    if (map.hasLayer(satelliteHybridLayer.current)) {
      map.removeLayer(satelliteHybridLayer.current);
    }
    if (map.hasLayer(radarBaseLayer.current)) {
      map.removeLayer(radarBaseLayer.current);
    }

    // Add the appropriate base layer
    if (isRadarMode) {
      map.addLayer(radarBaseLayer.current);
    } else if (isOSMMode) {
      map.addLayer(osmLayer.current);
    } else {
      map.addLayer(satelliteHybridLayer.current);
    }
  }, [
    mapInstance,
    isOSMMode,
    isRadarMode,
    osmLayer,
    satelliteHybridLayer,
    radarBaseLayer,
  ]);

  // Effect for managing OpenAIP layer
  useEffect(() => {
    if (!mapInstance.current || !openAIPLayer.current) return;

    if (isOpenAIPEnabled) {
      if (!mapInstance.current.hasLayer(openAIPLayer.current)) {
        mapInstance.current.addLayer(openAIPLayer.current);
      }
      openAIPLayer.current.bringToFront();
    } else {
      if (mapInstance.current.hasLayer(openAIPLayer.current)) {
        mapInstance.current.removeLayer(openAIPLayer.current);
      }
    }
  }, [mapInstance, isOpenAIPEnabled, openAIPLayer]);

  // Clear markers when layer reference changes
  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      markers.clear();
    };
  }, [aircraftMarkersLayer]);

  // Effect for managing aircraft markers with smooth animation
  useEffect(() => {
    if (!aircraftMarkersLayer.current || !mapReady) return;

    const currentAircraftIds = new Set(aircrafts.map((ac) => ac.callsign || ac.id));
    const existingMarkers = markersRef.current;

    // Remove markers for aircraft that are no longer present
    existingMarkers.forEach((marker, id) => {
      if (!currentAircraftIds.has(id)) {
        aircraftMarkersLayer.current!.removeLayer(marker);
        existingMarkers.delete(id);
      }
    });

    // Convert selectedAircraftIds to a Set for O(1) lookup
    const selectedIdsSet = new Set(selectedAircraftIds);

    // Update or create markers for each aircraft
    aircrafts.forEach((aircraft) => {
      const id = aircraft.callsign || aircraft.id;
      // Pass the first selected ID for backwards compatibility with icon rendering
      // The icon will be highlighted if this aircraft's ID is in the set
      const isSelected = selectedIdsSet.has(id);
      const selectedIdForIcon = isSelected ? id : null;
      const icon = isRadarMode
        ? getRadarAircraftDivIcon(aircraft, selectedIdForIcon, showTags, isMobile)
        : getAircraftDivIcon(aircraft, selectedIdForIcon, showTags, isMobile);

      const existingMarker = existingMarkers.get(id);

      if (existingMarker) {
        // Update existing marker - animate to new position
        const newLat = aircraft.lat;
        const newLng = aircraft.lon;

        // Only start a new animation if the TARGET destination changed
        // (not the current mid-animation position, which would restart animations on re-renders)
        const currentTarget = animationTargets.get(existingMarker);
        if (
          !currentTarget ||
          Math.abs(currentTarget.lat - newLat) > 0.0001 ||
          Math.abs(currentTarget.lng - newLng) > 0.0001
        ) {
          slideTo(existingMarker, newLat, newLng);
        }

        // Skip icon updates during zoom — setIcon() destroys and recreates the
        // marker's DOM element, which conflicts with Leaflet's CSS zoom transform
        // and causes markers to visually jump. Icons refresh on the next SSE update
        // after zoom ends.
        if (!isZooming) {
          existingMarker.setIcon(icon);
        }
      } else {
        // Create new marker
        const marker = L.marker([aircraft.lat, aircraft.lon], {
          title: aircraft.callsign,
          icon: icon,
          zIndexOffset: 1000,
        }).addTo(aircraftMarkersLayer.current!);

        // Store the aircraft ID for lookup in click handler
        const aircraftId = id;
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          const ctrlKey = e.originalEvent?.ctrlKey || e.originalEvent?.metaKey || false;
          // Get the latest aircraft data from the ref
          const currentAircraft = aircraftsRef.current.find(
            (ac) => (ac.callsign || ac.id) === aircraftId
          );
          if (currentAircraft) {
            drawFlightPlanRef.current(currentAircraft, true);
            onAircraftSelectRef.current(currentAircraft, ctrlKey);
          }
        });

        existingMarkers.set(id, marker);
      }
    });

    // Note: Flight path redrawing for selected aircraft is handled by the parent
    // component (page.tsx) which properly redraws all selected aircraft paths
    // when aircraft data updates. Redrawing here would cause flickering in
    // multi-select mode since it would only redraw one aircraft's path.
  }, [
    aircrafts,
    isRadarMode,
    selectedAircraftIds,
    aircraftMarkersLayer,
    drawFlightPlan,
    onAircraftSelect,
    showTags,
    mapReady,
    isMobile,
  ]);

  useEffect(() => {
    const conflictLayer = conflictLayerRef.current;
    if (!conflictLayer) return;

    conflictLayer.clearLayers();
    if (!showConflicts || !mapReady) {
      onConflictsChange?.([]);
      return;
    }

    const conflicts = detectConflicts(aircrafts).slice(0, MAX_DISPLAYED_CONFLICTS);
    onConflictsChange?.(
      conflicts.map((conflict) => ({
        id: `${conflict.aircraftA.id}-${conflict.aircraftB.id}`,
        callsignA: conflict.aircraftA.callsign || conflict.aircraftA.flightNo || conflict.aircraftA.id,
        callsignB: conflict.aircraftB.callsign || conflict.aircraftB.flightNo || conflict.aircraftB.id,
        severity: conflict.severity,
        horizontalSeparationNm: conflict.horizontalSeparationNm,
        verticalSeparationFt: conflict.verticalSeparationFt,
        timeToCpaMinutes: conflict.timeToCpaMinutes,
      })),
    );

    conflicts.forEach((conflict) => {
      const style = getConflictStyle(conflict.severity);

      L.polyline(
        [
          [conflict.aircraftA.lat, conflict.aircraftA.lon],
          [conflict.aircraftB.lat, conflict.aircraftB.lon],
        ],
        {
          color: style.color,
          weight: style.weight,
          opacity: 0.65,
          dashArray: "5, 7",
          interactive: false,
        },
      ).addTo(conflictLayer);

      L.circleMarker(conflict.cpaMidpoint, {
        radius: style.radius,
        color: style.color,
        fillColor: style.color,
        fillOpacity: 0.35,
        weight: 1.5,
        interactive: false,
      })
        .addTo(conflictLayer)
        .bindTooltip(
          `CPA ${conflict.horizontalSeparationNm.toFixed(1)}nm / ${Math.round(conflict.verticalSeparationFt)}ft in ${conflict.timeToCpaMinutes.toFixed(1)}m`,
          {
            direction: "top",
            opacity: 0.95,
          },
        );
    });
  }, [aircrafts, mapReady, onConflictsChange, showConflicts]);

  // Use refs for callbacks to avoid stale closures
  const onAirportSelectRef = useRef(onAirportSelect);
  useEffect(() => {
    onAirportSelectRef.current = onAirportSelect;
  }, [onAirportSelect]);

  // Effect for managing airport markers with zoom-based visibility
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !airportMarkersLayer.current) return;

    const updateAirportMarkers = () => {
      if (!airportMarkersLayer.current) return;

      const currentZoom = map.getZoom();
      const shouldShowAirports = currentZoom >= 8; // Only show airports when zoomed in

      // Clear existing markers
      airportMarkersLayer.current.clearLayers();

      if (!shouldShowAirports) return;

      // Get map bounds to only show airports in view (performance optimization)
      const bounds = map.getBounds();

      airports.forEach((airport) => {
        // Skip airports outside current view
        if (!bounds.contains([airport.lat, airport.lon])) return;

        const isSelected = selectedAirport?.icao === airport.icao;

        // Create custom icon based on selection state
        const icon = L.divIcon({
          className: 'custom-airport-marker',
          html: `
            <div style="
              width: ${isSelected ? '12px' : '8px'};
              height: ${isSelected ? '12px' : '8px'};
              background-color: ${isSelected ? (isRadarMode ? '#22d3ee' : '#3b82f6') : (isRadarMode ? '#06b6d4' : '#60a5fa')};
              border: 2px solid ${isSelected ? (isRadarMode ? '#22d3ee' : '#3b82f6') : (isRadarMode ? 'rgba(6, 182, 212, 0.4)' : 'rgba(96, 165, 250, 0.4)')};
              border-radius: 50%;
              box-shadow: ${isSelected ? '0 0 12px rgba(34, 211, 238, 0.6)' : '0 0 6px rgba(6, 182, 212, 0.3)'};
              transition: all 0.2s ease;
            "></div>
          `,
          iconSize: [isSelected ? 16 : 12, isSelected ? 16 : 12],
          iconAnchor: [isSelected ? 8 : 6, isSelected ? 8 : 6],
        });

        let popupContent = `
          <div style="color: ${isRadarMode ? "#00ffff" : "#333"}; background-color: ${
            isRadarMode ? "rgba(0,0,0,0.8)" : "white"
          }; border: ${isRadarMode ? "1px solid #00ffff" : "none"}; padding: 4px;">
            <strong style="color: ${
              isRadarMode ? "#00ffff" : "#333"
            };">Airport:</strong> ${airport.name}<br>(${airport.icao})
          </div>
        `;

        if (airport.frequencies && airport.frequencies.length > 0) {
          popupContent += `
            <div style="margin-top: 8px;">
              <strong style="color: ${
                isRadarMode ? "#99ff99" : "#333"
              };">Frequencies:</strong><br>
              <ul style="list-style-type: none; padding: 0; margin: 0;">
          `;
          airport.frequencies.forEach((freq) => {
            popupContent += `
                <li style="font-size: 12px; margin-bottom: 2px;">
                  <span style="color: ${
                    isRadarMode ? "#00ffff" : "#666"
                  };">${freq.type}:</span>
                  <span style="font-weight: bold; color: ${
                    isRadarMode ? "#fff" : "#333"
                  };">${freq.frequency} MHz</span>
                </li>
            `;
          });
          popupContent += `
              </ul>
            </div>
          `;
        }

        const marker = L.marker([airport.lat, airport.lon], {
          title: airport.name,
          icon: icon,
        })
          .addTo(airportMarkersLayer.current!)
          .bindPopup(popupContent, {
            className: isRadarMode ? "radar-popup" : "",
          });

        // Add click handler to select airport
        marker.on('click', () => {
          if (onAirportSelectRef.current) {
            onAirportSelectRef.current(airport);
          }
        });
      });
    };

    // Update markers on mount and when dependencies change
    updateAirportMarkers();

    // Update markers when zoom changes
    map.on('zoomend', updateAirportMarkers);
    map.on('moveend', updateAirportMarkers);

    return () => {
      map.off('zoomend', updateAirportMarkers);
      map.off('moveend', updateAirportMarkers);
    };
  }, [airports, isRadarMode, airportMarkersLayer, mapInstance, selectedAirport]);
};
