import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import { getCookie, setCookie } from "~/lib/cookies";
import { type MapResetLocation } from "~/lib/mapResetLocation";
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
  hideUi?: boolean;
}

interface MapRefs {
  mapInstance: React.MutableRefObject<L.Map | null>;
  flightPlanLayerGroup: React.MutableRefObject<L.LayerGroup | null>;
  importedFlightPlanLayerGroup: React.MutableRefObject<L.LayerGroup | null>;
  aircraftMarkersLayer: React.MutableRefObject<L.LayerGroup | null>;
  airportMarkersLayer: React.MutableRefObject<L.LayerGroup | null>;
  historyLayerGroup: React.MutableRefObject<L.LayerGroup | null>;
  replayLayerGroup: React.MutableRefObject<L.LayerGroup | null>;
  osmLayer: React.MutableRefObject<L.TileLayer | null>;
  satelliteHybridLayer: React.MutableRefObject<L.TileLayer | null>;
  radarBaseLayer: React.MutableRefObject<L.TileLayer | null>;
  openAIPLayer: React.MutableRefObject<L.TileLayer | null>;
  weatherOverlayLayer: React.MutableRefObject<L.TileLayer | null>;
  mapReady: boolean;
  resetMapView: (targetLocation?: MapResetLocation | null) => void;
}

const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 3;
const USER_LOCATION_RESET_ZOOM = 5.5;
// On mobile, keep the full world visible without shrinking it so far that
// Leaflet shows additional wrapped world copies in the viewport.
const MOBILE_MIN_ZOOM = 1;
const DESKTOP_MIN_ZOOM = 3;
const TILE_MIN_NATIVE_ZOOM = 0;
const MAX_ZOOM = 18;

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
  hideUi = false,
}: UseMapInitializationProps): MapRefs => {
  const mapInstance = useRef<L.Map | null>(null);
  const flightPlanLayerGroup = useRef<L.LayerGroup | null>(null);
  const importedFlightPlanLayerGroup = useRef<L.LayerGroup | null>(null);
  const aircraftMarkersLayer = useRef<L.LayerGroup | null>(null);
  const airportMarkersLayer = useRef<L.LayerGroup | null>(null);
  const historyLayerGroup = useRef<L.LayerGroup | null>(null);
  const replayLayerGroup = useRef<L.LayerGroup | null>(null);

  const osmLayer = useRef<L.TileLayer | null>(null);
  const satelliteHybridLayer = useRef<L.TileLayer | null>(null);
  const radarBaseLayer = useRef<L.TileLayer | null>(null);
  const openAIPLayer = useRef<L.TileLayer | null>(null);
  const weatherOverlayLayer = useRef<L.TileLayer | null>(null);

  // State to signal when map and layers are ready
  const [mapReady, setMapReady] = useState(false);
  const mapMinZoom = isMobile ? MOBILE_MIN_ZOOM : DESKTOP_MIN_ZOOM;

  const resetMapView = useCallback((targetLocation?: MapResetLocation | null) => {
    if (!mapInstance.current) return;
    const center: [number, number] = targetLocation
      ? [targetLocation.lat, targetLocation.lng]
      : DEFAULT_CENTER;
    const zoom = targetLocation ? USER_LOCATION_RESET_ZOOM : DEFAULT_ZOOM;

    mapInstance.current.setView(center, zoom, {
      animate: true,
    });
    setCookie("map_zoom", String(zoom));
    setCookie("map_center_lat", String(center[0]));
    setCookie("map_center_lng", String(center[1]));
  }, []);

  useEffect(() => {
    if (mapInstance.current) return;

    // Restore saved map position or use defaults
    const savedZoom = parseFloat(getCookie("map_zoom") ?? "");
    const savedLat = parseFloat(getCookie("map_center_lat") ?? "");
    const savedLng = parseFloat(getCookie("map_center_lng") ?? "");

    const initialCenter: [number, number] =
      !isNaN(savedLat) && !isNaN(savedLng)
        ? [savedLat, savedLng]
        : DEFAULT_CENTER;
    const initialZoom = Math.min(
      MAX_ZOOM,
      Math.max(mapMinZoom, !isNaN(savedZoom) ? savedZoom : DEFAULT_ZOOM),
    );

    const map = L.map(mapContainerId, {
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
      minZoom: mapMinZoom,
      maxZoom: MAX_ZOOM,
      zoomSnap: 0.25,
      zoomDelta: 0.25,
      // No maxBounds on mobile for unlimited panning, desktop has soft bounds
      ...(isMobile
        ? {}
        : {
            maxBounds: L.latLngBounds(L.latLng(-85, -540), L.latLng(85, 540)),
            maxBoundsViscosity: 1.0,
          }),
      attributionControl: false,
      zoomControl: false,
    }).setView(initialCenter, initialZoom);

    mapInstance.current = map;

    // Shared tile loading optimizations
    const tileLoadingOptions = {
      keepBuffer: 6, // Buffer more tiles around viewport (default: 2)
      updateWhenIdle: false, // Update tiles while panning, not after
      updateWhenZooming: true, // Start loading tiles during zoom animation
    };

    osmLayer.current = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        minZoom: mapMinZoom,
        minNativeZoom: TILE_MIN_NATIVE_ZOOM,
        className: "osm-tiles",
        ...tileLoadingOptions,
      },
    );

    satelliteHybridLayer.current = L.tileLayer(
      "https://mt{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}",
      {
        subdomains: "0123", // Use mt0-mt3 for parallel loading
        maxZoom: MAX_ZOOM,
        minZoom: mapMinZoom,
        minNativeZoom: TILE_MIN_NATIVE_ZOOM,
        ...tileLoadingOptions,
      },
    );

    radarBaseLayer.current = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: MAX_ZOOM,
        minZoom: mapMinZoom,
        minNativeZoom: TILE_MIN_NATIVE_ZOOM,
        ...tileLoadingOptions,
      },
    );

    const openAIPUrl = `https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey=${process.env.NEXT_PUBLIC_OPENAIP_API_KEY}`;
    openAIPLayer.current = L.tileLayer(openAIPUrl, {
      maxZoom: 19,
      minZoom: mapMinZoom,
      minNativeZoom: TILE_MIN_NATIVE_ZOOM,
      ...tileLoadingOptions,
    });

    satelliteHybridLayer.current.addTo(map);

    flightPlanLayerGroup.current = L.layerGroup().addTo(map);
    importedFlightPlanLayerGroup.current = L.layerGroup().addTo(map);
    aircraftMarkersLayer.current = L.layerGroup().addTo(map);
    airportMarkersLayer.current = L.layerGroup().addTo(map);
    historyLayerGroup.current = L.layerGroup().addTo(map);
    replayLayerGroup.current = L.layerGroup().addTo(map);

    // Signal that map and layers are ready
    setMapReady(true);

    map.on("click", onMapClick);

    // Persist zoom and center to cookies on move/zoom
    const saveMapPosition = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      setCookie("map_zoom", String(zoom));
      setCookie("map_center_lat", String(center.lat));
      setCookie("map_center_lng", String(center.lng));
    };
    map.on("moveend", saveMapPosition);

    return () => {
      map.off("click", onMapClick);
      map.off("moveend", saveMapPosition);
      map.remove();
      mapInstance.current = null;
    };
    // Intentionally excluding setState functions and canUseRadarMode
    // canUseRadarMode changes should NOT recreate the map - handle controls separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapContainerId, mapMinZoom, onMapClick]);

  // Separate effect to handle radar/OSM/OpenAIP/Settings controls
  // This ensures proper ordering: Radar -> OSM -> OpenAIP -> Settings
  // and handles Pro status changes for radar control
  const radarControlInstanceRef = useRef<L.Control | null>(null);
  const osmControlInstanceRef = useRef<L.Control | null>(null);
  const openAIPControlInstanceRef = useRef<L.Control | null>(null);
  const settingsControlInstanceRef = useRef<L.Control | null>(null);
  const headingControlInstanceRef = useRef<L.Control | null>(null);
  const zoomControlInstanceRef = useRef<L.Control.Zoom | null>(null);
  const attributionControlInstanceRef = useRef<L.Control.Attribution | null>(
    null,
  );

  useEffect(() => {
    if (!mapInstance.current) return;

    const map = mapInstance.current;

    if (headingControlInstanceRef.current) {
      map.removeControl(headingControlInstanceRef.current);
      headingControlInstanceRef.current = null;
      setHeadingControlRef.current = null;
    }
    if (zoomControlInstanceRef.current) {
      map.removeControl(zoomControlInstanceRef.current);
      zoomControlInstanceRef.current = null;
    }
    if (attributionControlInstanceRef.current) {
      map.removeControl(attributionControlInstanceRef.current);
      attributionControlInstanceRef.current = null;
    }

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

    if (!hideUi && !isMobile) {
      const zoomControl = L.control.zoom({ position: "topleft" });
      map.addControl(zoomControl);
      zoomControlInstanceRef.current = zoomControl;

      const headingControl = new HeadingModeControl({}, setIsHeadingMode);
      map.addControl(headingControl);
      headingControlInstanceRef.current = headingControl;
      setHeadingControlRef.current = headingControl;
    }

    if (!hideUi) {
      const attributionControl = L.control.attribution({
        prefix:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      });
      map.addControl(attributionControl);
      attributionControlInstanceRef.current = attributionControl;
    }

    if (hideUi) {
      return;
    }

    if (isMobile) {
      return;
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
  }, [
    hideUi,
    isMobile,
    canUseRadarMode,
    setIsHeadingMode,
    setHeadingControlRef,
    setIsRadarMode,
    setRadarControlRef,
    setIsOSMMode,
    setOSMControlRef,
    setIsOpenAIPEnabled,
    setOpenAIPControlRef,
    setIsSettingsOpen,
    setSettingsControlRef,
  ]);

  return {
    mapInstance,
    flightPlanLayerGroup,
    importedFlightPlanLayerGroup,
    aircraftMarkersLayer,
    airportMarkersLayer,
    historyLayerGroup,
    replayLayerGroup,
    osmLayer,
    satelliteHybridLayer,
    radarBaseLayer,
    openAIPLayer,
    weatherOverlayLayer,
    mapReady,
    resetMapView,
  };
};
