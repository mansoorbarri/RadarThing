"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import dynamic from "next/dynamic";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { useMobileDetection } from "~/hooks/useMobileDetection";
import { useAircraftStream } from "~/hooks/useAircraftStream";
import { useAirportData } from "~/hooks/useAirportData";
import { useAircraftSearch } from "~/hooks/useAircraftSearch";
import { ConnectionStatusIndicator } from "~/components/atc/connectionStatusIndicator";
import { SearchBar } from "~/components/atc/searchbar";
import { Sidebar } from "~/components/atc/sidebar";
import Loading from "~/components/loading";
import { useUtcTime } from "~/hooks/useUtcTime";
import { useTimer } from "~/hooks/useTimer";
import {
  maybeAddSecretAircraft,
  maybeSpawnUFO,
  maybeAddTopGunAircraft,
  detectSupersonicAircraft,
  rotateMapOnSecretCallsign,
} from "~/lib/easter-eggs";
import { useEasterEggs } from "~/hooks/useEasterEggs";

interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
  frequencies?: { type: string; frequency: string }[];
}

const DynamicMapComponent = dynamic(() => import("~/components/map"), {
  ssr: false,
  loading: () => <Loading />,
});

export default function ATCPage() {
  const isMobile = useMobileDetection();
  const { aircrafts, isLoading, connectionStatus } = useAircraftStream();
  const { airports } = useAirportData();
  const [selectedAircraft, setSelectedAircraft] =
    useState<PositionUpdate | null>(null);
  const [selectedAirport, setSelectedAirport] = useState<Airport | undefined>(
    undefined,
  );
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<
    number | null
  >(null);
  const { searchTerm, setSearchTerm, searchResults } = useAircraftSearch(
    aircrafts,
    airports,
  );
  const time = useUtcTime();
  const { formattedTime, isRunning, start, stop, reset } = useTimer();
  const [showTimerPopup, setShowTimerPopup] = useState(false);
  const drawFlightPlanOnMapRef = useRef<
    ((aircraft: PositionUpdate, shouldZoom?: boolean) => void) | null
  >(null);

  useEasterEggs();

  const setDrawFlightPlanOnMap = useCallback(
    (func: (aircraft: PositionUpdate, shouldZoom?: boolean) => void) => {
      drawFlightPlanOnMapRef.current = func;
    },
    [],
  );

  const handleAircraftSelect = useCallback(
    (aircraft: PositionUpdate | null) => {
      setSelectedAircraft(aircraft);
      setSelectedWaypointIndex(null);
      setSelectedAirport(undefined);
    },
    [],
  );

  const handleWaypointClick = useCallback((_waypoint: any, index: number) => {
    setSelectedWaypointIndex(index);
  }, []);

  const handleSearchBarAircraftSelect = useCallback(
    (aircraft: PositionUpdate) => {
      setSelectedAircraft(aircraft);
      drawFlightPlanOnMapRef.current?.(aircraft, true);
      setSelectedAirport(undefined);
      setSearchTerm("");
    },
    [setSearchTerm],
  );

  const handleSearchBarAirportSelect = useCallback(
    (airport: Airport) => {
      setSelectedAirport(airport);
      setSelectedAircraft(null);
      setSelectedWaypointIndex(null);
      setSearchTerm("");
    },
    [setSearchTerm],
  );

  useEffect(() => {
    if (selectedAircraft && aircrafts.length > 0) {
      const updatedAircraft = aircrafts.find(
        (ac) =>
          (ac.id && ac.id === selectedAircraft.id) ||
          (ac.callsign && ac.callsign === selectedAircraft.callsign),
      );
      if (updatedAircraft) {
        setSelectedAircraft(updatedAircraft);
      } else {
        setSelectedAircraft(null);
        setSelectedWaypointIndex(null);
      }
    }
  }, [aircrafts, selectedAircraft]);

  const selectedAirportFromSearch = searchResults.find(
    (r) =>
      !("callsign" in r) &&
      searchTerm &&
      r.icao.toLowerCase() === searchTerm.toLowerCase(),
  ) as Airport | undefined;

  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const augmentedAircrafts = useMemo(() => {
    let updated = [...aircrafts];
    updated = maybeAddSecretAircraft(updated);
    updated = maybeSpawnUFO(updated);
    updated = maybeAddTopGunAircraft(updated);
    detectSupersonicAircraft(updated);
    rotateMapOnSecretCallsign(updated);
    return updated;
  }, [aircrafts]);

  return (
    <div className="relative h-[100vh] w-[100vw] overflow-hidden bg-[#010b10]">
      {isMapLoaded && (
        <div
          className={`absolute top-2 z-[10000] ${
            isMobile ? "left-1/2 -translate-x-1/2" : "left-10"
          }`}
        >
          <SearchBar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            searchResults={searchResults}
            isMobile={isMobile}
            onSelectAircraft={handleSearchBarAircraftSelect}
            onSelectAirport={handleSearchBarAirportSelect}
          />
        </div>
      )}
      <div className="absolute top-2 right-2 z-[10000]">
        <ConnectionStatusIndicator
          status={connectionStatus}
          isMobile={isMobile}
        />
      </div>

      <div className="absolute inset-0">
        {isLoading && aircrafts.length === 0 ? (
          <Loading />
        ) : (
          <DynamicMapComponent
            aircrafts={augmentedAircrafts}
            airports={airports}
            onAircraftSelect={handleAircraftSelect}
            selectedWaypointIndex={selectedWaypointIndex}
            selectedAirport={selectedAirport || selectedAirportFromSearch}
            setDrawFlightPlanOnMap={setDrawFlightPlanOnMap}
            onMapReady={() => setIsMapLoaded(true)}
          />
        )}
      </div>

      {/* UTC CLOCK + TIMER */}
      <div
        onClick={() => setShowTimerPopup((p) => !p)}
        className="absolute bottom-6 right-3 z-[10001] cursor-pointer select-none font-mono text-[15px] text-cyan-400 transition-all duration-300 hover:text-cyan-300 drop-shadow-[0_0_6px_rgba(0,255,255,0.45)]"
        title="Toggle Timer"
      >
        {time} UTC
      </div>

      {showTimerPopup && (
        <div
          className="absolute bottom-16 right-3 z-[10002] w-[170px] text-center font-mono
          rounded-md border border-cyan-400/30 bg-black/80 p-3 text-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.25)]
          backdrop-blur-sm transition-all duration-200 hover:shadow-[0_0_15px_rgba(0,255,255,0.45)]"
        >
          <div className="mb-2 text-[14px] drop-shadow-[0_0_4px_rgba(0,255,255,0.4)]">
            {formattedTime}
          </div>
          <div className="flex justify-center gap-2">
            {isRunning ? (
              <button
                onClick={stop}
                className="rounded-md border border-red-400/40 bg-red-500/20 px-2 py-[2px] text-[12px] text-red-400 
                transition-all duration-150 hover:border-red-400 hover:bg-red-400/30 hover:text-red-300"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={start}
                className="rounded-md border border-green-400/40 bg-green-500/20 px-2 py-[2px] text-[12px] text-green-400 
                transition-all duration-150 hover:border-green-400 hover:bg-green-400/30 hover:text-green-300"
              >
                Start
              </button>
            )}
            <button
              onClick={reset}
              className="rounded-md border border-blue-400/40 bg-blue-500/20 px-2 py-[2px] text-[12px] text-blue-400 
              transition-all duration-150 hover:border-blue-400 hover:bg-blue-400/30 hover:text-blue-300"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {selectedAircraft && (
        <div
          className={`z-[99997] transition-transform duration-300 ease-in-out ${
            isMobile
              ? "fixed bottom-0 left-0 w-full"
              : "absolute right-0 top-0 h-full w-[380px]"
          }`}
        >
          <Sidebar
            aircraft={selectedAircraft}
            onWaypointClick={handleWaypointClick}
            isMobile={isMobile}
          />
        </div>
      )}
    </div>
  );
}