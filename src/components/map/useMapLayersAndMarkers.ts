// components/map/useMapLayersAndMarkers.ts
import { useEffect } from "react";
import L from "leaflet";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { type Airport } from "~/components/map"; // Adjusted path
import {
  getAircraftDivIcon,
  getRadarAircraftDivIcon,
  AirportIcon,
  RadarAirportIcon,
} from "./MapIcons";
import { aircraftHistoryRef } from "./useFlightPlanDrawing";

interface UseMapLayersAndMarkersProps {
  mapInstance: React.MutableRefObject<L.Map | null>;
  aircraftMarkersLayer: React.MutableRefObject<L.LayerGroup | null>;
  airportMarkersLayer: React.MutableRefObject<L.LayerGroup | null>;
  satelliteHybridLayer: React.MutableRefObject<L.TileLayer | null>;
  radarBaseLayer: React.MutableRefObject<L.TileLayer | null>;
  openAIPLayer: React.MutableRefObject<L.TileLayer | null>;
  aircrafts: PositionUpdate[];
  airports: Airport[];
  isRadarMode: boolean;
  isOpenAIPEnabled: boolean;
  selectedAircraftId: string | null;
  currentSelectedAircraftRef: React.MutableRefObject<string | null>;
  drawFlightPlan: (aircraft: PositionUpdate, shouldZoom?: boolean) => void;
  onAircraftSelect: (aircraft: PositionUpdate | null) => void;
}

export const useMapLayersAndMarkers = ({
  mapInstance,
  aircraftMarkersLayer,
  airportMarkersLayer,
  satelliteHybridLayer,
  radarBaseLayer,
  openAIPLayer,
  aircrafts,
  airports,
  isRadarMode,
  isOpenAIPEnabled,
  selectedAircraftId,
  currentSelectedAircraftRef,
  drawFlightPlan,
  onAircraftSelect,
}: UseMapLayersAndMarkersProps) => {
  // Effect for managing base layers (Radar/Satellite)
  useEffect(() => {
    if (
      !mapInstance.current ||
      !satelliteHybridLayer.current ||
      !radarBaseLayer.current
    )
      return;

    if (isRadarMode) {
      if (mapInstance.current.hasLayer(satelliteHybridLayer.current)) {
        mapInstance.current.removeLayer(satelliteHybridLayer.current);
      }
      if (!mapInstance.current.hasLayer(radarBaseLayer.current)) {
        mapInstance.current.addLayer(radarBaseLayer.current);
      }
    } else {
      if (mapInstance.current.hasLayer(radarBaseLayer.current)) {
        mapInstance.current.removeLayer(radarBaseLayer.current);
      }
      if (!mapInstance.current.hasLayer(satelliteHybridLayer.current)) {
        mapInstance.current.addLayer(satelliteHybridLayer.current);
      }
    }
  }, [mapInstance, isRadarMode, satelliteHybridLayer, radarBaseLayer]);

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

  // Effect for managing aircraft history and markers
  useEffect(() => {
    if (!aircraftMarkersLayer.current) return;

    aircrafts.forEach((aircraft) => {
      const aircraftId = aircraft.id || aircraft.callsign;
      const currentPosition: L.LatLngTuple = [aircraft.lat, aircraft.lon];

      if (!aircraftHistoryRef.current.has(aircraftId)) {
        aircraftHistoryRef.current.set(aircraftId, [currentPosition]);
      } else {
        const history = aircraftHistoryRef.current.get(aircraftId)!;
        const lastPosition = history[history.length - 1];

        if (
          lastPosition &&
          (lastPosition[0] !== currentPosition[0] ||
            lastPosition[1] !== currentPosition[1])
        ) {
          history.push(currentPosition);
          if (history.length > 500) {
            history.shift();
          }
        }
      }
    });

    const currentAircraftIds = new Set(
      aircrafts.map((ac) => ac.id || ac.callsign),
    );
    for (const [id] of aircraftHistoryRef.current) {
      if (!currentAircraftIds.has(id)) {
        aircraftHistoryRef.current.delete(id);
      }
    }

    aircraftMarkersLayer.current.clearLayers();
    aircrafts.forEach((aircraft) => {
      const icon = isRadarMode
        ? getRadarAircraftDivIcon(aircraft, selectedAircraftId)
        : getAircraftDivIcon(aircraft, selectedAircraftId);

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
    });

    if (currentSelectedAircraftRef.current) {
      const selectedAircraft = aircrafts.find(
        (ac) => (ac.id || ac.callsign) === currentSelectedAircraftRef.current,
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
  ]);

  // Effect for managing airport markers
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
};
