"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { type PositionUpdate } from "~/lib/aircraft-store";

import { useMobileDetection } from "~/hooks/useMobileDetection";
import { useAircraftStream } from "~/hooks/useAircraftStream";
import { useAirportData } from "~/hooks/useAirportData";
import { useAircraftSearch } from "~/hooks/useAircraftSearch";
import { ConnectionStatusIndicator } from "~/components/atc/connectionStatusIndicator";
import { SearchBar } from "~/components/atc/searchbar";
import { Sidebar } from "~/components/atc/sidebar";

interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
  frequencies?: { type: string; frequency: string }[];
}

const DynamicMapComponent = dynamic(() => import("~/components/map"), {
  ssr: false,
  loading: () => (
    <div style={{ textAlign: "center", paddingTop: "50px", color: "#ccc" }}>
      Loading Map...
    </div>
  ),
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

  const drawFlightPlanOnMapRef = useRef<
    ((aircraft: PositionUpdate, shouldZoom?: boolean) => void) | null
  >(null);

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

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#111827",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 10,
          left: isMobile ? "50%" : 50,
          transform: isMobile ? "translateX(-50%)" : "none",
          zIndex: 10000,
        }}
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

      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 10000,
        }}
      >
        <ConnectionStatusIndicator
          status={connectionStatus}
          isMobile={isMobile}
        />
      </div>

      <div
        style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
      >
        {isLoading && aircrafts.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              paddingTop: "50px",
              color: "#9ca3af",
              fontSize: "16px",
            }}
          >
            Loading initial data...
          </div>
        ) : (
          <DynamicMapComponent
            aircrafts={aircrafts}
            airports={airports}
            onAircraftSelect={handleAircraftSelect}
            selectedWaypointIndex={selectedWaypointIndex}
            selectedAirport={selectedAirport || selectedAirportFromSearch}
            setDrawFlightPlanOnMap={setDrawFlightPlanOnMap}
          />
        )}
      </div>

      {selectedAircraft && (
        <div
          style={{
            transform:
              !isMobile && selectedAircraft
                ? "translateX(0)"
                : !isMobile
                  ? "translateX(380px)"
                  : "none",
            transition: isMobile
              ? "none"
              : "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            position: isMobile ? "fixed" : "absolute",
            top: isMobile ? "auto" : 0,
            bottom: isMobile ? 0 : "auto",
            right: isMobile ? "auto" : 0,
            left: isMobile ? 0 : "auto",
            zIndex: 99997,
            width: isMobile ? "100%" : "380px",
            height: isMobile ? "auto" : "100%",
          }}
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
