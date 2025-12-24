import { useEffect, useRef } from "react";
import L from "leaflet";

interface UseWeatherOverlayLayerProps {
  mapInstance: React.MutableRefObject<L.Map | null>;
  isWeatherOverlayEnabled: boolean;
  isHazardsEnabled?: boolean;
}

export const useWeatherOverlayLayer = ({
  mapInstance,
  isWeatherOverlayEnabled,
  isHazardsEnabled = false,
}: UseWeatherOverlayLayerProps) => {
  const weatherLayerRef = useRef<L.TileLayer | null>(null);
  const thunderLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (!mapInstance.current) return;

    if (isWeatherOverlayEnabled) {
      if (!weatherLayerRef.current) {
        weatherLayerRef.current = L.tileLayer(
          `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY}`,
          {
            maxZoom: 18,
            attribution: "Weather data © OpenWeatherMap",
            opacity: 0.9,
            zIndex: 100000,
          },
        );
      }
      weatherLayerRef.current.addTo(mapInstance.current);
      if (isHazardsEnabled) {
        if (!thunderLayerRef.current) {
          const key = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY;
          if (key) {
            thunderLayerRef.current = L.tileLayer(
              `https://tile.openweathermap.org/map/thunder/{z}/{x}/{y}.png?appid=${key}`,
              {
                maxZoom: 18,
                attribution: "Thunder data © OpenWeatherMap",
                opacity: 0.8,
                zIndex: 100001,
              },
            );
          } else {
            // Fallback: RainViewer radar tiles (public)
            thunderLayerRef.current = L.tileLayer(
              `https://tilecache.rainviewer.com/v2/radar/nowcast/0/256/{z}/{x}/{y}/2/1_1.png`,
              {
                maxZoom: 18,
                attribution: "Radar © RainViewer",
                opacity: 0.6,
                zIndex: 100001,
              },
            );
          }
        }
        thunderLayerRef.current!.addTo(mapInstance.current);
      } else if (thunderLayerRef.current) {
        mapInstance.current.removeLayer(thunderLayerRef.current);
      }
    } else {
      if (weatherLayerRef.current) {
        mapInstance.current.removeLayer(weatherLayerRef.current);
        weatherLayerRef.current = null;
      }
      if (thunderLayerRef.current) {
        mapInstance.current.removeLayer(thunderLayerRef.current);
        thunderLayerRef.current = null;
      }
    }

    return () => {
      if (mapInstance.current && weatherLayerRef.current) {
        mapInstance.current.removeLayer(weatherLayerRef.current);
        weatherLayerRef.current = null;
      }
    };
  }, [mapInstance, isWeatherOverlayEnabled, isHazardsEnabled]);
};