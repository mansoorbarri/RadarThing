"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { type PositionUpdate } from "~/lib/aircraft-store";
import { type OnlineAirport } from "~/hooks/useAircraftStream";
import { splitPathAtAntimeridian } from "~/lib/map-utils";
import { useMobileDetection } from "~/hooks/useMobileDetection";
import { useProStatus } from "~/hooks/useProStatus";
import { getBooleanCookie, setBooleanCookie } from "~/lib/cookies";

import { useMapInitialization } from "./useMapInitialization";
import { useFlightPlanDrawing } from "./useFlightPlanDrawing";
import { useMapLayersAndMarkers } from "./useMapLayersAndMarkers";
import { type ConflictAlertSummary } from "./useMapLayersAndMarkers";
import { useSelectedAirportHandling } from "./useSelectedAirportHandling";
import { useHeadingModeInteraction } from "./useHeadingModeInteraction";

import {
  HeadingModeControl,
  RadarModeControl,
  OSMControl,
  OpenAIPControl,
  RadarSettingsControl,
} from "~/components/map/MapControls";

import { getReplayAircraftIcon } from "~/components/map/MapIcons";

import { MapGlobalStyles } from "~/styles/MapGlobalStyles";
import { useMetarOverlay } from "~/hooks/useMetarOverlay";
import { useAtisOverlay } from "~/hooks/useAtisOverlay";
import { useTileCacheWorker } from "~/hooks/useTileCacheWorker";
import { useNotamOverlay } from "~/hooks/useNotamOverlay";
import { useWeatherOverlayLayer } from "~/hooks/useWeatherOverlayLayer";
import { MetarPanel } from "./MetarPanel";
import { RadarSettings } from "~/components/atc/radarSettings";
import { Analytics } from "~/lib/analytics";

export interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
  frequencies?: { type: string; frequency: string }[];
}

interface ReplayState {
  currentPosition: [number, number] | null;
  currentHeading: number;
  traversedPath: [number, number][];
  remainingPath: [number, number][];
  isPlaying: boolean;
}

interface MapComponentProps {
  aircrafts: PositionUpdate[];
  airports: Airport[];
  onlineAirports?: OnlineAirport[];
  onAircraftSelect: (aircraft: PositionUpdate | null, ctrlKey?: boolean) => void;
  onAirportSelect?: (airport: Airport) => void;
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
  onLayerModeChange?: (isDarkLayer: boolean) => void;
  replayState?: ReplayState | null;
  followAircraft?: PositionUpdate;
  setResetMapView?: (func: () => void) => void;
}

const MapComponent: React.FC<MapComponentProps> = ({
  aircrafts,
  airports,
  onlineAirports,
  onAircraftSelect,
  onAirportSelect,
  selectedAircraftIds = [],
  selectedAirport,
  setDrawFlightPlanOnMap,
  setDrawMultipleFlightPlansOnMap,
  onMapReady,
  historyPath,
  onLayerModeChange,
  replayState,
  followAircraft,
  setResetMapView,
}) => {
  const isMobile = useMobileDetection();
  const { isProUser, isAdminUser, isLoading: proLoading } = useProStatus();
  useTileCacheWorker();

  const canUseRadarMode = isProUser;
  const canUseAdvancedWeather = isProUser;
  const canUseConflictAlerts = isProUser;

  const [isHeadingMode, setIsHeadingMode] = useState(false);
  const [isRadarMode, setIsRadarMode] = useState(() =>
    getBooleanCookie("map_radar_mode", false)
  );
  const [isOSMMode, setIsOSMMode] = useState(() =>
    getBooleanCookie("map_osm_mode", false)
  );
  const [isOpenAIPEnabled, setIsOpenAIPEnabled] = useState(() =>
    getBooleanCookie("map_openaip", false)
  );

  const [showPrecipitation, setShowPrecipitation] = useState(() =>
    getBooleanCookie("weather_precipitation", false)
  );
  const [showAirmets, setShowAirmets] = useState(() =>
    getBooleanCookie("weather_airmets", false)
  );
  const [showSigmets, setShowSigmets] = useState(() =>
    getBooleanCookie("weather_sigmets", false)
  );
  const [showConflicts, setShowConflicts] = useState(() =>
    getBooleanCookie("traffic_conflicts", false)
  );
  const [showTags, setShowTags] = useState(true);
  const [conflictAlerts, setConflictAlerts] = useState<ConflictAlertSummary[]>([]);
  const lastConflictSnapshotRef = useRef<string>("");

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Local selection state for internal use (cleared when clicking map background)
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>([]);

  const [icaoInput, setIcaoInput] = useState("");

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
    // Only reset when loading is complete and user doesn't have access
    if (!proLoading && !canUseRadarMode && isRadarMode) {
      setIsRadarMode(false);
    }
  }, [proLoading, canUseRadarMode, isRadarMode]);

  useEffect(() => {
    // Only reset when loading is complete and user doesn't have access
    if (!proLoading && !canUseAdvancedWeather) {
      setShowAirmets(false);
      setShowSigmets(false);
    }
  }, [proLoading, canUseAdvancedWeather]);

  useEffect(() => {
    // Only reset when loading is complete and user doesn't have access
    if (!proLoading && !canUseConflictAlerts && showConflicts) {
      setShowConflicts(false);
    }
  }, [proLoading, canUseConflictAlerts, showConflicts]);

  // Persist map mode settings to cookies
  useEffect(() => {
    setBooleanCookie("map_radar_mode", isRadarMode);
  }, [isRadarMode]);

  useEffect(() => {
    setBooleanCookie("map_osm_mode", isOSMMode);
  }, [isOSMMode]);

  useEffect(() => {
    setBooleanCookie("map_openaip", isOpenAIPEnabled);
  }, [isOpenAIPEnabled]);

  // Persist weather layer settings to cookies
  useEffect(() => {
    setBooleanCookie("weather_precipitation", showPrecipitation);
  }, [showPrecipitation]);

  useEffect(() => {
    setBooleanCookie("weather_airmets", showAirmets);
  }, [showAirmets]);

  useEffect(() => {
    setBooleanCookie("weather_sigmets", showSigmets);
  }, [showSigmets]);

  useEffect(() => {
    setBooleanCookie("traffic_conflicts", showConflicts);
  }, [showConflicts]);

  useEffect(() => {
    if (!showConflicts) return;
    Analytics.conflictMonitorViewed();
  }, [showConflicts]);

  useEffect(() => {
    if (!showConflicts) {
      lastConflictSnapshotRef.current = "";
      return;
    }

    const high = conflictAlerts.filter((a) => a.severity === "high").length;
    const medium = conflictAlerts.filter((a) => a.severity === "medium").length;
    const low = conflictAlerts.filter((a) => a.severity === "low").length;
    const snapshot = `${conflictAlerts.length}:${high}:${medium}:${low}`;

    if (snapshot === lastConflictSnapshotRef.current) return;
    lastConflictSnapshotRef.current = snapshot;

    Analytics.conflictSnapshotUpdated({
      total: conflictAlerts.length,
      high,
      medium,
      low,
    });
  }, [conflictAlerts, showConflicts]);

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
    onlineAirports,
    isOSMMode,
    isRadarMode,
    isOpenAIPEnabled,
    selectedAircraftIds,
    selectedAirport,
    currentSelectedAircraftRef,
    drawFlightPlan,
    onAircraftSelect,
    onAirportSelect,
    showTags,
    showConflicts: canUseConflictAlerts && showConflicts,
    onConflictsChange: setConflictAlerts,
    mapReady: mapRefs.mapReady,
    isMobile,
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
    onLayerModeChange?.(isRadarMode || isOSMMode);
  }, [isRadarMode, isOSMMode, onLayerModeChange]);

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

  useEffect(() => {
    if (setResetMapView) {
      setResetMapView(mapRefs.resetMapView);
    }
  }, [mapRefs.resetMapView, setResetMapView]);

  const metar = useMetarOverlay(
    mapRefs.mapInstance,
    icaoInput || selectedAirport?.icao,
  );

  const { atis } = useAtisOverlay(icaoInput || selectedAirport?.icao);

  // Fetch NOTAMs when we have an ICAO (PRO users fetch from API, free users only see cache)
  const { notamData } = useNotamOverlay(icaoInput || selectedAirport?.icao, isProUser);

  // Track previous historyPath to detect flight changes
  const prevHistoryPathRef = useRef<[number, number][] | null>(null);

  // Zoom to flight path when it changes (works for both replay and static history)
  useEffect(() => {
    if (!mapRefs.mapInstance.current || !historyPath || historyPath.length < 2) {
      return;
    }

    // Only zoom if the path actually changed (new flight selected)
    if (prevHistoryPathRef.current !== historyPath) {
      prevHistoryPathRef.current = historyPath;
      const bounds = L.latLngBounds(historyPath);
      mapRefs.mapInstance.current.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 10,
      });
    }
  }, [historyPath, mapRefs.mapInstance]);

  // Render historic flight path from Flight Log (only when NOT in replay mode)
  useEffect(() => {
    if (!mapRefs.mapInstance.current || !mapRefs.historyLayerGroup.current) {
      return;
    }

    // If replay is active, don't render static history path
    if (replayState) {
      mapRefs.historyLayerGroup.current.clearLayers();
      return;
    }

    // Only render when we have a valid historic path to show
    if (!historyPath || historyPath.length < 2) {
      return;
    }

    // Clear existing layers before drawing the historic path
    mapRefs.historyLayerGroup.current.clearLayers();

    // Draw the historic path (split at antimeridian for trans-Pacific flights)
    for (const segment of splitPathAtAntimeridian(historyPath)) {
      if (segment.length >= 2) {
        const historyPolyline = L.polyline(segment, {
          color: isRadarMode ? "#00ff00" : "#00ff00",
          weight: isRadarMode ? 2 : 4,
          opacity: isRadarMode ? 0.7 : 0.8,
          smoothFactor: 1,
          dashArray: isRadarMode ? "5, 5" : "",
        });
        mapRefs.historyLayerGroup.current.addLayer(historyPolyline);
      }
    }
  }, [historyPath, isRadarMode, replayState, mapRefs.mapInstance, mapRefs.historyLayerGroup]);

  // Follow mode - center map on followed aircraft
  useEffect(() => {
    if (!mapRefs.mapInstance.current || !followAircraft) return;

    const lat = Number(followAircraft.lat);
    const lon = Number(followAircraft.lon);

    if (isNaN(lat) || isNaN(lon)) return;

    mapRefs.mapInstance.current.setView([lat, lon], undefined, {
      animate: true,
      duration: 0.3,
    });
  }, [followAircraft?.lat, followAircraft?.lon, followAircraft, mapRefs.mapInstance]);

  // Render flight replay animation
  useEffect(() => {
    if (!mapRefs.mapInstance.current || !mapRefs.replayLayerGroup.current) {
      return;
    }

    // Clear replay layer if no replay state
    if (!replayState?.currentPosition) {
      mapRefs.replayLayerGroup.current.clearLayers();
      return;
    }

    const { currentPosition, currentHeading, traversedPath, remainingPath } = replayState;

    // Clear previous layers
    mapRefs.replayLayerGroup.current.clearLayers();

    // Draw traversed path (solid amber line)
    if (traversedPath.length >= 2) {
      for (const segment of splitPathAtAntimeridian(traversedPath)) {
        if (segment.length >= 2) {
          const traversedPolyline = L.polyline(segment, {
            color: "#f59e0b", // amber-500
            weight: isRadarMode ? 2 : 4,
            opacity: isRadarMode ? 0.8 : 0.9,
            smoothFactor: 1,
          });
          mapRefs.replayLayerGroup.current.addLayer(traversedPolyline);
        }
      }
    }

    // Draw remaining path (dashed, faded)
    if (remainingPath.length >= 2) {
      for (const segment of splitPathAtAntimeridian(remainingPath)) {
        if (segment.length >= 2) {
          const remainingPolyline = L.polyline(segment, {
            color: "#f59e0b", // amber-500
            weight: isRadarMode ? 1 : 2,
            opacity: isRadarMode ? 0.3 : 0.4,
            smoothFactor: 1,
            dashArray: "8, 8",
          });
          mapRefs.replayLayerGroup.current.addLayer(remainingPolyline);
        }
      }
    }

    // Draw replay aircraft marker at current position
    const replayMarker = L.marker(currentPosition, {
      icon: getReplayAircraftIcon(currentHeading),
      zIndexOffset: 1000,
    });
    mapRefs.replayLayerGroup.current.addLayer(replayMarker);

  }, [replayState, isRadarMode, mapRefs.mapInstance, mapRefs.replayLayerGroup]);

  return (
    <>
      <MapGlobalStyles />
      <div id="map-container" style={{ height: "100%", width: "100%", background: "#0a0a0a" }} />

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
              showConflicts={showConflicts}
              setShowConflicts={setShowConflicts}
            />
          </div>
        </div>
      )}

      {canUseConflictAlerts && showConflicts && !isMobile && (
        <div className="pointer-events-none absolute top-[180px] right-[22px] z-[10012] w-[300px] select-none">
          <div className="rounded-xl border border-cyan-400/30 bg-gradient-to-b from-[#03131c]/95 to-[#01090f]/95 p-4 shadow-[0_0_30px_rgba(34,211,238,0.12)] backdrop-blur-xl">
            <div
              className="pointer-events-none absolute inset-0 rounded-xl opacity-20"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(180deg, transparent, transparent 5px, rgba(34,211,238,0.08) 6px)",
              }}
            />
            <div className="relative">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.2em] text-cyan-400/80 uppercase">
                    Conflict Monitor
                  </p>
                  <p className="font-mono text-xs text-white/60">
                    Live CPA prediction
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-80" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
                  </span>
                  <span className="font-mono text-[10px] font-bold text-cyan-300">
                    {conflictAlerts.length} ACTIVE
                  </span>
                </div>
              </div>

              <div className="mb-3 grid grid-cols-3 gap-2">
                <SeverityStat
                  label="HIGH"
                  tone="text-red-300 border-red-400/30 bg-red-500/10"
                  count={conflictAlerts.filter((a) => a.severity === "high").length}
                />
                <SeverityStat
                  label="MED"
                  tone="text-amber-300 border-amber-400/30 bg-amber-500/10"
                  count={conflictAlerts.filter((a) => a.severity === "medium").length}
                />
                <SeverityStat
                  label="LOW"
                  tone="text-yellow-200 border-yellow-300/30 bg-yellow-500/10"
                  count={conflictAlerts.filter((a) => a.severity === "low").length}
                />
              </div>

              <div className="space-y-1.5">
                {conflictAlerts.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 font-mono text-[11px] text-white/50">
                    No predicted conflicts in current traffic.
                  </div>
                ) : (
                  conflictAlerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[11px]">
                      <div className="flex items-center justify-between text-white/85">
                        <span>{alert.callsignA}</span>
                        <span className="text-white/35">×</span>
                        <span>{alert.callsignB}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-white/50">
                        <span>{alert.horizontalSeparationNm.toFixed(1)}nm / {Math.round(alert.verticalSeparationFt)}ft</span>
                        <span>T-{alert.timeToCpaMinutes.toFixed(1)}m</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hide METAR panel on mobile */}
      {!isMobile && (
        <MetarPanel
          icaoInput={icaoInput}
          onChange={setIcaoInput}
          selectedAirportIcao={selectedAirport?.icao}
          metarText={metar?.raw || null}
          atisText={atis?.datis || null}
          atisCode={atis?.code || null}
          notams={notamData?.notams || null}
          notamCount={notamData?.count || 0}
          isPro={isProUser}
        />
      )}
    </>
  );
};

export default MapComponent;

function SeverityStat({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: string;
}) {
  return (
    <div className={`rounded-lg border px-2 py-1.5 text-center font-mono ${tone}`}>
      <p className="text-[9px] tracking-[0.18em] uppercase">{label}</p>
      <p className="text-sm font-bold">{count}</p>
    </div>
  );
}
