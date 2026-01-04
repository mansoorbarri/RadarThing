"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { type PositionUpdate } from "~/lib/aircraft-store";
import { isPro } from "~/app/actions/is-pro";

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
  WeatherOverlayControl,
  RadarSettingsControl,
} from "~/components/map/MapControls";

import { MapGlobalStyles } from "~/styles/MapGlobalStyles";
import { useMetarOverlay } from "~/hooks/useMetarOverlay";
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
  onAircraftSelect: (aircraft: PositionUpdate | null) => void;
  selectedAirport?: Airport;
  setDrawFlightPlanOnMap: (
    func: (aircraft: PositionUpdate, shouldZoom?: boolean) => void,
  ) => void;
  onMapReady?: () => void;
  historyPath?: [number, number][] | null;
}

const MapComponent: React.FC<MapComponentProps> = ({
  aircrafts,
  airports,
  onAircraftSelect,
  selectedAirport,
  setDrawFlightPlanOnMap,
  onMapReady,
  historyPath,
}) => {
  const [isProUser, setIsProUser] = useState(false);
  const [proLoading, setProLoading] = useState(true);

  const canUseRadarMode = isProUser;
  const canUseAdvancedWeather = isProUser;

  const [isHeadingMode, setIsHeadingMode] = useState(false);
  const [isRadarMode, setIsRadarMode] = useState(false);
  const [isOSMMode, setIsOSMMode] = useState(false);
  const [isOpenAIPEnabled, setIsOpenAIPEnabled] = useState(false);

  const [showPrecipitation, setShowPrecipitation] = useState(false);
  const [showAirmets, setShowAirmets] = useState(false);
  const [showSigmets, setShowSigmets] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(
    null,
  );

  const [icaoInput, setIcaoInput] = useState("");
  const [showMetar, setShowMetar] = useState(true);

  const headingControlRef = useRef<HeadingModeControl | null>(null);
  const radarControlRef = useRef<RadarModeControl | null>(null);
  const osmControlRef = useRef<OSMControl | null>(null);
  const openAIPControlRef = useRef<OpenAIPControl | null>(null);
  const weatherControlRef = useRef<WeatherOverlayControl | null>(null);
  const settingsControlRef = useRef<RadarSettingsControl | null>(null);

  const onAircraftSelectRef = useRef(onAircraftSelect);
  useEffect(() => {
    onAircraftSelectRef.current = onAircraftSelect;
  }, [onAircraftSelect]);

  useEffect(() => {
    isPro()
      .then(setIsProUser)
      .finally(() => setProLoading(false));
  }, []);

  const toggleRadarMode = useCallback(() => {
    if (!canUseRadarMode) return;
    setIsRadarMode((prev) => !prev);
  }, [canUseRadarMode]);

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

  const handleMapClick = useCallback((e: L.LeafletMouseEvent) => {
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

    currentSelectedAircraftRef.current = null;
    setSelectedAircraftId(null);

    onAircraftSelectRef.current(null);
    setIsSettingsOpen(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleMapClick({
          originalEvent: {
            target: document.createElement("div"),
          },
        } as unknown as L.LeafletMouseEvent);
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
    setIsOSMMode,
    setIsOpenAIPEnabled,
    setIsWeatherOverlayEnabled: setShowPrecipitation,
    setIsSettingsOpen,
    canUseRadarMode,
    onMapClick: handleMapClick,
    setHeadingControlRef: headingControlRef,
    setRadarControlRef: radarControlRef,
    setOSMControlRef: osmControlRef,
    setOpenAIPControlRef: openAIPControlRef,
    setWeatherControlRef: weatherControlRef,
    setSettingsControlRef: settingsControlRef,
  });

  const { drawFlightPlan, currentSelectedAircraftRef } = useFlightPlanDrawing({
    mapInstance: mapRefs.mapInstance,
    flightPlanLayerGroup: mapRefs.flightPlanLayerGroup,
    historyLayerGroup: mapRefs.historyLayerGroup,
    isRadarMode,
    onAircraftSelect: onAircraftSelectRef.current,
    setSelectedAircraftId,
  });

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
    selectedAircraftId,
    currentSelectedAircraftRef,
    drawFlightPlan,
    onAircraftSelect: onAircraftSelectRef.current,
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
    if (weatherControlRef.current)
      weatherControlRef.current.updateState(showPrecipitation);
    if (settingsControlRef.current)
      settingsControlRef.current.updateState(isSettingsOpen);
  }, [
    isHeadingMode,
    isRadarMode,
    isOSMMode,
    isOpenAIPEnabled,
    showPrecipitation,
    isSettingsOpen,
    canUseRadarMode,
  ]);

  useEffect(() => {
    setDrawFlightPlanOnMap(drawFlightPlan);
  }, [drawFlightPlan, setDrawFlightPlanOnMap]);

  useEffect(() => {
    if (mapRefs.mapInstance.current && onMapReady) {
      onMapReady();
    }
  }, [mapRefs.mapInstance, onMapReady]);

  const metar = useMetarOverlay(
    mapRefs.mapInstance,
    icaoInput || selectedAirport?.icao,
  );

  return (
    <>
      <MapGlobalStyles />
      <div id="map-container" style={{ height: "100%", width: "100%" }} />

      {isSettingsOpen && (
        <div className="animate-in fade-in zoom-in-95 absolute top-[180px] left-[70px] z-[10020] w-[320px] duration-200">
          <div className="rounded-xl border border-white/10 bg-[#0a1219]/95 p-5 shadow-2xl backdrop-blur-xl">
            <RadarSettings
              isPRO={isProUser}
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

      <MetarPanel
        icaoInput={icaoInput}
        onChange={setIcaoInput}
        metarText={showMetar && metar?.raw ? metar.raw : null}
        onCloseMetar={() => setShowMetar(false)}
      />
    </>
  );
};

export default MapComponent;