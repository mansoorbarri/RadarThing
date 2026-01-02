import { useEffect, useRef } from "react";
import L from "leaflet";
import { type Airport } from "~/components/map";

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
  const highlightRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!mapInstance.current) return;

    if (highlightRef.current) {
      mapInstance.current.removeLayer(highlightRef.current);
      highlightRef.current = null;
    }

    if (!selectedAirport) return;

    mapInstance.current.setView(
      [selectedAirport.lat, selectedAirport.lon],
      15,
      { animate: true },
    );

    highlightRef.current = L.circle(
      [selectedAirport.lat, selectedAirport.lon],
      {
        radius: 2500,
        color: isRadarMode ? "#22d3ee" : "#3b82f6",
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.05,
        interactive: false,
      },
    ).addTo(mapInstance.current);
  }, [selectedAirport, isRadarMode, mapInstance]);
};
