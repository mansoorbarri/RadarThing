// components/map/useSelectedAirportHandling.ts
import { useEffect, useRef } from "react";
import L from "leaflet";
import { type Airport } from "~/components/map"; // Adjusted path

interface UseSelectedAirportHandlingProps {
  mapInstance: React.MutableRefObject<L.Map | null>;
  selectedAirport: Airport | undefined;
  isRadarMode: boolean;
}

export const useSelectedAirportHandling = ({
  mapInstance,
  selectedAirport,
  isRadarMode,
}: UseSelectedAirportHandlingProps) => {
  const selectedAirportMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapInstance.current) return;

    if (selectedAirport) {
      mapInstance.current.setView(
        [selectedAirport.lat, selectedAirport.lon],
        12,
      );

      if (selectedAirportMarkerRef.current) {
        mapInstance.current.removeLayer(selectedAirportMarkerRef.current);
      }
      selectedAirportMarkerRef.current = L.marker(
        [selectedAirport.lat, selectedAirport.lon],
        {
          icon: L.divIcon({
            className: "selected-airport-marker",
            html: `
              <div style="
                background-color: ${isRadarMode ? "#00ffff" : "#3b82f6"};
                color: ${isRadarMode ? "black" : "white"};
                padding: 5px 10px;
                border-radius: 5px;
                font-weight: bold;
                white-space: nowrap;
                border: 2px solid ${isRadarMode ? "#00ffff" : "white"};
                box-shadow: 0 2px 5px rgba(0,0,0,0.4);
                transform: translate(-50%, -100%);
              ">
                ${selectedAirport.icao}
              </div>
              <div style="
                width: 0;
                height: 0;
                border-left: 8px solid transparent;
                border-right: 8px solid transparent;
                border-top: 8px solid ${isRadarMode ? "#00ffff" : "#3b82f6"};
                position: absolute;
                bottom: 0px;
                left: 50%;
                transform: translateX(-50%);
              "></div>
            `,
            iconSize: [80, 40],
            iconAnchor: [40, 40],
          }),
          zIndexOffset: 2000,
        },
      )
        .addTo(mapInstance.current)
        .bindPopup(
          `<strong>${selectedAirport.name}</strong><br>${selectedAirport.icao}`,
          { className: isRadarMode ? "radar-popup" : "" },
        )
        .openPopup();
    } else {
      if (selectedAirportMarkerRef.current) {
        mapInstance.current.removeLayer(selectedAirportMarkerRef.current);
        selectedAirportMarkerRef.current = null;
      }
    }
  }, [selectedAirport, isRadarMode, mapInstance]);
};
