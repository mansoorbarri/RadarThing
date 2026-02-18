"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { type Id } from "../../../convex/_generated/dataModel";

import { type PositionUpdate } from "~/lib/aircraft-store";
import { useMobileDetection } from "~/hooks/useMobileDetection";
import { useAircraftStream } from "~/hooks/useAircraftStream";
import { useAirportData } from "~/hooks/useAirportData";
import { useAircraftSearch } from "~/hooks/useAircraftSearch";
import { useUtcTime } from "~/hooks/useUtcTime";
import { useTimer } from "~/hooks/useTimer";
// useAirportCharts hook moved into AirportChartsViewer component
import { useProStatus } from "~/hooks/useProStatus";
import { useRecentSearches } from "~/hooks/useRecentSearches";

import { ConnectionStatusIndicator } from "~/components/atc/connectionStatusIndicator";
import { SearchBar } from "~/components/atc/searchbar";
import { Sidebar, type HistoryFlight } from "~/components/atc/sidebar";
import { MultiAircraftSidebar } from "~/components/atc/MultiAircraftSidebar";
import { FlightReplayControls } from "~/components/flight-replay/FlightReplayControls";
import { CallsignFilter } from "~/components/atc/callsignFilter";
import { UserAuth } from "~/components/atc/userAuth";
import { ControlDock } from "~/components/atc/controlDock";
import { FIDSPanel } from "~/components/atc/FIDSPanel";
import { TaxiChartViewer } from "~/components/airports/TaxiChartsViewer";
import { AirportFIDPanel } from "~/components/airports/AirportFIDPanel";
import { ChartSidePanel } from "~/components/map/ChartOverlayPanel";
import { AtcPlayer } from "~/components/atc/AtcPlayer";
import { ProBadge } from "~/components/ui/pro-badge";
import { MobileSwipeSheet } from "~/components/ui/MobileSwipeSheet";
import { UpgradeIcon, FlightsIcon, FilterIcon, DiscordIcon, InstallIcon, LeaderboardIcon } from "~/utils/dockIcons";
import { RotateCcw } from "lucide-react";

const DynamicMapComponent = dynamic(() => import("~/components/map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

type RightPanel = "fids" | "filter" | null;

export default function ATCPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMobileDetection();

  const { aircrafts, isLoading, connectionStatus } = useAircraftStream();
  const { airports, fetchAirports } = useAirportData();

  const { isProUser, isLoading: proLoading } = useProStatus();

  const [selectedAircrafts, setSelectedAircrafts] = useState<PositionUpdate[]>(
    [],
  );
  const [selectedAirport, setSelectedAirport] = useState<any>(undefined);

  const [historyPath, setHistoryPath] = useState<[number, number][] | null>(
    null,
  );
  const [isViewingHistory, setIsViewingHistory] = useState(false);

  // Flight replay state
  const [replayFlight, setReplayFlight] = useState<HistoryFlight | null>(null);
  const [replayState, setReplayState] = useState<{
    currentPosition: [number, number] | null;
    currentHeading: number;
    traversedPath: [number, number][];
    remainingPath: [number, number][];
    isPlaying: boolean;
  } | null>(null);

  // Check if callsign param is a full flight number (e.g., EK213) vs just a prefix (e.g., EK)
  const callsignParam = searchParams.get("callsign");
  const isFullFlightNumberParam = callsignParam && /^[A-Z]+\d+.*$/i.test(callsignParam.trim());

  // Handle replay param from dashboard
  const replayParam = searchParams.get("replay");
  const replayFlightQuery = useQuery(
    api.flights.getById,
    replayParam ? { id: replayParam as Id<"flights"> } : "skip"
  );

  // State for full flight number filter (can be cleared with Escape)
  const [fullFlightFilter, setFullFlightFilter] = useState<string | null>(() => {
    if (isFullFlightNumberParam && callsignParam) {
      return callsignParam.trim().toUpperCase();
    }
    return null;
  });

  const [selectedCallsigns, setSelectedCallsigns] = useState<Set<string>>(() => {
    // If it's a full flight number, don't use prefix filtering
    if (isFullFlightNumberParam) return new Set();

    if (callsignParam) {
      const prefixes = callsignParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      return new Set(prefixes);
    }
    return new Set();
  });

  // Track if we've already auto-selected from URL param
  const [autoSelectedFromUrl, setAutoSelectedFromUrl] = useState(false);

  const [activeRightPanel, setActiveRightPanel] = useState<RightPanel>(null);

  const [showTaxiChart, setShowTaxiChart] = useState(false);
  const [showAtcPlayer, setShowAtcPlayer] = useState(false);
  const [showAirportFID, setShowAirportFID] = useState(false);
  const [chartOverlayActive, setChartOverlayActive] = useState(false);

  const [showTimerPopup, setShowTimerPopup] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isDarkLayerMode, setIsDarkLayerMode] = useState(false);
  const [isFollowMode, setIsFollowMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const { searchTerm, setSearchTerm, searchResults } = useAircraftSearch(
    aircrafts,
    airports,
    fetchAirports,
  );

  const {
    recentSearches,
    addAircraftSearch,
    addAirportSearch,
    clearRecentSearches,
  } = useRecentSearches();

  const time = useUtcTime();
  const { formattedTime, isRunning, start, stop, reset } = useTimer();

  const drawFlightPlanOnMapRef = useRef<
    ((ac: PositionUpdate, zoom?: boolean) => void) | null
  >(null);
  const drawMultipleFlightPlansOnMapRef = useRef<
    ((aircrafts: PositionUpdate[], zoom?: boolean) => void) | null
  >(null);
  const resetMapViewRef = useRef<(() => void) | null>(null);


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (fullFlightFilter) {
      params.set("callsign", fullFlightFilter);
    } else if (selectedCallsigns.size > 0) {
      params.set("callsign", Array.from(selectedCallsigns).join(","));
    } else {
      params.delete("callsign");
    }

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [selectedCallsigns, fullFlightFilter]);

  // Auto-start replay when flight data is loaded from URL param
  useEffect(() => {
    if (replayFlightQuery && !replayFlight) {
      setReplayFlight(replayFlightQuery);
      // Set history path to zoom the map to the flight route
      if (replayFlightQuery.routeData && replayFlightQuery.routeData.length > 0) {
        setHistoryPath(replayFlightQuery.routeData);
        setIsViewingHistory(true);
      }
      // Clear the replay param from URL after loading
      const params = new URLSearchParams(window.location.search);
      params.delete("replay");
      const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    }
  }, [replayFlightQuery, replayFlight]);

  const filteredAircrafts = useMemo(() => {
    // If we have a full flight number filter, only show that aircraft
    if (fullFlightFilter) {
      return aircrafts.filter(
        (ac) =>
          ac.callsign?.toUpperCase() === fullFlightFilter ||
          ac.flightNo?.toUpperCase() === fullFlightFilter
      );
    }

    if (selectedCallsigns.size === 0) return aircrafts;

    const prefixRegex = /^[A-Z]+/;

    return aircrafts.filter((aircraft) => {
      if (!aircraft.flightNo) return false;
      const match = prefixRegex.exec(aircraft.flightNo.trim().toUpperCase());
      return match && selectedCallsigns.has(match[0]);
    });
  }, [aircrafts, selectedCallsigns, fullFlightFilter]);

  // Memoize selected aircraft IDs to avoid recalculating on every render
  const selectedAircraftIds = useMemo(
    () => selectedAircrafts.map((ac) => ac.callsign || ac.id),
    [selectedAircrafts]
  );

  const handleToggleCallsign = useCallback((prefix: string) => {
    setSelectedCallsigns((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) {
        next.delete(prefix);
      } else {
        next.add(prefix);
      }
      return next;
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedCallsigns(new Set());
  }, []);

  const handleMapReady = useCallback(() => {
    setIsMapLoaded(true);
  }, []);

  // Keep selected aircrafts in sync with updated positions and redraw paths
  useEffect(() => {
    if (selectedAircrafts.length === 0 || isViewingHistory) return;

    // Update selected aircraft data with latest positions
    const updatedSelection = selectedAircrafts.map((selectedAc) => {
      const updated = aircrafts.find(
        (ac) =>
          (ac.id && ac.id === selectedAc.id) ||
          (ac.callsign && ac.callsign === selectedAc.callsign),
      );
      return updated || selectedAc;
    });

    // Check if any aircraft actually changed
    const hasChanges = updatedSelection.some(
      (ac, i) => ac !== selectedAircrafts[i],
    );

    if (hasChanges) {
      setSelectedAircrafts(updatedSelection);
    }

    // Redraw all flight paths
    if (drawMultipleFlightPlansOnMapRef.current) {
      drawMultipleFlightPlansOnMapRef.current(updatedSelection, false);
    }
  }, [aircrafts, isViewingHistory, selectedAircrafts]);

  // Auto-select aircraft from URL param if it's a full flight number
  const followParam = searchParams.get("follow") === "true";

  useEffect(() => {
    if (!fullFlightFilter || autoSelectedFromUrl || aircrafts.length === 0) return;

    const matchedAircraft = aircrafts.find(
      (ac) =>
        ac.callsign?.toUpperCase() === fullFlightFilter ||
        ac.flightNo?.toUpperCase() === fullFlightFilter
    );

    if (matchedAircraft) {
      setSelectedAircrafts([matchedAircraft]);
      drawFlightPlanOnMapRef.current?.(matchedAircraft, true);
      setAutoSelectedFromUrl(true);
      if (followParam) {
        setIsFollowMode(true);
      }
    }
  }, [aircrafts, fullFlightFilter, autoSelectedFromUrl, followParam]);

  // Escape key to clear filters, F key to toggle follow mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (fullFlightFilter || selectedCallsigns.size > 0)) {
        setFullFlightFilter(null);
        setSelectedCallsigns(new Set());
        setSelectedAircrafts([]);
        setAutoSelectedFromUrl(false);
      }

      // F key to toggle follow mode (only when aircraft is selected and not typing in input)
      if ((e.key === "f" || e.key === "F") && selectedAircrafts.length > 0) {
        const activeElement = document.activeElement;
        const isInputFocused =
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement?.getAttribute("contenteditable") === "true";
        if (!isInputFocused) {
          setIsFollowMode((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fullFlightFilter, selectedCallsigns, selectedAircrafts.length]);

  // Deactivate chart overlay and FID when airport changes
  useEffect(() => {
    setChartOverlayActive(false);
    setShowAirportFID(false);
  }, [selectedAirport?.icao]);

  function handleAircraftSelect(
    aircraft: PositionUpdate | null,
    ctrlKey = false,
  ) {
    setIsViewingHistory(false);
    setHistoryPath(null);

    if (aircraft === null) {
      // Clear selection
      setSelectedAircrafts([]);
      setIsFollowMode(false);
    } else if (ctrlKey) {
      // CTRL+click: toggle selection
      setSelectedAircrafts((prev) => {
        const aircraftId = aircraft.callsign || aircraft.id;
        const existingIndex = prev.findIndex(
          (ac) => (ac.callsign || ac.id) === aircraftId,
        );
        if (existingIndex >= 0) {
          // Remove from selection - draw remaining paths
          const newSelection = prev.filter((_, i) => i !== existingIndex);
          if (newSelection.length > 0) {
            drawMultipleFlightPlansOnMapRef.current?.(newSelection, false);
          }
          return newSelection;
        } else {
          // Add to selection - draw all paths
          const newSelection = [...prev, aircraft];
          drawMultipleFlightPlansOnMapRef.current?.(newSelection, false);
          return newSelection;
        }
      });
    } else {
      // Normal click: replace selection
      setSelectedAircrafts([aircraft]);
      drawMultipleFlightPlansOnMapRef.current?.([aircraft], true);
    }

    setActiveRightPanel(null);
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <header className={`absolute top-0 right-0 left-0 z-[10010] flex items-center justify-between ${isMobile ? 'h-14 px-3 pt-1' : 'h-20 px-6 pt-5'}`}>
        <div className="flex items-center gap-2">
          {!isMobile && (
            <Image
              src={(isDarkLayerMode || isLoading) ? "/logo-white.svg" : "/logo-black.svg"}
              alt="RadarThing"
              width={130}
              height={40}
              className="cursor-pointer"
              onClick={() => router.push("/")}
            />
          )}

          {isMapLoaded && !isMobile && (
            <div className="pointer-events-auto h-11 w-80 lg:w-96">
              <SearchBar
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                searchResults={searchResults}
                isMobile={isMobile}
                onSelectAircraft={(ac) => {
                  setSelectedAircrafts([ac]);
                  drawFlightPlanOnMapRef.current?.(ac, true);
                  addAircraftSearch(ac);
                  setSearchTerm("");
                }}
                onSelectAirport={(ap) => {
                  setSelectedAirport(ap);
                  addAirportSearch(ap);
                  setSearchTerm("");
                }}
                recentSearches={recentSearches}
                onSelectRecentSearch={(search) => {
                  if (search.type === "aircraft") {
                    const aircraft = aircrafts.find(
                      (ac) =>
                        ac.callsign === search.id ||
                        ac.flightNo === search.id ||
                        ac.id === search.id
                    );
                    if (aircraft) {
                      setSelectedAircrafts([aircraft]);
                      drawFlightPlanOnMapRef.current?.(aircraft, true);
                    }
                  } else {
                    const airport = airports.find((ap) => ap.icao === search.id);
                    if (airport) {
                      setSelectedAirport(airport);
                    }
                  }
                }}
                onClearRecentSearches={clearRecentSearches}
              />
            </div>
          )}

          {/* Mobile search button */}
          {isMapLoaded && isMobile && !showMobileSearch && (
            <button
              onClick={() => setShowMobileSearch(true)}
              className="pointer-events-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-black/60 backdrop-blur-md"
            >
              <svg className="h-4 w-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          )}
        </div>

        {/* UTC Time - simplified on mobile */}
        {!isMobile && (
          <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2">
            <button
              onClick={() => setShowTimerPopup(!showTimerPopup)}
              className="cursor-pointer rounded-full border border-white/10 bg-black/40 px-4 py-1.5 backdrop-blur-md"
            >
              <span className="font-mono text-xl text-cyan-400">
                {time} <span className="text-[10px] text-slate-500">UTC</span>
              </span>
              {showTimerPopup && (
                <span className="block font-mono text-sm text-emerald-400">
                  {formattedTime}
                </span>
              )}
              {isRunning && (
                <span className="block animate-pulse text-[9px] tracking-widest text-emerald-400 uppercase">
                  Timer Active
                </span>
              )}
            </button>

            {showTimerPopup && (
              <div className="absolute top-full left-1/2 mt-2 -translate-x-1/2">
                <div className="rounded-xl border border-white/10 bg-black/90 p-3 backdrop-blur-xl">
                  <div className="flex gap-2">
                    <button
                      onClick={start}
                      disabled={isRunning}
                      className="cursor-pointer rounded-lg bg-emerald-500/20 px-3 py-1 text-xs text-emerald-400 disabled:opacity-50"
                    >
                      Start
                    </button>
                    <button
                      onClick={stop}
                      disabled={!isRunning}
                      className="cursor-pointer rounded-lg bg-red-500/20 px-3 py-1 text-xs text-red-400 disabled:opacity-50"
                    >
                      Stop
                    </button>
                    <button
                      onClick={reset}
                      className="cursor-pointer rounded-lg bg-slate-500/20 px-3 py-1 text-xs text-slate-400"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className={`pointer-events-auto flex items-center ${isMobile ? 'gap-2' : 'gap-4'}`}>
          <ConnectionStatusIndicator
            status={connectionStatus}
            isMobile={isMobile}
          />
          <UserAuth />
        </div>
      </header>

      {/* Mobile search - bottom sheet */}
      {isMobile && showMobileSearch && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[10019] bg-black/50"
            onClick={() => {
              setShowMobileSearch(false);
              setSearchTerm("");
            }}
          />
          {/* Bottom sheet */}
          <div className="fixed inset-x-0 bottom-0 z-[10020] rounded-t-2xl border-t border-white/10 bg-[#0a1219] px-4 pb-8 pt-3 animate-in slide-in-from-bottom duration-200">
            {/* Drag handle */}
            <div className="mb-4 flex justify-center">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            {/* Search input */}
            <input
              type="text"
              placeholder="Search flight or airport..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-cyan-400/30 bg-black/60 px-4 py-3 text-[15px] text-cyan-400 placeholder-cyan-500/40 outline-none focus:border-cyan-400"
            />

            {/* Results */}
            {searchTerm && (searchResults.aircrafts.length > 0 || searchResults.airports.length > 0) && (
              <div className="mt-3 max-h-[50vh] overflow-y-auto rounded-xl border border-white/10 bg-black/40">
                {searchResults.aircrafts.length > 0 && (
                  <>
                    <div className="bg-cyan-950/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-400 border-b border-white/10">
                      Aircrafts
                    </div>
                    {searchResults.aircrafts.map((aircraft, index) => (
                      <div
                        key={aircraft.callsign || aircraft.flightNo || `ac-${index}`}
                        onClick={() => {
                          setSelectedAircrafts([aircraft]);
                          drawFlightPlanOnMapRef.current?.(aircraft, true);
                          addAircraftSearch(aircraft);
                          setSearchTerm("");
                          setShowMobileSearch(false);
                        }}
                        className="border-b border-white/5 px-4 py-3 active:bg-white/10 last:border-b-0"
                      >
                        <div className="font-medium text-white">
                          {aircraft.callsign || aircraft.flightNo || "N/A"}
                        </div>
                        <div className="mt-0.5 text-[12px] text-white/50">
                          {aircraft.type} • {aircraft.departure} → {aircraft.arrival || "UNK"}
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {searchResults.airports.length > 0 && (
                  <>
                    <div className="bg-cyan-950/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-400 border-b border-white/10">
                      Airports
                    </div>
                    {searchResults.airports.map((airport) => (
                      <div
                        key={`ap-${airport.icao}`}
                        onClick={() => {
                          setSelectedAirport(airport);
                          addAirportSearch(airport);
                          setSearchTerm("");
                          setShowMobileSearch(false);
                        }}
                        className="border-b border-white/5 px-4 py-3 active:bg-white/10 last:border-b-0"
                      >
                        <div className="font-medium text-white">{airport.icao}</div>
                        <div className="mt-0.5 text-[12px] text-white/50">{airport.name}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Recent searches - shown when no search term */}
            {!searchTerm && recentSearches.length > 0 && (
              <div className="mt-3 max-h-[50vh] overflow-y-auto rounded-xl border border-white/10 bg-black/40">
                <div className="flex items-center justify-between bg-cyan-950/30 px-4 py-2 border-b border-white/10">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
                    Recent Searches
                  </div>
                  <button
                    onClick={clearRecentSearches}
                    className="text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                {recentSearches.map((search, index) => (
                  <div
                    key={`${search.type}-${search.id}-${index}`}
                    onClick={() => {
                      if (search.type === "aircraft") {
                        const aircraft = aircrafts.find(
                          (ac) =>
                            ac.callsign === search.id ||
                            ac.flightNo === search.id ||
                            ac.id === search.id
                        );
                        if (aircraft) {
                          setSelectedAircrafts([aircraft]);
                          drawFlightPlanOnMapRef.current?.(aircraft, true);
                        }
                      } else {
                        const airport = airports.find((ap) => ap.icao === search.id);
                        if (airport) {
                          setSelectedAirport(airport);
                        }
                      }
                      setShowMobileSearch(false);
                    }}
                    className="border-b border-white/5 px-4 py-3 active:bg-white/10 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-[14px]">
                        {search.type === "aircraft" ? "✈" : "🛫"}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white">
                          {search.displayName}
                        </div>
                        {search.subtitle && (
                          <div className="mt-0.5 text-[12px] text-white/50">
                            {search.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {searchTerm && searchResults.aircrafts.length === 0 && searchResults.airports.length === 0 && (
              <div className="mt-6 text-center text-sm text-white/30">No results found</div>
            )}
          </div>
        </>
      )}

      <main className="absolute inset-0">
        {isLoading ? (
          <MapSkeleton />
        ) : (
          <DynamicMapComponent
            aircrafts={filteredAircrafts}
            airports={airports}
            selectedAirport={selectedAirport}
            selectedAircraftIds={selectedAircraftIds}
            onAircraftSelect={handleAircraftSelect}
            onAirportSelect={(airport) => {
              setSelectedAirport(airport);
              addAirportSearch(airport);
            }}
            setDrawFlightPlanOnMap={(fn) => {
              drawFlightPlanOnMapRef.current = fn;
            }}
            setDrawMultipleFlightPlansOnMap={(fn) => {
              drawMultipleFlightPlansOnMapRef.current = fn;
            }}
            onMapReady={handleMapReady}
            historyPath={historyPath}
            onLayerModeChange={setIsDarkLayerMode}
            replayState={replayState}
            followAircraft={isFollowMode ? selectedAircrafts[0] : undefined}
            setResetMapView={(fn) => {
              resetMapViewRef.current = fn;
            }}
          />
        )}
      </main>

      {/* Right panels - hidden on mobile */}
      {!isMobile && activeRightPanel === "fids" && (
        <aside className="fixed inset-y-0 right-0 z-[10012] w-[420px] border-l border-white/10 bg-black/80 backdrop-blur-xl">
          <FIDSPanel
            aircrafts={aircrafts}
            onTrack={(ac) => {
              setSelectedAircrafts([ac]);
              setActiveRightPanel(null);
              drawFlightPlanOnMapRef.current?.(ac, true);
            }}
          />
        </aside>
      )}

      {!isMobile && activeRightPanel === "filter" && (
        <aside className="fixed inset-y-0 right-0 z-[10013] w-[360px] border-l border-white/10 bg-black/80 backdrop-blur-xl">
          <CallsignFilter
            aircrafts={aircrafts}
            selectedCallsigns={selectedCallsigns}
            onToggleCallsign={handleToggleCallsign}
            onClearFilters={handleClearFilters}
          />
        </aside>
      )}

      {/* Control dock - hidden on mobile and when chart side panel is open */}
      {!isMobile && !(chartOverlayActive && selectedAirport?.icao) && (
        <ControlDock
          side="right"
          bottomAction={{
            icon: (
              <RotateCcw size={18} strokeWidth={1.8} />
            ),
            label: "Reset map view",
            onClick: () => resetMapViewRef.current?.(),
          }}
          items={[
            // Core features (closest to toggle button)
            {
              id: "fids",
              label: "Flights",
              icon: FlightsIcon,
              active: activeRightPanel === "fids",
              onClick: () => {
                const newState = activeRightPanel !== "fids";
                setActiveRightPanel(newState ? "fids" : null);
                if (newState) setSelectedAircrafts([]);
              },
            },
            {
              id: "filter",
              label: "Filter",
              icon: FilterIcon,
              active: activeRightPanel === "filter",
              onClick: () => {
                const newState = activeRightPanel !== "filter";
                setActiveRightPanel(newState ? "filter" : null);
                if (newState) setSelectedAircrafts([]);
              },
            },
            {
              id: "leaderboard",
              label: "Leaderboard",
              icon: LeaderboardIcon,
              active: false,
              onClick: () => router.push("/leaderboard"),
            },
            ...(!isProUser ? [{
              id: "upgrade",
              label: "Upgrade",
              icon: UpgradeIcon,
              active: false,
              onClick: () => router.push("/pricing"),
            }] : []),
            // External links (furthest from toggle)
            {
              id: "install",
              label: "Install",
              icon: InstallIcon,
              active: false,
              onClick: () => {
                window.open("https://xyzmani.com/radar", "_blank");
              },
            },
            {
              id: "discord",
              label: "Help",
              icon: DiscordIcon,
              active: false,
              onClick: () => {
                window.open("https://discord.gg/pbQF4txdRC", "_blank");
              },
            },
          ]}
        />
      )}

      {selectedAirport && (
        <div className={`fixed left-1/2 z-[10012] -translate-x-1/2 ${isMobile ? 'bottom-3' : 'bottom-6'}`}>
          <div className={`flex items-center rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl ${isMobile ? 'gap-2 px-3 py-2' : 'gap-4 px-5 py-3'}`}>
            <div>
              <div className={`font-mono text-cyan-300 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
                {selectedAirport.icao}
              </div>
              {!isMobile && (
                <div className="text-[10px] text-slate-400">
                  {selectedAirport.name}
                </div>
              )}
            </div>

            {!isMobile && (isProUser ? (
              <button
                onClick={() => setShowTaxiChart(true)}
                className="cursor-pointer rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[10px] text-cyan-300"
              >
                Charts
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
                <span className="text-[10px] text-white/60">Charts</span>
                <ProBadge />
              </div>
            ))}

            <button
              onClick={() => setShowAirportFID(!showAirportFID)}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[10px] transition-colors ${
                showAirportFID
                  ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-300"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
              } ${isMobile ? 'px-2 py-1 text-[9px]' : ''}`}
            >
              {isMobile ? 'FID' : 'Flights'}
            </button>

            <button
              onClick={() => setShowAtcPlayer(!showAtcPlayer)}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[10px] transition-colors ${
                showAtcPlayer
                  ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-300"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
              } ${isMobile ? 'px-2 py-1 text-[9px]' : ''}`}
            >
              {isMobile ? '📻' : 'ATC Audio'}
            </button>

            <button
              onClick={() => {
                setSelectedAirport(undefined);
                setShowAtcPlayer(false);
                setShowAirportFID(false);
                setChartOverlayActive(false);
              }}
              className={`cursor-pointer rounded-lg border border-white/10 bg-white/5 text-white/60 ${isMobile ? 'px-2 py-1 text-[9px]' : 'px-3 py-1.5 text-[10px]'}`}
            >
              {isMobile ? '×' : 'Unselect'}
            </button>
          </div>
        </div>
      )}

      {showAtcPlayer && selectedAirport && (
        <AtcPlayer
          icao={selectedAirport.icao}
          onClose={() => setShowAtcPlayer(false)}
        />
      )}

      {showAirportFID && selectedAirport && (
        isMobile ? (
          <MobileSwipeSheet onClose={() => setShowAirportFID(false)}>
            <AirportFIDPanel
              icao={selectedAirport.icao}
              airportLat={selectedAirport.lat}
              airportLon={selectedAirport.lon}
              aircrafts={aircrafts}
              onTrack={(ac) => {
                setSelectedAircrafts([ac]);
                setShowAirportFID(false);
                drawFlightPlanOnMapRef.current?.(ac, true);
              }}
              onClose={() => setShowAirportFID(false)}
              isMobile={true}
            />
          </MobileSwipeSheet>
        ) : (
          <AirportFIDPanel
            icao={selectedAirport.icao}
            airportLat={selectedAirport.lat}
            airportLon={selectedAirport.lon}
            aircrafts={aircrafts}
            onTrack={(ac) => {
              setSelectedAircrafts([ac]);
              setShowAirportFID(false);
              drawFlightPlanOnMapRef.current?.(ac, true);
            }}
            onClose={() => setShowAirportFID(false)}
            isMobile={false}
          />
        )
      )}

      {selectedAircrafts.length > 0 && (
        isMobile ? (
          <MobileSwipeSheet onClose={() => setSelectedAircrafts([])}>
            {selectedAircrafts.length === 1 ? (
              <Sidebar
                aircraft={selectedAircrafts[0]!}
                onWaypointClick={undefined}
                onHistoryClick={(flight) => {
                  setReplayFlight(flight);
                  setHistoryPath(flight.routeData || null);
                  setIsViewingHistory(true);
                }}
                isMobile={isMobile}
                onClose={() => setSelectedAircrafts([])}
                isFollowMode={isFollowMode}
                onToggleFollow={() => setIsFollowMode((prev) => !prev)}
              />
            ) : (
              <MultiAircraftSidebar
                aircrafts={selectedAircrafts}
                onRemoveAircraft={(aircraft) => {
                  const aircraftId = aircraft.callsign || aircraft.id;
                  const newSelection = selectedAircrafts.filter(
                    (ac) => (ac.callsign || ac.id) !== aircraftId
                  );
                  setSelectedAircrafts(newSelection);
                  if (newSelection.length > 0) {
                    drawMultipleFlightPlansOnMapRef.current?.(newSelection, false);
                  }
                }}
                onClose={() => setSelectedAircrafts([])}
                isMobile={isMobile}
              />
            )}
          </MobileSwipeSheet>
        ) : (
          <aside
            className={`fixed inset-y-0 right-0 z-[10014] border-l border-white/10 bg-black/90 backdrop-blur-xl transition-all duration-300 ease-in-out ${
              isSidebarCollapsed ? "w-12" : "w-[400px]"
            }`}
          >
            {/* Collapse/Expand toggle button */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="absolute -left-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-slate-900 text-slate-400 shadow-lg transition-colors hover:bg-slate-800 hover:text-white"
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform duration-300 ${isSidebarCollapsed ? "rotate-180" : ""}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {/* Collapsed state - minimal info */}
            {isSidebarCollapsed ? (
              <div className="flex h-full flex-col items-center py-6">
                <div className="mb-4 h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500 shadow-[0_0_8px_#22d3ee]" />
                <div className="writing-vertical font-mono text-[10px] font-bold tracking-wider text-cyan-400 uppercase" style={{ writingMode: "vertical-rl" }}>
                  {selectedAircrafts.length === 1
                    ? selectedAircrafts[0]?.flightNo || selectedAircrafts[0]?.callsign || "N/A"
                    : `${selectedAircrafts.length} SELECTED`}
                </div>
              </div>
            ) : (
              /* Expanded state - full sidebar content */
              selectedAircrafts.length === 1 ? (
                <Sidebar
                  aircraft={selectedAircrafts[0]!}
                  onWaypointClick={undefined}
                  onHistoryClick={(flight) => {
                    setReplayFlight(flight);
                    setHistoryPath(flight.routeData || null);
                    setIsViewingHistory(true);
                  }}
                  isMobile={isMobile}
                  onClose={() => setSelectedAircrafts([])}
                  isFollowMode={isFollowMode}
                  onToggleFollow={() => setIsFollowMode((prev) => !prev)}
                />
              ) : (
                <MultiAircraftSidebar
                  aircrafts={selectedAircrafts}
                  onRemoveAircraft={(aircraft) => {
                    const aircraftId = aircraft.callsign || aircraft.id;
                    const newSelection = selectedAircrafts.filter(
                      (ac) => (ac.callsign || ac.id) !== aircraftId
                    );
                    setSelectedAircrafts(newSelection);
                    if (newSelection.length > 0) {
                      drawMultipleFlightPlansOnMapRef.current?.(newSelection, false);
                    }
                  }}
                  onClose={() => setSelectedAircrafts([])}
                  isMobile={isMobile}
                />
              )
            )}
          </aside>
        )
      )}

      {showTaxiChart && selectedAirport?.icao && (
        <TaxiChartViewer
          icao={selectedAirport.icao}
          onClose={() => setShowTaxiChart(false)}
          onOpenSideView={() => setChartOverlayActive(true)}
        />
      )}

      {chartOverlayActive && selectedAirport?.icao && (
        <ChartSidePanel
          icao={selectedAirport.icao}
          onClose={() => setChartOverlayActive(false)}
        />
      )}

      {/* Flight Replay Controls */}
      {replayFlight && (
        <FlightReplayControls
          flight={replayFlight}
          onClose={() => {
            setReplayFlight(null);
            setReplayState(null);
            setHistoryPath(null);
            setIsViewingHistory(false);
          }}
          onStateChange={setReplayState}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

function MapSkeleton() {
  // Scattered aircraft positions (percentage-based)
  const dots = [
    { x: 15, y: 25 }, { x: 22, y: 35 }, { x: 18, y: 48 },
    { x: 30, y: 20 }, { x: 35, y: 42 }, { x: 28, y: 58 },
    { x: 45, y: 28 }, { x: 52, y: 38 }, { x: 48, y: 52 },
    { x: 58, y: 22 }, { x: 65, y: 45 }, { x: 62, y: 60 },
    { x: 72, y: 30 }, { x: 78, y: 48 }, { x: 75, y: 65 },
    { x: 85, y: 35 }, { x: 88, y: 55 }, { x: 82, y: 42 },
    { x: 40, y: 68 }, { x: 55, y: 72 }, { x: 25, y: 70 },
  ];

  return (
    <div className="relative h-full w-full bg-[#0a1219] overflow-hidden">
      {/* World map background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/world-outline.svg"
        alt=""
        className="absolute w-full h-full object-cover opacity-[0.06]"
        style={{
          filter: 'invert(65%) sepia(70%) saturate(400%) hue-rotate(140deg) brightness(95%)'
        }}
      />

      {/* Scattered glowing dots */}
      {dots.map((dot, i) => (
        <div
          key={i}
          className="absolute h-1 w-1 rounded-full bg-cyan-400 animate-pulse"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            opacity: 0.4 + (i % 3) * 0.2,
            animationDelay: `${(i * 150) % 2000}ms`,
          }}
        />
      ))}
    </div>
  );
}
