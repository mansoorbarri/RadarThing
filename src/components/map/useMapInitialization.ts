import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  HeadingModeControl,
  RadarModeControl,
  LockedRadarModeControl,
  OpenAIPControl,
  OSMControl,
  RadarSettingsControl,
} from "~/components/map/MapControls";

interface UseMapInitializationProps {
  mapContainerId: string;
  setIsHeadingMode: React.Dispatch<React.SetStateAction<boolean>>;
  setIsRadarMode: () => void;
  setIsOSMMode?: () => void;
  setIsOpenAIPEnabled: () => void;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  canUseRadarMode: boolean;
  onMapClick: (e: L.LeafletMouseEvent) => void;
  setHeadingControlRef: React.MutableRefObject<HeadingModeControl | null>;
  setRadarControlRef: React.MutableRefObject<RadarModeControl | null>;
  setOSMControlRef?: React.MutableRefObject<OSMControl | null>;
  setOpenAIPControlRef: React.MutableRefObject<OpenAIPControl | null>;
  setSettingsControlRef: React.MutableRefObject<RadarSettingsControl | null>;
  isMobile?: boolean;
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
  mapReady: boolean;
}

export const useMapInitialization = ({
  mapContainerId,
  setIsHeadingMode,
  setIsRadarMode,
  setIsOSMMode,
  setIsOpenAIPEnabled,
  setIsSettingsOpen,
  canUseRadarMode,
  onMapClick,
  setHeadingControlRef,
  setRadarControlRef,
  setOSMControlRef,
  setOpenAIPControlRef,
  setSettingsControlRef,
  isMobile = false,
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

  // State to signal when map and layers are ready
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (mapInstance.current) return;

    const map = L.map(mapContainerId, {
      zoomAnimation: true,
      minZoom: isMobile ? 0 : 3,
      maxZoom: 18,
      // No maxBounds on mobile for unlimited panning, desktop has soft bounds
      ...(isMobile ? {} : {
        maxBounds: L.latLngBounds(L.latLng(-85, -540), L.latLng(85, 540)),
        maxBoundsViscosity: 1.0,
      }),
      attributionControl: false,
      zoomControl: !isMobile,
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
        minZoom: 0,
        className: "osm-tiles",
      },
    );

    satelliteHybridLayer.current = L.tileLayer(
      "https://mt0.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}",
      {
        maxZoom: 18,
        minZoom: 0,
      },
    );

    radarBaseLayer.current = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 18,
        minZoom: 0,
      },
    );

    const openAIPUrl = `https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey=${process.env.NEXT_PUBLIC_OPENAIP_API_KEY}`;
    openAIPLayer.current = L.tileLayer(openAIPUrl, {
      maxZoom: 19,
      minZoom: 0,
    });

    satelliteHybridLayer.current.addTo(map);

    flightPlanLayerGroup.current = L.layerGroup().addTo(map);
    aircraftMarkersLayer.current = L.layerGroup().addTo(map);
    airportMarkersLayer.current = L.layerGroup().addTo(map);
    historyLayerGroup.current = L.layerGroup().addTo(map);

    // Signal that map and layers are ready
    setMapReady(true);

    // Only add heading control on desktop
    // Note: Radar, OSM, OpenAIP, and Settings controls are added in a separate effect
    // to maintain proper ordering and handle Pro status changes
    if (!isMobile) {
      const headingControl = new HeadingModeControl({}, setIsHeadingMode);
      map.addControl(headingControl);
      setHeadingControlRef.current = headingControl;
    }

    map.on("click", onMapClick);

    return () => {
      map.off("click", onMapClick);
      map.remove();
      mapInstance.current = null;
    };
    // Intentionally excluding setState functions and canUseRadarMode
    // canUseRadarMode changes should NOT recreate the map - handle controls separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapContainerId, onMapClick]);

  // Separate effect to handle radar/OSM/OpenAIP/Settings controls
  // This ensures proper ordering: Radar -> OSM -> OpenAIP -> Settings
  // and handles Pro status changes for radar control
  const radarControlInstanceRef = useRef<L.Control | null>(null);
  const osmControlInstanceRef = useRef<L.Control | null>(null);
  const openAIPControlInstanceRef = useRef<L.Control | null>(null);
  const settingsControlInstanceRef = useRef<L.Control | null>(null);

  useEffect(() => {
    if (!mapInstance.current) return;

    const map = mapInstance.current;

    // Remove existing controls if any (always do cleanup)
    if (radarControlInstanceRef.current) {
      map.removeControl(radarControlInstanceRef.current);
      radarControlInstanceRef.current = null;
      setRadarControlRef.current = null;
    }
    if (osmControlInstanceRef.current) {
      map.removeControl(osmControlInstanceRef.current);
      osmControlInstanceRef.current = null;
      if (setOSMControlRef) setOSMControlRef.current = null;
    }
    if (openAIPControlInstanceRef.current) {
      map.removeControl(openAIPControlInstanceRef.current);
      openAIPControlInstanceRef.current = null;
      setOpenAIPControlRef.current = null;
    }
    if (settingsControlInstanceRef.current) {
      map.removeControl(settingsControlInstanceRef.current);
      settingsControlInstanceRef.current = null;
      setSettingsControlRef.current = null;
    }

    // Add controls in order: Radar -> OSM -> OpenAIP -> Settings
    // 1. Radar control
    if (canUseRadarMode) {
      const radarControl = new RadarModeControl({}, setIsRadarMode);
      map.addControl(radarControl);
      radarControlInstanceRef.current = radarControl;
      setRadarControlRef.current = radarControl;
    } else {
      const lockedRadarControl = new LockedRadarModeControl({});
      map.addControl(lockedRadarControl);
      radarControlInstanceRef.current = lockedRadarControl;
    }

    // 2. OSM control
    if (setIsOSMMode && setOSMControlRef) {
      const osmControl = new OSMControl({}, setIsOSMMode);
      map.addControl(osmControl);
      osmControlInstanceRef.current = osmControl;
      setOSMControlRef.current = osmControl;
    }

    // 3. OpenAIP control
    const openAIPControl = new OpenAIPControl({}, setIsOpenAIPEnabled);
    map.addControl(openAIPControl);
    openAIPControlInstanceRef.current = openAIPControl;
    setOpenAIPControlRef.current = openAIPControl;

    // 4. Settings control (always last)
    const settingsControl = new RadarSettingsControl({}, setIsSettingsOpen);
    map.addControl(settingsControl);
    settingsControlInstanceRef.current = settingsControl;
    setSettingsControlRef.current = settingsControl;
  }, [canUseRadarMode, setIsRadarMode, setRadarControlRef, setIsOSMMode, setOSMControlRef, setIsOpenAIPEnabled, setOpenAIPControlRef, setIsSettingsOpen, setSettingsControlRef]);

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
    mapReady,
  };
};
