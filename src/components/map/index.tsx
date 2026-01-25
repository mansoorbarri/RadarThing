"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { type PositionUpdate } from "~/lib/aircraft-store";
import { useMobileDetection } from "~/hooks/useMobileDetection";
import { useProStatus } from "~/hooks/useProStatus";

import { useMapInitialization } from "./useMapInitialization";
import { useFlightPlanDrawing } from "./useFlightPlanDrawing";
import { useMapLayersAndMarkers } from "./useMapLayersAndMarkers";
import { useSelectedAirportHandling } from "./useSelectedAirportHandling";
import { useHeadingModeInteraction } from "./useHeadingModeInteraction";

import {
  HeadingModeControl,
  RadarModeControl,
  OSMControl,
  OpenAIPControl,
  RadarSettingsControl,
} from "~/components/map/MapControls";

import { MapGlobalStyles } from "~/styles/MapGlobalStyles";
import { useMetarOverlay } from "~/hooks/useMetarOverlay";
import { useAtisOverlay } from "~/hooks/useAtisOverlay";
import { useWeatherOverlayLayer } from "~/hooks/useWeatherOverlayLayer";
import { MetarPanel } from "./MetarPanel";
import { RadarSettings } from "~/components/atc/radarSettings";

export interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
  frequencies?: { type: string; frequency: string }[];
}

interface MapComponentProps {
  aircrafts: PositionUpdate[];
  airports: Airport[];
  onAircraftSelect: (aircraft: PositionUpdate | null, ctrlKey?: boolean) => void;
  selectedAircraftIds?: string[];
  selectedAirport?: Airport;
  setDrawFlightPlanOnMap: (
    func: (aircraft: PositionUpdate, shouldZoom?: boolean) => void,
  ) => void;
  setDrawMultipleFlightPlansOnMap?: (
    func: (aircrafts: PositionUpdate[], shouldZoom?: boolean) => void,
  ) => void;
  onMapReady?: () => void;
  historyPath?: [number, number][] | null;
}

const MapComponent: React.FC<MapComponentProps> = ({
  aircrafts,
  airports,
  onAircraftSelect,
  selectedAircraftIds = [],
  selectedAirport,
  setDrawFlightPlanOnMap,
  setDrawMultipleFlightPlansOnMap,
  onMapReady,
  historyPath,
}) => {
  const isMobile = useMobileDetection();
  const { isProUser, isAdminUser, isLoading: proLoading } = useProStatus();

  const canUseRadarMode = isProUser;
  const canUseAdvancedWeather = isProUser;

  const [isHeadingMode, setIsHeadingMode] = useState(false);
  const [isRadarMode, setIsRadarMode] = useState(false);
  const [isOSMMode, setIsOSMMode] = useState(false);
  const [isOpenAIPEnabled, setIsOpenAIPEnabled] = useState(false);

  const [showPrecipitation, setShowPrecipitation] = useState(false);
  const [showAirmets, setShowAirmets] = useState(false);
  const [showSigmets, setShowSigmets] = useState(false);
  const [showTags, setShowTags] = useState(true);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Local selection state for internal use (cleared when clicking map background)
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>([]);

  const [icaoInput, setIcaoInput] = useState("");
  const [showMetar, setShowMetar] = useState(true);
  const [showAtis, setShowAtis] = useState(true);

  const headingControlRef = useRef<HeadingModeControl | null>(null);
  const radarControlRef = useRef<RadarModeControl | null>(null);
  const osmControlRef = useRef<OSMControl | null>(null);
  const openAIPControlRef = useRef<OpenAIPControl | null>(null);
  const settingsControlRef = useRef<RadarSettingsControl | null>(null);

  const onAircraftSelectRef = useRef(onAircraftSelect);
  useEffect(() => {
    onAircraftSelectRef.current = onAircraftSelect;
  }, [onAircraftSelect]);

  const clearHistoryPolylineRef = useRef<(() => void) | null>(null);


  const toggleRadarMode = useCallback(() => {
    if (!canUseRadarMode) return;
    setIsRadarMode((prev) => {
      if (!prev) {
        // Enabling radar mode - disable OSM (base layers are mutually exclusive)
        setIsOSMMode(false);
      }
      return !prev;
    });
  }, [canUseRadarMode]);

  const toggleOSMMode = useCallback(() => {
    setIsOSMMode((prev) => {
      if (!prev) {
        // Enabling OSM mode - disable radar (base layers are mutually exclusive)
        setIsRadarMode(false);
      }
      return !prev;
    });
  }, []);

  const toggleOpenAIPMode = useCallback(() => {
    // OpenAIP is an overlay that can be shown on top of any base layer
    setIsOpenAIPEnabled((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!canUseRadarMode && isRadarMode) {
      setIsRadarMode(false);
    }
  }, [canUseRadarMode, isRadarMode]);

  useEffect(() => {
    if (!canUseAdvancedWeather) {
      setShowAirmets(false);
      setShowSigmets(false);
    }
  }, [canUseAdvancedWeather]);

  const handleMapClick = useCallback(
    (e: L.LeafletMouseEvent) => {
      const target = e.originalEvent.target as HTMLElement;

      if (
        target.closest(".leaflet-marker-icon") ||
        target.closest(".leaflet-control") ||
        target.closest(".leaflet-popup-pane")
      ) {
        return;
      }

      mapRefs.flightPlanLayerGroup.current?.clearLayers();
      mapRefs.historyLayerGroup.current?.clearLayers();
      clearHistoryPolylineRef.current?.();

      currentSelectedAircraftRef.current = null;
      setLocalSelectedIds([]);

      onAircraftSelectRef.current(null);
      setIsSettingsOpen(false);
    },
    // These refs are stable and don't need to trigger re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleMapClick({
          originalEvent: {
            target: document.createElement("div"),
          },
        } as unknown as L.LeafletMouseEvent);
      }
      if (e.key === "u" || e.key === "U") {
        const activeElement = document.activeElement;
        const isInputFocused = activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement?.getAttribute("contenteditable") === "true";
        if (!isInputFocused) {
          setShowTags((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleMapClick]);

  const mapRefs = useMapInitialization({
    mapContainerId: "map-container",
    setIsHeadingMode,
    setIsRadarMode: toggleRadarMode,
    setIsOSMMode: toggleOSMMode,
    setIsOpenAIPEnabled: toggleOpenAIPMode,
    setIsSettingsOpen,
    canUseRadarMode,
    onMapClick: handleMapClick,
    setHeadingControlRef: headingControlRef,
    setRadarControlRef: radarControlRef,
    setOSMControlRef: osmControlRef,
    setOpenAIPControlRef: openAIPControlRef,
    setSettingsControlRef: settingsControlRef,
    isMobile,
  });

  const { drawFlightPlan, drawMultipleFlightPlans, currentSelectedAircraftRef, clearHistoryPolyline } = useFlightPlanDrawing({
    mapInstance: mapRefs.mapInstance,
    flightPlanLayerGroup: mapRefs.flightPlanLayerGroup,
    historyLayerGroup: mapRefs.historyLayerGroup,
    isRadarMode,
  });

  // Update the ref so handleMapClick can clear the polyline
  clearHistoryPolylineRef.current = clearHistoryPolyline;

  useMapLayersAndMarkers({
    mapInstance: mapRefs.mapInstance,
    aircraftMarkersLayer: mapRefs.aircraftMarkersLayer,
    airportMarkersLayer: mapRefs.airportMarkersLayer,
    osmLayer: mapRefs.osmLayer,
    satelliteHybridLayer: mapRefs.satelliteHybridLayer,
    radarBaseLayer: mapRefs.radarBaseLayer,
    openAIPLayer: mapRefs.openAIPLayer,
    aircrafts,
    airports,
    isOSMMode,
    isRadarMode,
    isOpenAIPEnabled,
    selectedAircraftIds,
    currentSelectedAircraftRef,
    drawFlightPlan,
    onAircraftSelect,
    showTags,
    mapReady: mapRefs.mapReady,
  });

  useSelectedAirportHandling({
    mapInstance: mapRefs.mapInstance,
    selectedAirport,
    isRadarMode,
  });

  useHeadingModeInteraction({
    mapInstance: mapRefs.mapInstance,
    isHeadingMode,
    setIsHeadingMode,
    isRadarMode,
  });

  useWeatherOverlayLayer({
    mapInstance: mapRefs.mapInstance,
    showPrecipitation,
    showAirmets: canUseAdvancedWeather && showAirmets,
    showSigmets: canUseAdvancedWeather && showSigmets,
  });

  useEffect(() => {
    if (headingControlRef.current)
      headingControlRef.current.updateState(isHeadingMode);
    if (radarControlRef.current)
      radarControlRef.current.updateState(canUseRadarMode && isRadarMode);
    if (osmControlRef.current) osmControlRef.current.updateState(isOSMMode);
    if (openAIPControlRef.current)
      openAIPControlRef.current.updateState(isOpenAIPEnabled);
    if (settingsControlRef.current)
      settingsControlRef.current.updateState(isSettingsOpen);
  }, [
    isHeadingMode,
    isRadarMode,
    isOSMMode,
    isOpenAIPEnabled,
    isSettingsOpen,
    canUseRadarMode,
  ]);

  useEffect(() => {
    setDrawFlightPlanOnMap(drawFlightPlan);
  }, [drawFlightPlan, setDrawFlightPlanOnMap]);

  useEffect(() => {
    if (setDrawMultipleFlightPlansOnMap) {
      setDrawMultipleFlightPlansOnMap(drawMultipleFlightPlans);
    }
  }, [drawMultipleFlightPlans, setDrawMultipleFlightPlansOnMap]);

  useEffect(() => {
    if (mapRefs.mapInstance.current && onMapReady) {
      onMapReady();
    }
  }, [mapRefs.mapInstance, onMapReady]);

  const metar = useMetarOverlay(
    mapRefs.mapInstance,
    icaoInput || selectedAirport?.icao,
  );

  const { atis } = useAtisOverlay(icaoInput || selectedAirport?.icao);

  // Render historic flight path from Flight Log
  useEffect(() => {
    if (!mapRefs.mapInstance.current || !mapRefs.historyLayerGroup.current) {
      return;
    }

    // Only render when we have a valid historic path to show
    if (!historyPath || historyPath.length < 2) {
      return;
    }

    // Clear existing layers before drawing the historic path
    mapRefs.historyLayerGroup.current.clearLayers();

    // Draw the historic path
    const historyPolyline = L.polyline(historyPath, {
      color: isRadarMode ? "#00ff00" : "#00ff00",
      weight: isRadarMode ? 2 : 4,
      opacity: isRadarMode ? 0.7 : 0.8,
      smoothFactor: 1,
      dashArray: isRadarMode ? "5, 5" : "",
    });
    mapRefs.historyLayerGroup.current.addLayer(historyPolyline);

    // Fit map bounds to show the entire path
    const bounds = L.latLngBounds(historyPath);
    mapRefs.mapInstance.current.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 10,
    });
  }, [historyPath, isRadarMode, mapRefs.mapInstance, mapRefs.historyLayerGroup]);

  return (
    <>
      <MapGlobalStyles />
      <div id="map-container" style={{ height: "100%", width: "100%" }} />

      {isSettingsOpen && (
        <div className="animate-in fade-in zoom-in-95 absolute top-[180px] left-[70px] z-[10020] w-[320px] duration-200">
          <div className="rounded-xl border border-white/10 bg-[#0a1219]/95 p-5 shadow-2xl backdrop-blur-xl">
            <RadarSettings
              isPRO={isProUser}
              isADMIN={isAdminUser}
              showPrecipitation={showPrecipitation}
              setShowPrecipitation={setShowPrecipitation}
              showAirmets={showAirmets}
              setShowAirmets={setShowAirmets}
              showSigmets={showSigmets}
              setShowSigmets={setShowSigmets}
            />
          </div>
        </div>
      )}

      {/* Hide METAR panel on mobile */}
      {!isMobile && (
        <MetarPanel
          icaoInput={icaoInput}
          onChange={setIcaoInput}
          metarText={showMetar && metar?.raw ? metar.raw : null}
          onCloseMetar={() => setShowMetar(false)}
          atisText={showAtis && atis?.datis ? atis.datis : null}
          atisCode={showAtis && atis?.code ? atis.code : null}
          onCloseAtis={() => setShowAtis(false)}
        />
      )}
    </>
  );
};

export default MapComponent;
