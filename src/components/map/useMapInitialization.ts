import { useEffect, useRef } from "react";
import L from "leaflet";
import {
  HeadingModeControl,
  RadarModeControl,
  OpenAIPControl,
  WeatherOverlayControl,
  OSMControl,
  RadarSettingsControl,
} from "~/components/map/MapControls";

interface UseMapInitializationProps {
  mapContainerId: string;
  setIsHeadingMode: React.Dispatch<React.SetStateAction<boolean>>;
  setIsRadarMode: () => void;
  setIsOSMMode?: React.Dispatch<React.SetStateAction<boolean>>;
  setIsOpenAIPEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setIsWeatherOverlayEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  canUseRadarMode: boolean;
  onMapClick: (e: L.LeafletMouseEvent) => void;
  setHeadingControlRef: React.MutableRefObject<HeadingModeControl | null>;
  setRadarControlRef: React.MutableRefObject<RadarModeControl | null>;
  setOSMControlRef?: React.MutableRefObject<OSMControl | null>;
  setOpenAIPControlRef: React.MutableRefObject<OpenAIPControl | null>;
  setWeatherControlRef: React.MutableRefObject<WeatherOverlayControl | null>;
  setSettingsControlRef: React.MutableRefObject<RadarSettingsControl | null>;
}

interface MapRefs {
  mapInstance: React.MutableRefObject<L.Map | null>;
  flightPlanLayerGroup: React.MutableRefObject<L.LayerGroup | null>;
  aircraftMarkersLayer: React.MutableRefObject<L.LayerGroup | null>;
  airportMarkersLayer: React.MutableRefObject<L.LayerGroup | null>;
  historyLayerGroup: React.MutableRefObject<L.LayerGroup | null>;
  osmLayer: React.MutableRefObject<L.TileLayer | null>;
  satelliteHybridLayer: React.MutableRefObject<L.TileLayer | null>;
  radarBaseLayer: React.MutableRefObject<L.TileLayer | null>;
  openAIPLayer: React.MutableRefObject<L.TileLayer | null>;
  weatherOverlayLayer: React.MutableRefObject<L.TileLayer | null>;
}

export const useMapInitialization = ({
  mapContainerId,
  setIsHeadingMode,
  setIsRadarMode,
  setIsOSMMode,
  setIsOpenAIPEnabled,
  setIsWeatherOverlayEnabled,
  setIsSettingsOpen,
  canUseRadarMode,
  onMapClick,
  setHeadingControlRef,
  setRadarControlRef,
  setOSMControlRef,
  setOpenAIPControlRef,
  setWeatherControlRef,
  setSettingsControlRef,
}: UseMapInitializationProps): MapRefs => {
  const mapInstance = useRef<L.Map | null>(null);
  const flightPlanLayerGroup = useRef<L.LayerGroup | null>(null);
  const aircraftMarkersLayer = useRef<L.LayerGroup | null>(null);
  const airportMarkersLayer = useRef<L.LayerGroup | null>(null);
  const historyLayerGroup = useRef<L.LayerGroup | null>(null);

  const osmLayer = useRef<L.TileLayer | null>(null);
  const satelliteHybridLayer = useRef<L.TileLayer | null>(null);
  const radarBaseLayer = useRef<L.TileLayer | null>(null);
  const openAIPLayer = useRef<L.TileLayer | null>(null);
  const weatherOverlayLayer = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (mapInstance.current) return;

    const worldBounds = L.latLngBounds(L.latLng(-85, -360), L.latLng(85, 360));

    const map = L.map(mapContainerId, {
      zoomAnimation: true,
      minZoom: 3,
      maxZoom: 18,
      maxBounds: worldBounds,
      attributionControl: false,
    }).setView([20, 0], 3);

    mapInstance.current = map;

    L.control
      .attribution({
        prefix:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      })
      .addTo(map);

    osmLayer.current = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        minZoom: 3,
        bounds: worldBounds,
      },
    );

    satelliteHybridLayer.current = L.tileLayer(
      "https://mt0.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}",
      {
        maxZoom: 18,
        minZoom: 3,
        bounds: worldBounds,
      },
    );

    radarBaseLayer.current = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 18,
        minZoom: 3,
        bounds: worldBounds,
      },
    );

    const openAIPUrl = `https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey=${process.env.NEXT_PUBLIC_OPENAIP_API_KEY}`;
    openAIPLayer.current = L.tileLayer(openAIPUrl, {
      maxZoom: 19,
      minZoom: 3,
      noWrap: true,
      bounds: worldBounds,
    });

    satelliteHybridLayer.current.addTo(map);

    flightPlanLayerGroup.current = L.layerGroup().addTo(map);
    aircraftMarkersLayer.current = L.layerGroup().addTo(map);
    airportMarkersLayer.current = L.layerGroup().addTo(map);
    historyLayerGroup.current = L.layerGroup().addTo(map);

    const headingControl = new HeadingModeControl({}, setIsHeadingMode);
    map.addControl(headingControl);
    setHeadingControlRef.current = headingControl;

    if (canUseRadarMode) {
      const radarControl = new RadarModeControl({}, setIsRadarMode);
      map.addControl(radarControl);
      setRadarControlRef.current = radarControl;
    } else {
      setRadarControlRef.current = null;
    }

    if (setIsOSMMode && setOSMControlRef) {
      const osmControl = new OSMControl({}, setIsOSMMode);
      map.addControl(osmControl);
      setOSMControlRef.current = osmControl;
    }

    const openAIPControl = new OpenAIPControl({}, setIsOpenAIPEnabled);
    map.addControl(openAIPControl);
    setOpenAIPControlRef.current = openAIPControl;

    const weatherControl = new WeatherOverlayControl(
      {},
      setIsWeatherOverlayEnabled,
    );
    map.addControl(weatherControl);
    setWeatherControlRef.current = weatherControl;

    const settingsControl = new RadarSettingsControl({}, setIsSettingsOpen);
    map.addControl(settingsControl);
    setSettingsControlRef.current = settingsControl;

    map.on("click", onMapClick);

    return () => {
      map.off("click", onMapClick);
      map.remove();
      mapInstance.current = null;
    };
  }, [mapContainerId, onMapClick, canUseRadarMode]);

  return {
    mapInstance,
    flightPlanLayerGroup,
    aircraftMarkersLayer,
    airportMarkersLayer,
    historyLayerGroup,
    osmLayer,
    satelliteHybridLayer,
    radarBaseLayer,
    openAIPLayer,
    weatherOverlayLayer,
  };
};
