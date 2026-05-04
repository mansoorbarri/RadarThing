"use client";

import {
  useDeferredValue,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRightLeft,
  Plane,
  RadioTower,
  Route,
  Search,
  X,
} from "lucide-react";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { type OnlineAirport } from "~/hooks/useAircraftStream";

interface AirportRecord {
  name: string;
  lat: number;
  lon: number;
  icao: string;
}

interface AirportActivityPanelProps {
  aircrafts: PositionUpdate[];
  airports: AirportRecord[];
  onlineAirports: OnlineAirport[];
  selectedAirportIcao?: string;
  isAirportDataLoading?: boolean;
  onSelectAirport: (icao: string) => void;
}

interface AirportActivityEntry {
  icao: string;
  name: string;
  departures: number;
  arrivals: number;
  totalFlights: number;
  controllerCount: number;
  controllerPositions: string[];
  controllerNames: string[];
}

interface RouteActivityEntry {
  id: string;
  departure: string;
  arrival: string;
  departureName: string;
  arrivalName: string;
  count: number;
}

type AirportSortMode = "traffic" | "arrivals" | "departures" | "staffing";

function normalizeIcao(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9]{3,4}$/.test(normalized) ? normalized : null;
}

function abbreviatePosition(position: string) {
  if (position === "control") return "CTR";
  if (position === "tower") return "TWR";
  if (position === "ground") return "GND";
  if (position === "delivery") return "DEL";
  return position.slice(0, 3).toUpperCase();
}

function formatAirportName(name: string, icao: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.toUpperCase() === icao) return "Airport data pending";
  return trimmed;
}

function matchesAirportSearch(airport: AirportActivityEntry, query: string) {
  if (!query) return true;

  const haystack = [
    airport.icao,
    airport.name,
    ...airport.controllerNames,
    ...airport.controllerPositions,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function matchesRouteSearch(route: RouteActivityEntry, query: string) {
  if (!query) return true;

  const haystack = [
    route.departure,
    route.arrival,
    route.departureName,
    route.arrivalName,
    route.id,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function sortAirports(
  airports: AirportActivityEntry[],
  sortMode: AirportSortMode,
) {
  return [...airports].sort((a, b) => {
    if (sortMode === "arrivals" && b.arrivals !== a.arrivals) {
      return b.arrivals - a.arrivals;
    }
    if (sortMode === "departures" && b.departures !== a.departures) {
      return b.departures - a.departures;
    }
    if (sortMode === "staffing" && b.controllerCount !== a.controllerCount) {
      return b.controllerCount - a.controllerCount;
    }
    if (b.totalFlights !== a.totalFlights) {
      return b.totalFlights - a.totalFlights;
    }
    if (b.controllerCount !== a.controllerCount) {
      return b.controllerCount - a.controllerCount;
    }
    if (b.arrivals !== a.arrivals) {
      return b.arrivals - a.arrivals;
    }
    if (b.departures !== a.departures) {
      return b.departures - a.departures;
    }
    return a.icao.localeCompare(b.icao);
  });
}

function getSortSummaryLabel(sortMode: AirportSortMode) {
  if (sortMode === "arrivals") return "Inbound pressure";
  if (sortMode === "departures") return "Outbound pressure";
  if (sortMode === "staffing") return "Controller depth";
  return "Overall traffic";
}

export function AirportActivityPanel({
  aircrafts,
  airports,
  onlineAirports,
  selectedAirportIcao,
  isAirportDataLoading = false,
  onSelectAirport,
}: AirportActivityPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState<AirportSortMode>("traffic");
  const [staffedOnly, setStaffedOnly] = useState(false);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const normalizedQuery = deferredSearchTerm.trim().toLowerCase();

  const airportNameByIcao = useMemo(
    () =>
      new Map(
        airports.map((airport) => [
          airport.icao.trim().toUpperCase(),
          airport.name,
        ]),
      ),
    [airports],
  );

  const {
    airportEntriesByIcao,
    allAirports,
    staffedAirports,
    allRoutes,
    activeAirportCount,
    staffedAirportCount,
    routePairCount,
    totalMovements,
  } = useMemo(() => {
    const airportMap = new Map<string, AirportActivityEntry>();
    const routeMap = new Map<string, RouteActivityEntry>();

    const ensureAirport = (icao: string) => {
      const existing = airportMap.get(icao);
      if (existing) return existing;

      const next: AirportActivityEntry = {
        icao,
        name: airportNameByIcao.get(icao) ?? icao,
        departures: 0,
        arrivals: 0,
        totalFlights: 0,
        controllerCount: 0,
        controllerPositions: [],
        controllerNames: [],
      };
      airportMap.set(icao, next);
      return next;
    };

    for (const airport of onlineAirports) {
      const icao = normalizeIcao(airport.icao);
      if (!icao) continue;

      const entry = ensureAirport(icao);
      entry.controllerCount = airport.controllers.length;
      entry.controllerPositions = airport.controllers.map((controller) =>
        abbreviatePosition(controller.position),
      );
      entry.controllerNames = airport.controllers.map(
        (controller) => controller.user,
      );
    }

    for (const aircraft of aircrafts) {
      const departure = normalizeIcao(aircraft.departure);
      const arrival = normalizeIcao(aircraft.arrival);

      if (departure) {
        const departureEntry = ensureAirport(departure);
        departureEntry.departures += 1;
        departureEntry.totalFlights += 1;
      }

      if (arrival) {
        const arrivalEntry = ensureAirport(arrival);
        arrivalEntry.arrivals += 1;
        arrivalEntry.totalFlights += 1;
      }

      if (departure && arrival) {
        const routeId = `${departure}-${arrival}`;
        const existingRoute = routeMap.get(routeId);
        if (existingRoute) {
          existingRoute.count += 1;
        } else {
          routeMap.set(routeId, {
            id: routeId,
            departure,
            arrival,
            departureName: airportNameByIcao.get(departure) ?? departure,
            arrivalName: airportNameByIcao.get(arrival) ?? arrival,
            count: 1,
          });
        }
      }
    }

    const airportEntries = Array.from(airportMap.values()).filter(
      (airport) => airport.totalFlights > 0 || airport.controllerCount > 0,
    );
    const staffedEntries = airportEntries.filter(
      (airport) => airport.controllerCount > 0,
    );
    const routeEntries = Array.from(routeMap.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.id.localeCompare(b.id);
    });

    return {
      airportEntriesByIcao: airportMap,
      allAirports: airportEntries,
      staffedAirports: staffedEntries,
      allRoutes: routeEntries,
      activeAirportCount: airportEntries.filter(
        (airport) => airport.totalFlights > 0,
      ).length,
      staffedAirportCount: staffedEntries.length,
      routePairCount: routeEntries.length,
      totalMovements: airportEntries.reduce(
        (sum, airport) => sum + airport.totalFlights,
        0,
      ),
    };
  }, [aircrafts, airportNameByIcao, onlineAirports]);

  const filteredActivityAirports = useMemo(() => {
    const matching = allAirports.filter((airport) => {
      if (staffedOnly && airport.controllerCount === 0) return false;
      return matchesAirportSearch(airport, normalizedQuery);
    });

    return sortAirports(matching, sortMode);
  }, [allAirports, normalizedQuery, sortMode, staffedOnly]);

  const filteredStaffedAirports = useMemo(
    () =>
      staffedAirports
        .filter((airport) => matchesAirportSearch(airport, normalizedQuery))
        .sort((a, b) => {
          if (b.controllerCount !== a.controllerCount) {
            return b.controllerCount - a.controllerCount;
          }
          if (b.totalFlights !== a.totalFlights) {
            return b.totalFlights - a.totalFlights;
          }
          return a.icao.localeCompare(b.icao);
        }),
    [normalizedQuery, staffedAirports],
  );

  const filteredRoutes = useMemo(
    () => allRoutes.filter((route) => matchesRouteSearch(route, normalizedQuery)),
    [allRoutes, normalizedQuery],
  );

  const selectedAirportEntry = useMemo(() => {
    const normalizedSelected = normalizeIcao(selectedAirportIcao);
    if (!normalizedSelected) return null;

    const existing = airportEntriesByIcao.get(normalizedSelected);
    if (existing) return existing;

    return {
      icao: normalizedSelected,
      name: airportNameByIcao.get(normalizedSelected) ?? normalizedSelected,
      departures: 0,
      arrivals: 0,
      totalFlights: 0,
      controllerCount: 0,
      controllerPositions: [],
      controllerNames: [],
    } satisfies AirportActivityEntry;
  }, [airportEntriesByIcao, airportNameByIcao, selectedAirportIcao]);

  const topActivityAirports = filteredActivityAirports.slice(0, 12);
  const topStaffedAirports = filteredStaffedAirports.slice(0, 8);
  const topRoutes = filteredRoutes.slice(0, 10);
  const hasSearch = normalizedQuery.length > 0;

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_32%),linear-gradient(180deg,rgba(6,11,18,0.98),rgba(2,6,12,0.98))]">
      <div className="border-b border-cyan-400/10 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] tracking-[0.28em] text-cyan-400 uppercase">
              Airport Activity
            </div>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Live airport pressure board
            </h2>
            <p className="mt-1 text-sm leading-6 text-white/45">
              Find the busy fields, ATC-staffed airports, and hot routes, then
              jump straight into the existing airport workflow.
            </p>
          </div>
          {isAirportDataLoading && (
            <div className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 font-mono text-[10px] tracking-wider text-cyan-200 uppercase">
              Loading names
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <SummaryCard
            label="Active Airports"
            value={activeAirportCount}
            accent="cyan"
            icon={<Plane className="h-3.5 w-3.5" />}
          />
          <SummaryCard
            label="Staffed Fields"
            value={staffedAirportCount}
            accent="emerald"
            icon={<RadioTower className="h-3.5 w-3.5" />}
          />
          <SummaryCard
            label="Hot Routes"
            value={routePairCount}
            accent="amber"
            icon={<Route className="h-3.5 w-3.5" />}
          />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-cyan-400/60" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search airport, controller, or route..."
              className="w-full rounded-xl border border-white/10 bg-black/35 py-2.5 pr-10 pl-9 text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:border-cyan-400/40"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/8 hover:text-white/75"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ["traffic", "Traffic"],
                ["arrivals", "Arrivals"],
                ["departures", "Departures"],
                ["staffing", "Staffing"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={`cursor-pointer rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors ${
                  sortMode === mode
                    ? "border-cyan-400/40 bg-cyan-500/14 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white/85"
                }`}
              >
                {label}
              </button>
            ))}

            <button
              onClick={() => setStaffedOnly((prev) => !prev)}
              className={`cursor-pointer rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors ${
                staffedOnly
                  ? "border-emerald-400/40 bg-emerald-500/14 text-emerald-100"
                  : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white/85"
              }`}
            >
              Staffed Only
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-white/38">
            <span>
              {totalMovements.toLocaleString()} live airport movements in the
              current stream
            </span>
            <span>{getSortSummaryLabel(sortMode)}</span>
          </div>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {selectedAirportEntry && (
          <SelectedAirportSpotlight
            airport={selectedAirportEntry}
            onOpen={() => onSelectAirport(selectedAirportEntry.icao)}
          />
        )}

        <SectionHeader
          title="Activity Board"
          subtitle="Sorted live airport rankings with traffic and staffing pressure."
          badge={`${filteredActivityAirports.length} match${filteredActivityAirports.length === 1 ? "" : "es"}`}
        />
        {topActivityAirports.length === 0 ? (
          <EmptySection
            message={
              hasSearch
                ? "No airports match that search or filter."
                : "No airport activity is visible in the live stream yet."
            }
          />
        ) : (
          <div className="space-y-2">
            {topActivityAirports.map((airport, index) => (
              <AirportRow
                key={airport.icao}
                airport={airport}
                selected={selectedAirportIcao === airport.icao}
                index={index}
                onSelectAirport={onSelectAirport}
                emphasis={sortMode}
              />
            ))}
          </div>
        )}

        <SectionHeader
          title="Staffed Airports"
          subtitle="Controllers online right now, ordered by staffing depth."
          badge={`${filteredStaffedAirports.length} staffed`}
        />
        {topStaffedAirports.length === 0 ? (
          <EmptySection
            message={
              hasSearch
                ? "No staffed airports match that search."
                : "No staffed airports are online at the moment."
            }
          />
        ) : (
          <div className="space-y-2">
            {topStaffedAirports.map((airport) => (
              <StaffedAirportRow
                key={`staffed-${airport.icao}`}
                airport={airport}
                selected={selectedAirportIcao === airport.icao}
                onSelectAirport={onSelectAirport}
              />
            ))}
          </div>
        )}

        <SectionHeader
          title="Route Board"
          subtitle="City-pairs attracting the most live flights right now."
          badge={`${filteredRoutes.length} route${filteredRoutes.length === 1 ? "" : "s"}`}
        />
        {topRoutes.length === 0 ? (
          <EmptySection
            message={
              hasSearch
                ? "No live routes match that search."
                : "No filed live routes are available in the stream."
            }
          />
        ) : (
          <div className="space-y-2">
            {topRoutes.map((route, index) => (
              <RouteRow
                key={route.id}
                route={route}
                index={index}
                onSelectAirport={onSelectAirport}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  accent: "cyan" | "emerald" | "amber";
}) {
  const accentClass =
    accent === "emerald"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
      : accent === "amber"
        ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
        : "border-cyan-400/20 bg-cyan-500/10 text-cyan-200";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
      <div
        className={`inline-flex rounded-full border px-2 py-1 ${accentClass}`}
      >
        {icon}
      </div>
      <div className="mt-3 font-mono text-2xl font-semibold text-white">
        {value}
      </div>
      <div className="mt-1 text-[11px] tracking-[0.18em] text-white/35 uppercase">
        {label}
      </div>
    </div>
  );
}

function SelectedAirportSpotlight({
  airport,
  onOpen,
}: {
  airport: AirportActivityEntry;
  onOpen: () => void;
}) {
  const statusLabel =
    airport.totalFlights > 0
      ? `${airport.totalFlights} live movement${airport.totalFlights === 1 ? "" : "s"}`
      : "Quiet right now";

  return (
    <div className="rounded-[1.4rem] border border-cyan-400/20 bg-[linear-gradient(145deg,rgba(6,18,28,0.96),rgba(4,9,16,0.98))] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] tracking-[0.24em] text-cyan-400 uppercase">
            Selected Airport
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-lg font-semibold text-white">
              {airport.icao}
            </span>
            {airport.controllerCount > 0 && (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/12 px-2 py-0.5 font-mono text-[10px] tracking-wider text-emerald-200 uppercase">
                {airport.controllerCount} ATC
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-white/45">
            {formatAirportName(airport.name, airport.icao)}
          </div>
        </div>
        <button
          onClick={onOpen}
          className="cursor-pointer rounded-full border border-cyan-400/25 bg-cyan-500/12 px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] text-cyan-100 uppercase transition-colors hover:bg-cyan-500/18"
        >
          Center Map
        </button>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <MetricPill label="Live" value={airport.totalFlights} />
        <MetricPill label="Arr" value={airport.arrivals} />
        <MetricPill label="Dep" value={airport.departures} />
        <MetricPill label="ATC" value={airport.controllerCount} />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-white/40">
        <span>{statusLabel}</span>
        {airport.controllerPositions.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-1.5">
            {airport.controllerPositions.map((position, index) => (
              <span
                key={`${airport.icao}-spotlight-${position}-${index}`}
                title={airport.controllerNames[index]}
                className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[10px] text-white/70"
              >
                {position}
              </span>
            ))}
          </div>
        ) : (
          <span>No controllers online</span>
        )}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <div className="font-mono text-[11px] tracking-[0.24em] text-cyan-400 uppercase">
          {title}
        </div>
        <div className="mt-1 text-xs leading-5 text-white/40">{subtitle}</div>
      </div>
      {badge && (
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] tracking-[0.16em] text-white/45 uppercase">
          {badge}
        </div>
      )}
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-4 py-5 text-sm text-white/35">
      {message}
    </div>
  );
}

function AirportRow({
  airport,
  selected,
  index,
  onSelectAirport,
  emphasis,
}: {
  airport: AirportActivityEntry;
  selected: boolean;
  index: number;
  onSelectAirport: (icao: string) => void;
  emphasis: AirportSortMode;
}) {
  const totalMovements = Math.max(airport.totalFlights, 1);
  const departuresWidth = `${(airport.departures / totalMovements) * 100}%`;
  const arrivalsWidth = `${(airport.arrivals / totalMovements) * 100}%`;
  const emphasisValue =
    emphasis === "arrivals"
      ? airport.arrivals
      : emphasis === "departures"
        ? airport.departures
        : emphasis === "staffing"
          ? airport.controllerCount
          : airport.totalFlights;
  const emphasisLabel =
    emphasis === "arrivals"
      ? "arrivals"
      : emphasis === "departures"
        ? "departures"
        : emphasis === "staffing"
          ? "controllers"
          : "live moves";

  return (
    <button
      onClick={() => onSelectAirport(airport.icao)}
      className={`w-full cursor-pointer rounded-2xl border p-3 text-left transition-colors ${
        selected
          ? "border-cyan-400/35 bg-cyan-500/12"
          : "border-white/10 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.05]"
      }`}
      style={{ animationDelay: `${Math.min(index * 35, 350)}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-white">
              {airport.icao}
            </span>
            {airport.controllerCount > 0 && (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/12 px-2 py-0.5 font-mono text-[10px] tracking-wider text-emerald-200 uppercase">
                Staffed
              </span>
            )}
          </div>
          <div className="mt-1 truncate text-xs text-white/40">
            {formatAirportName(airport.name, airport.icao)}
          </div>
        </div>

        <div className="text-right">
          <div className="font-mono text-lg font-semibold text-cyan-200">
            {emphasisValue}
          </div>
          <div className="text-[10px] tracking-[0.18em] text-white/30 uppercase">
            {emphasisLabel}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-white/55">
        <MetricPill label="Dep" value={airport.departures} />
        <MetricPill label="Arr" value={airport.arrivals} />
        <MetricPill label="ATC" value={airport.controllerCount} />
      </div>

      <div className="mt-3 space-y-2">
        <ProgressRow label="Outbound" value={airport.departures} width={departuresWidth} colorClass="bg-cyan-300/85" />
        <ProgressRow label="Inbound" value={airport.arrivals} width={arrivalsWidth} colorClass="bg-emerald-300/85" />
      </div>
    </button>
  );
}

function StaffedAirportRow({
  airport,
  selected,
  onSelectAirport,
}: {
  airport: AirportActivityEntry;
  selected: boolean;
  onSelectAirport: (icao: string) => void;
}) {
  return (
    <button
      onClick={() => onSelectAirport(airport.icao)}
      className={`w-full cursor-pointer rounded-2xl border p-3 text-left transition-colors ${
        selected
          ? "border-emerald-400/40 bg-emerald-500/12"
          : "border-white/10 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.05]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-sm font-semibold text-white">
            {airport.icao}
          </div>
          <div className="mt-1 truncate text-xs text-white/40">
            {formatAirportName(airport.name, airport.icao)}
          </div>
        </div>
        <div className="rounded-full border border-emerald-400/20 bg-emerald-500/12 px-2.5 py-1 font-mono text-[10px] tracking-wider text-emerald-200 uppercase">
          {airport.controllerCount} online
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MetricPill label="Live" value={airport.totalFlights} />
        <MetricPill label="Arr" value={airport.arrivals} />
        <MetricPill label="Dep" value={airport.departures} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {airport.controllerPositions.map((position, index) => (
          <span
            key={`${airport.icao}-${position}-${index}`}
            title={airport.controllerNames[index]}
            className="rounded-full border border-white/10 bg-black/30 px-2 py-1 font-mono text-[10px] text-white/70"
          >
            {position}
          </span>
        ))}
      </div>
    </button>
  );
}

function RouteRow({
  route,
  index,
  onSelectAirport,
}: {
  route: RouteActivityEntry;
  index: number;
  onSelectAirport: (icao: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-sm font-semibold text-white">
            <span>{route.departure}</span>
            <ArrowRightLeft className="h-3.5 w-3.5 text-cyan-300/70" />
            <span>{route.arrival}</span>
          </div>
          <div className="mt-1 truncate text-xs text-white/40">
            {formatAirportName(route.departureName, route.departure)} to{" "}
            {formatAirportName(route.arrivalName, route.arrival)}
          </div>
        </div>
        <div className="text-right">
          <div className="rounded-full border border-amber-400/20 bg-amber-500/12 px-2.5 py-1 font-mono text-[10px] tracking-wider text-amber-200 uppercase">
            #{index + 1}
          </div>
          <div className="mt-1 font-mono text-sm text-white">
            {route.count} flights
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onSelectAirport(route.departure)}
          className="cursor-pointer rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 font-mono text-[10px] tracking-wider text-cyan-200 uppercase transition-colors hover:bg-cyan-500/16"
        >
          Open {route.departure}
        </button>
        <button
          onClick={() => onSelectAirport(route.arrival)}
          className="cursor-pointer rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] tracking-wider text-white/70 uppercase transition-colors hover:bg-white/[0.08]"
        >
          Open {route.arrival}
        </button>
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  width,
  colorClass,
}: {
  label: string;
  value: number;
  width: string;
  colorClass: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] tracking-[0.14em] text-white/28 uppercase">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width }} />
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-2">
      <div className="font-mono text-[10px] tracking-[0.16em] text-white/28 uppercase">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm text-white">{value}</div>
    </div>
  );
}
