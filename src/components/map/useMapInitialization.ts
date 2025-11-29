import { useEffect, useRef } from "react";
import L from "leaflet";
import {
  HeadingModeControl,
  RadarModeControl,
  OpenAIPControl,
} from "./MapControls";

interface UseMapInitializationProps {
  mapContainerId: string;
  setIsHeadingMode: React.Dispatch<React.SetStateAction<boolean>>;
  setIsRadarMode: React.Dispatch<React.SetStateAction<boolean>>;
  setIsOpenAIPEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  onMapClick: (e: L.LeafletMouseEvent) => void;
  setHeadingControlRef: React.MutableRefObject<HeadingModeControl | null>;
  setRadarControlRef: React.MutableRefObject<RadarModeControl | null>;
  setOpenAIPControlRef: React.MutableRefObject<OpenAIPControl | null>;
}

interface MapRefs {
  mapInstance: React.MutableRefObject<L.Map | null>;
  flightPlanLayerGroup: React.MutableRefObject<L.LayerGroup | null>;
  aircraftMarkersLayer: React.MutableRefObject<L.LayerGroup | null>;
  airportMarkersLayer: React.MutableRefObject<L.LayerGroup | null>;
  historyLayerGroup: React.MutableRefObject<L.LayerGroup | null>;
  satelliteHybridLayer: React.MutableRefObject<L.TileLayer | null>;
  radarBaseLayer: React.MutableRefObject<L.TileLayer | null>;
  openAIPLayer: React.MutableRefObject<L.TileLayer | null>;
}

export const useMapInitialization = ({
  mapContainerId,
  setIsHeadingMode,
  setIsRadarMode,
  setIsOpenAIPEnabled,
  onMapClick,
  setHeadingControlRef,
  setRadarControlRef,
  setOpenAIPControlRef,
}: UseMapInitializationProps): MapRefs => {
  const mapInstance = useRef<L.Map | null>(null);
  const flightPlanLayerGroup = useRef<L.LayerGroup | null>(null);
  const aircraftMarkersLayer = useRef<L.LayerGroup | null>(null);
  const airportMarkersLayer = useRef<L.LayerGroup | null>(null);
  const historyLayerGroup = useRef<L.LayerGroup | null>(null);

  const satelliteHybridLayer = useRef<L.TileLayer | null>(null);
  const radarBaseLayer = useRef<L.TileLayer | null>(null);
  const openAIPLayer = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (mapInstance.current) return;

    const worldBounds = L.latLngBounds(L.latLng(-85, -360), L.latLng(85, 360));

    const map = L.map(mapContainerId, {
      zoomAnimation: true,
      minZoom: 3,
      maxZoom: 18,
      maxBounds: worldBounds,
    }).setView([20, 0], 3);

    mapInstance.current = map;

    satelliteHybridLayer.current = L.tileLayer(
      "https://mt0.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}",
      {
        attribution: "Esri, Garmin, FAO, USGS, NPS",
        maxZoom: 18,
        minZoom: 3,
        transparent: true,
        bounds: worldBounds,
      },
    );

    radarBaseLayer.current = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 18,
        minZoom: 3,
        bounds: worldBounds,
      },
    );

    const openAIPUrl = `https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey=${process.env.NEXT_PUBLIC_OPENAIP_API_KEY}`;
    openAIPLayer.current = L.tileLayer(openAIPUrl, {
      attribution: '&copy; <a href="https://www.openaip.net/">OpenAIP</a>',
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

    const radarControl = new RadarModeControl({}, setIsRadarMode);
    map.addControl(radarControl);
    setRadarControlRef.current = radarControl;

    const openAIPControl = new OpenAIPControl({}, setIsOpenAIPEnabled);
    map.addControl(openAIPControl);
    setOpenAIPControlRef.current = openAIPControl;

    map.on("click", onMapClick);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [
    // ADDING ALL THESE DEPENDENCIES MAKES THE MAP RE-RENDER IN A LOOP
    // mapContainerId,
    // setIsHeadingMode,
    // setIsRadarMode,
    // setIsOpenAIPEnabled,
    // onMapClick,
    // setHeadingControlRef,
    // setRadarControlRef,
    // setOpenAIPControlRef,
  ]);

  return {
    mapInstance,
    flightPlanLayerGroup,
    aircraftMarkersLayer,
    airportMarkersLayer,
    historyLayerGroup,
    satelliteHybridLayer,
    radarBaseLayer,
    openAIPLayer,
  };
};
