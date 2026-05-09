"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import {
  Calendar,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  Plane,
  Play,
  Search,
  Share2,
  Trash2,
  Route,
} from "lucide-react";
import {
  FLIGHT_HISTORY_PAGE_SIZE,
  FREE_RECENT_FLIGHTS_LIMIT,
} from "~/lib/flightHistory";

export interface FlightHistoryPanelFlight {
  id: Id<"flights">;
  callsign: string;
  aircraftType: string;
  depICAO?: string;
  arrICAO?: string;
  startTime: number;
  endTime?: number;
  maxAltitude?: number;
  maxSpeed?: number;
  routeData?: [number, number][];
}

interface FlightHistoryPanelProps {
  userId: Id<"users">;
  variant?: "collapsible" | "static";
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  canGenerateFlightCard: boolean;
  canDeleteFlights?: boolean;
  deletingFlightId?: string | null;
  onShareFlight: (flight: FlightHistoryPanelFlight) => void;
  onGenerateFlightCard: (flight: FlightHistoryPanelFlight) => void;
  onReplayFlight: (flight: FlightHistoryPanelFlight) => void;
  onDeleteFlight?: (flight: FlightHistoryPanelFlight) => void;
  onUpgrade?: () => void;
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(start: number, end?: number) {
  if (!end) return "In Progress";
  const ms = end - start;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function FlightHistoryPanel({
  userId,
  variant = "static",
  expanded = true,
  onExpandedChange,
  canGenerateFlightCard,
  canDeleteFlights = false,
  deletingFlightId,
  onShareFlight,
  onGenerateFlightCard,
  onReplayFlight,
  onDeleteFlight,
  onUpgrade,
}: FlightHistoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [deferredSearchQuery, userId]);

  const historyPage = useQuery(api.flights.getFlightHistoryPage, {
    userId,
    page,
    searchQuery: deferredSearchQuery,
  });

  useEffect(() => {
    if (!historyPage) return;
    if (page > historyPage.totalPages) {
      setPage(historyPage.totalPages);
    }
  }, [historyPage, page]);

  const isExpanded = variant === "static" ? true : expanded;
  const hasSearchQuery = searchQuery.trim().length > 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl">
      {variant === "collapsible" ? (
        <button
          onClick={() => onExpandedChange?.(!expanded)}
          className="flex w-full cursor-pointer items-center justify-between p-6"
        >
          <h3 className="font-mono text-sm font-bold tracking-wider text-slate-400">
            RECENT FLIGHTS
          </h3>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-slate-600">
              {FLIGHT_HISTORY_PAGE_SIZE} per page
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          </div>
        </button>
      ) : (
        <div className="flex items-center justify-between border-b border-white/5 p-6">
          <h3 className="font-mono text-sm font-bold tracking-wider text-slate-400">
            RECENT FLIGHTS
          </h3>
          <span className="font-mono text-xs text-slate-600">
            {FLIGHT_HISTORY_PAGE_SIZE} per page
          </span>
        </div>
      )}

      {isExpanded && (
        <div className="space-y-4 px-6 pb-6">
          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search anything: route, callsign, aircraft, date, time..."
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pr-4 pl-10 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>

            <button
              onClick={() => {
                setSearchQuery("");
              }}
              disabled={!hasSearchQuery}
              className="rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-slate-300 transition-all hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
          </div>

          {historyPage === undefined ? (
            <HistoryLoadingState />
          ) : (
            <>
              <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-300">
                    {historyPage.totalMatchingFlights === 0
                      ? "No matching flights"
                      : `Showing ${historyPage.pageStart}-${historyPage.pageEnd} of ${historyPage.totalMatchingFlights} matching flights`}
                  </p>
                  <p className="mt-1 font-mono text-[11px] tracking-wide text-slate-500 uppercase">
                    {historyPage.canAccessFullHistory
                      ? `${historyPage.totalRecordedFlights} total recorded flights`
                      : `Free includes the latest ${FREE_RECENT_FLIGHTS_LIMIT} flights`}
                  </p>
                </div>
                {historyPage.totalPages > 1 && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-2 py-1">
                    <button
                      onClick={() =>
                        setPage((current) => Math.max(1, current - 1))
                      }
                      disabled={!historyPage.hasPreviousPage}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="min-w-24 text-center font-mono text-xs text-slate-300">
                      Page {historyPage.page} / {historyPage.totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setPage((current) =>
                          Math.min(historyPage.totalPages, current + 1),
                        )
                      }
                      disabled={!historyPage.hasNextPage}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {(historyPage.flights ?? []).length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-10 text-center">
                  <Search className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                  <h4 className="text-lg font-semibold text-white">
                    No matching flights
                  </h4>
                  <p className="mt-2 text-sm text-slate-400">
                    Adjust the search to broaden the history view.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(historyPage.flights ?? []).map((flight) => (
                    <div
                      key={flight.id}
                      className="group flex items-center gap-4 rounded-xl border border-white/5 bg-white/5 p-4 transition-all hover:border-cyan-500/30 hover:bg-white/10"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
                        <Plane className="h-5 w-5 text-cyan-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-white">
                            {flight.depICAO || "???"}
                          </span>
                          <Route className="h-3 w-3 text-slate-500" />
                          <span className="font-mono text-sm font-bold text-white">
                            {flight.arrICAO || "???"}
                          </span>
                          <span className="ml-2 rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                            {flight.aircraftType
                              .replace(/\s*\([^)]*\)/g, "")
                              .trim()}
                          </span>
                          <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-slate-500">
                            {flight.endTime ? "Completed" : "In Progress"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          {flight.callsign && (
                            <span className="rounded bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-300/80">
                              {flight.callsign}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(flight.startTime)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(flight.startTime, flight.endTime)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {flight.routeData && flight.routeData.length > 1 && (
                          <>
                            <button
                              onClick={() => onShareFlight(flight)}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/40 opacity-0 transition-all group-hover:opacity-100 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400"
                              title="Copy share link"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => onGenerateFlightCard(flight)}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/40 opacity-0 transition-all group-hover:opacity-100 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-400"
                              title={
                                canGenerateFlightCard
                                  ? "Generate flight card"
                                  : "Unlock PRO to generate a flight card"
                              }
                            >
                              <Camera className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => onReplayFlight(flight)}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-amber-500/20"
                              title="Replay this flight"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {canDeleteFlights && onDeleteFlight && (
                          <button
                            onClick={() => onDeleteFlight(flight)}
                            disabled={deletingFlightId === flight.id}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-100 disabled:hover:bg-red-500/10"
                            title={
                              deletingFlightId === flight.id
                                ? "Deleting flight..."
                                : "Delete this flight"
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!historyPage.canAccessFullHistory &&
                historyPage.hiddenFlightCount > 0 && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="flex items-center gap-2 font-mono text-xs tracking-wide text-amber-300 uppercase">
                          <Lock className="h-3.5 w-3.5" />
                          Free history cap
                        </p>
                        <p className="mt-2 text-sm text-amber-100/85">
                          {hasSearchQuery
                            ? `Search covers the latest ${FREE_RECENT_FLIGHTS_LIMIT} flights on Free. Upgrade to search all ${historyPage.totalRecordedFlights} recorded flights.`
                            : `Upgrade to browse ${historyPage.hiddenFlightCount} more flights beyond the latest ${FREE_RECENT_FLIGHTS_LIMIT}.`}
                        </p>
                      </div>
                      {onUpgrade && (
                        <button
                          onClick={onUpgrade}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 font-mono text-xs text-amber-300 transition hover:bg-amber-400/15"
                        >
                          Start 7-day trial
                        </button>
                      )}
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryLoadingState() {
  return (
    <div className="space-y-3 pt-1">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_180px_180px_auto]">
        <div className="h-11 animate-pulse rounded-xl bg-white/5" />
        <div className="h-11 animate-pulse rounded-xl bg-white/5" />
        <div className="h-11 animate-pulse rounded-xl bg-white/5" />
        <div className="h-11 animate-pulse rounded-xl bg-white/5" />
      </div>
      <div className="h-18 animate-pulse rounded-2xl bg-white/5" />
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-xl border border-white/5 bg-white/5"
        />
      ))}
    </div>
  );
}
