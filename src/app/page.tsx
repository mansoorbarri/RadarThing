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
import { useRouter } from "next/navigation";

import { type PositionUpdate } from "~/lib/aircraft-store";
import { useMobileDetection } from "~/hooks/useMobileDetection";
import { useAircraftStream } from "~/hooks/useAircraftStream";
import { useAirportData } from "~/hooks/useAirportData";
import { useAircraftSearch } from "~/hooks/useAircraftSearch";
import { useUtcTime } from "~/hooks/useUtcTime";
import { useTimer } from "~/hooks/useTimer";
import { useAirportChart } from "~/hooks/useAirportCharts";
import { useUserCapabilities } from "~/hooks/useUserCapabilities";

import { ConnectionStatusIndicator } from "~/components/atc/connectionStatusIndicator";
import { SearchBar } from "~/components/atc/searchbar";
import { Sidebar } from "~/components/atc/sidebar";
import { CallsignFilter } from "~/components/atc/callsignFilter";
import { UserAuth } from "~/components/atc/userAuth";
import { ControlDock } from "~/components/atc/controlDock";
import { FIDSPanel } from "~/components/atc/FIDSPanel";
import { TaxiChartViewer } from "~/components/airports/TaxiChartsViewer";
import Loading from "~/components/loading";
import { DockIcon, FlightsIcon, FilterIcon } from "~/utils/dockIcons";

const DynamicMapComponent = dynamic(() => import("~/components/map"), {
  ssr: false,
  loading: () => <Loading />,
});

type RightPanel = "fids" | "filter" | null;

export default function ATCPage() {
  const router = useRouter();
  const isMobile = useMobileDetection();

  const { aircrafts, isLoading, connectionStatus } = useAircraftStream();
  const { airports } = useAirportData();
  const { canViewTaxiCharts } = useUserCapabilities();

  const [selectedAircraft, setSelectedAircraft] =
    useState<PositionUpdate | null>(null);
  const [selectedAirport, setSelectedAirport] = useState<any>(undefined);

  const [historyPath, setHistoryPath] = useState<[number, number][] | null>(
    null,
  );
  const [isViewingHistory, setIsViewingHistory] = useState(false);

  const [selectedCallsigns, setSelectedCallsigns] = useState<Set<string>>(
    new Set(),
  );

  const [activeRightPanel, setActiveRightPanel] = useState<RightPanel>(null);

  const [showTaxiChart, setShowTaxiChart] = useState(false);
  const { chart } = useAirportChart(selectedAirport?.icao);

  const [showTimerPopup, setShowTimerPopup] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const { searchTerm, setSearchTerm, searchResults } = useAircraftSearch(
    aircrafts,
    airports,
  );

  const time = useUtcTime();
  const { formattedTime, isRunning, start, stop, reset } = useTimer();

  const drawFlightPlanOnMapRef = useRef<
    ((ac: PositionUpdate, zoom?: boolean) => void) | null
  >(null);

  const filteredAircrafts = useMemo(() => {
    if (selectedCallsigns.size === 0) return aircrafts;

    const prefixRegex = /^[A-Z]+/;

    return aircrafts.filter((aircraft) => {
      if (!aircraft.flightNo) return false;
      const match = prefixRegex.exec(aircraft.flightNo.trim().toUpperCase());
      return match && selectedCallsigns.has(match[0]);
    });
  }, [aircrafts, selectedCallsigns]);

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

  useEffect(() => {
    if (!selectedAircraft || isViewingHistory) return;

    const updated = aircrafts.find(
      (ac) =>
        (ac.id && ac.id === selectedAircraft.id) ||
        (ac.callsign && ac.callsign === selectedAircraft.callsign),
    );

    if (updated) setSelectedAircraft(updated);
  }, [aircrafts, isViewingHistory, selectedAircraft]);

  function handleAircraftSelect(aircraft: PositionUpdate | null) {
    setIsViewingHistory(false);
    setHistoryPath(null);
    setSelectedAircraft(aircraft);
    setActiveRightPanel(null);
    if (aircraft) {
      setSelectedAirport(undefined);
    }
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <header className="absolute top-0 right-0 left-0 z-[10010] flex h-20 items-start justify-between px-6 pt-5">
        <div className="flex items-center gap-6">
          {/* <Image src="/favicon.ico" alt="RadarThing" width={32} height={32} /> */}

          {isMapLoaded && (
            <div className="pointer-events-auto h-11 w-80 lg:w-96">
              <SearchBar
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                searchResults={searchResults}
                isMobile={isMobile}
                onSelectAircraft={(ac) => {
                  setSelectedAircraft(ac);
                  drawFlightPlanOnMapRef.current?.(ac, true);
                  setSearchTerm("");
                }}
                onSelectAirport={(ap) => {
                  setSelectedAirport(ap);
                  setSearchTerm("");
                }}
              />
            </div>
          )}
        </div>

        <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2">
          <button
            onClick={() => setShowTimerPopup(!showTimerPopup)}
            className="rounded-full border border-white/10 bg-black/40 px-4 py-1.5 backdrop-blur-md"
          >
            <span className="font-mono text-xl text-cyan-400">
              {time} <span className="text-[10px] text-slate-500">UTC</span>
            </span>
            {isRunning && (
              <span className="block animate-pulse text-[9px] tracking-widest text-emerald-400 uppercase">
                Timer Active
              </span>
            )}
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-4">
          <ConnectionStatusIndicator
            status={connectionStatus}
            isMobile={isMobile}
          />
          <UserAuth />
        </div>
      </header>

      <main className="absolute inset-0">
        {isLoading ? (
          <Loading />
        ) : (
          <DynamicMapComponent
            aircrafts={filteredAircrafts}
            airports={airports}
            selectedAirport={selectedAirport}
            onAircraftSelect={handleAircraftSelect}
            setDrawFlightPlanOnMap={(fn) => {
              drawFlightPlanOnMapRef.current = fn;
            }}
            onMapReady={() => setIsMapLoaded(true)}
            historyPath={historyPath}
          />
        )}
      </main>

      {activeRightPanel === "fids" && (
        <aside className="fixed inset-y-0 right-0 z-[10012] w-[420px] border-l border-white/10 bg-black/80 backdrop-blur-xl">
          <FIDSPanel
            aircrafts={aircrafts}
            onTrack={(ac) => {
              setSelectedAircraft(ac);
              drawFlightPlanOnMapRef.current?.(ac, true);
            }}
          />
        </aside>
      )}

      {activeRightPanel === "filter" && (
        <aside className="fixed inset-y-0 right-0 z-[10013] w-[360px] border-l border-white/10 bg-black/80 backdrop-blur-xl">
          <CallsignFilter
            aircrafts={aircrafts}
            selectedCallsigns={selectedCallsigns}
            onToggleCallsign={handleToggleCallsign}
            onClearFilters={handleClearFilters}
          />
        </aside>
      )}

      <ControlDock
        side="right"
        items={[
          {
            id: "fids",
            label: "Flights",
            icon: FlightsIcon,
            active: activeRightPanel === "fids",
            onClick: () =>
              setActiveRightPanel(activeRightPanel === "fids" ? null : "fids"),
          },
          {
            id: "filter",
            label: "Filter",
            icon: FilterIcon,
            active: activeRightPanel === "filter",
            onClick: () =>
              setActiveRightPanel(
                activeRightPanel === "filter" ? null : "filter",
              ),
          },
        ]}
      />

      {selectedAirport && (
        <div className="fixed bottom-6 left-1/2 z-[10012] -translate-x-1/2">
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/80 px-5 py-3 backdrop-blur-xl">
            <div>
              <div className="font-mono text-xs text-cyan-300">
                {selectedAirport.icao}
              </div>
              <div className="text-[10px] text-slate-400">
                {selectedAirport.name}
              </div>
            </div>

            {canViewTaxiCharts ? (
              <button
                onClick={() => setShowTaxiChart(true)}
                className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[10px] text-cyan-300"
              >
                Taxi Chart
              </button>
            ) : (
              <button
                onClick={() => router.push("/upgrade")}
                className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-[10px] text-yellow-400"
              >
                Taxi Charts (Premium)
              </button>
            )}

            <button
              onClick={() => setSelectedAirport(undefined)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-white/60"
            >
              Unselect
            </button>
          </div>
        </div>
      )}

      {selectedAircraft && (
        <aside className="fixed inset-y-0 right-0 z-[10014] w-[400px] border-l border-white/10 bg-black/90 backdrop-blur-xl">
          <Sidebar
            aircraft={selectedAircraft}
            onWaypointClick={undefined}
            onHistoryClick={(path) => {
              setHistoryPath(path);
              setIsViewingHistory(true);
            }}
            isMobile={isMobile}
          />
        </aside>
      )}

      {showTaxiChart && chart && (
        <TaxiChartViewer
          chart={chart}
          onClose={() => setShowTaxiChart(false)}
        />
      )}
    </div>
  );
}
