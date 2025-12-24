import React, { useEffect, useState, useCallback, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { type PositionUpdate } from "~/lib/aircraft-store";
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
  DayNightControl,
  HazardsOverlayControl,
} from "~/components/map/MapControls";
import { MapGlobalStyles } from "~/styles/MapGlobalStyles";
import { useMetarOverlay } from "~/hooks/useMetarOverlay";
import { useWeatherOverlayLayer } from "~/hooks/useWeatherOverlayLayer";
import { MetarPanel } from "./MetarPanel";
import { useDayNightOverlay } from "./useDayNightOverlay";

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
  selectedWaypointIndex?: number | null;
  selectedAirport?: Airport | undefined;
  setDrawFlightPlanOnMap: (
    func: (aircraft: PositionUpdate, shouldZoom?: boolean) => void,
  ) => void;
  onMapReady?: () => void;
}

const MapComponent: React.FC<MapComponentProps> = ({
  aircrafts,
  airports,
  onAircraftSelect,
  selectedAirport,
  setDrawFlightPlanOnMap,
  onMapReady,
}) => {
  const [isHeadingMode, setIsHeadingMode] = useState(false);
  const [isRadarMode, setIsRadarMode] = useState(false);
  const [isOSMMode, setIsOSMMode] = useState(false);
  const [isOpenAIPEnabled, setIsOpenAIPEnabled] = useState(false);
  const [isWeatherOverlayEnabled, setIsWeatherOverlayEnabled] = useState(false);
  const [isDayNightOverlayEnabled, setIsDayNightOverlayEnabled] = useState(false);
  const [isHazardsOverlayEnabled, setIsHazardsOverlayEnabled] = useState(false);
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
  const dayNightControlRef = useRef<DayNightControl | null>(null);
  const hazardsControlRef = useRef<HazardsOverlayControl | null>(null);

  const onAircraftSelectRef = useRef(onAircraftSelect);
  useEffect(() => {
    onAircraftSelectRef.current = onAircraftSelect;
  }, [onAircraftSelect]);

  const mapRefs = useMapInitialization({
    mapContainerId: "map-container",
    setIsHeadingMode,
    setIsRadarMode,
    setIsOSMMode,
    setIsOpenAIPEnabled,
    setIsWeatherOverlayEnabled,
    setIsDayNightOverlayEnabled,
    setIsHazardsOverlayEnabled,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onMapClick: useCallback((e: L.LeafletMouseEvent) => {}, []),
    setHeadingControlRef: headingControlRef,
    setRadarControlRef: radarControlRef,
    setOSMControlRef: osmControlRef,
    setOpenAIPControlRef: openAIPControlRef,
    setWeatherControlRef: weatherControlRef,
    setDayNightControlRef: dayNightControlRef,
    setHazardsControlRef: hazardsControlRef,
  });

  const { drawFlightPlan, currentSelectedAircraftRef } = useFlightPlanDrawing({
    mapInstance: mapRefs.mapInstance,
    flightPlanLayerGroup: mapRefs.flightPlanLayerGroup,
    historyLayerGroup: mapRefs.historyLayerGroup,
    isRadarMode,
    onAircraftSelect: onAircraftSelectRef.current,
    setSelectedAircraftId,
  });

  const stableOnMapClick = useCallback(
    (e: L.LeafletMouseEvent) => {
      const target = e.originalEvent.target as HTMLElement;
      if (
        !target.closest(".leaflet-marker-icon") &&
        !target.closest(".leaflet-popup-pane") &&
        !target.closest(".leaflet-control") &&
        mapRefs.flightPlanLayerGroup.current &&
        mapRefs.historyLayerGroup.current
      ) {
        mapRefs.flightPlanLayerGroup.current.clearLayers();
        mapRefs.historyLayerGroup.current.clearLayers();
        currentSelectedAircraftRef.current = null;
        setSelectedAircraftId(null);
        onAircraftSelectRef.current(null);
      }
    },
    [setSelectedAircraftId, currentSelectedAircraftRef],
  );

  useEffect(() => {
    if (mapRefs.mapInstance.current) {
      mapRefs.mapInstance.current.off("click");
      mapRefs.mapInstance.current.on("click", stableOnMapClick);
    }
    return () => {
      if (mapRefs.mapInstance.current) {
        mapRefs.mapInstance.current.off("click", stableOnMapClick);
      }
    };
  }, [mapRefs.mapInstance, stableOnMapClick]);

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
    isRadarMode,
  });

  useWeatherOverlayLayer({
    mapInstance: mapRefs.mapInstance,
    isWeatherOverlayEnabled,
    isHazardsEnabled: isHazardsOverlayEnabled,
  });

  useDayNightOverlay(mapRefs.mapInstance, isDayNightOverlayEnabled);

  useEffect(() => {
    if (headingControlRef.current)
      headingControlRef.current.updateState(isHeadingMode);
    if (radarControlRef.current)
      radarControlRef.current.updateState(isRadarMode);
    if (osmControlRef.current)
      osmControlRef.current.updateState(isOSMMode);
    if (openAIPControlRef.current)
      openAIPControlRef.current.updateState(isOpenAIPEnabled);
    if (weatherControlRef.current)
      weatherControlRef.current.updateState(isWeatherOverlayEnabled);
    if (dayNightControlRef.current)
      dayNightControlRef.current.updateState(isDayNightOverlayEnabled);
    if (hazardsControlRef.current)
      hazardsControlRef.current.updateState(isHazardsOverlayEnabled);
  }, [isHeadingMode, isRadarMode, isOSMMode, isOpenAIPEnabled, isWeatherOverlayEnabled]);
    , isDayNightOverlayEnabled, isHazardsOverlayEnabled]);

  useEffect(() => {
    setDrawFlightPlanOnMap(drawFlightPlan);
  }, [drawFlightPlan, setDrawFlightPlanOnMap]);

  // Notify parent that map is ready
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