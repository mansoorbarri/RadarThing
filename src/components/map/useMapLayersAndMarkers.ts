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

// Smoothly animate marker to new position
function slideTo(
  marker: L.Marker,
  destLat: number,
  destLng: number,
  duration = 3000
) {
  // Cancel any existing animation for this marker
  const existingAnimation = activeAnimations.get(marker);
  if (existingAnimation) {
    cancelAnimationFrame(existingAnimation);
  }

  const start = performance.now();
  const startLat = marker.getLatLng().lat;
  const startLng = marker.getLatLng().lng;
  const deltaLat = destLat - startLat;
  const deltaLng = destLng - startLng;

  function animate(currentTime: number) {
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
  selectedAircraftId: string | null;
  currentSelectedAircraftRef: React.MutableRefObject<string | null>;
  drawFlightPlan: (aircraft: PositionUpdate, shouldZoom?: boolean) => void;
  onAircraftSelect: (aircraft: PositionUpdate | null) => void;
  showTags: boolean;
  mapReady: boolean;
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
  selectedAircraftId,
  currentSelectedAircraftRef,
  drawFlightPlan,
  onAircraftSelect,
  showTags,
  mapReady,
}: UseMapLayersAndMarkersProps) => {
  // Track existing markers by aircraft ID for smooth updates
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

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

    // Update or create markers for each aircraft
    aircrafts.forEach((aircraft) => {
      const id = aircraft.callsign || aircraft.id;
      const icon = isRadarMode
        ? getRadarAircraftDivIcon(aircraft, selectedAircraftId, showTags)
        : getAircraftDivIcon(aircraft, selectedAircraftId, showTags);

      const existingMarker = existingMarkers.get(id);

      if (existingMarker) {
        // Update existing marker - animate to new position
        const currentLatLng = existingMarker.getLatLng();
        const newLat = aircraft.lat;
        const newLng = aircraft.lon;

        // Only animate if position actually changed
        if (
          Math.abs(currentLatLng.lat - newLat) > 0.0001 ||
          Math.abs(currentLatLng.lng - newLng) > 0.0001
        ) {
          slideTo(existingMarker, newLat, newLng, 3000); // Match 3s update interval for continuous motion
        }

        // Update the icon (for heading rotation, selection state, etc.)
        existingMarker.setIcon(icon);
      } else {
        // Create new marker
        const marker = L.marker([aircraft.lat, aircraft.lon], {
          title: aircraft.callsign,
          icon: icon,
          zIndexOffset: 1000,
        }).addTo(aircraftMarkersLayer.current!);

        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          drawFlightPlan(aircraft, true);
          onAircraftSelect(aircraft);
        });

        existingMarkers.set(id, marker);
      }
    });

    if (currentSelectedAircraftRef.current) {
      const selectedAircraft = aircrafts.find(
        (ac) => (ac.callsign || ac.id) === currentSelectedAircraftRef.current,
      );
      if (selectedAircraft) {
        drawFlightPlan(selectedAircraft, false);
      }
    }
  }, [
    aircrafts,
    isRadarMode,
    selectedAircraftId,
    aircraftMarkersLayer,
    currentSelectedAircraftRef,
    drawFlightPlan,
    onAircraftSelect,
    showTags,
    mapReady,
  ]);

  // Effect for managing airport markers
  // COMMENTED OUT - Uncomment to show airports on map
  /*
  useEffect(() => {
    if (!airportMarkersLayer.current) return;

    airportMarkersLayer.current.clearLayers();
    airports.forEach((airport) => {
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

      const icon = isRadarMode ? RadarAirportIcon : AirportIcon;

      L.marker([airport.lat, airport.lon], {
        title: airport.name,
        icon: icon,
      })
        .addTo(airportMarkersLayer.current!)
        .bindPopup(popupContent, {
          className: isRadarMode ? "radar-popup" : "",
        });
    });
  }, [airports, isRadarMode, airportMarkersLayer]);
  */
};
