"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import {
  Calendar,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gauge,
  X,
  Lock,
  Loader2,
  Mountain,
  Plane,
  Play,
  Search,
  Send,
  Share2,
  Trash2,
  Route,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import {
  FLIGHT_HISTORY_PAGE_SIZE,
  FREE_RECENT_FLIGHTS_LIMIT,
  matchesFlightHistorySearch,
} from "~/lib/flightHistory";
import { Analytics } from "~/lib/analytics";
import { cn } from "~/lib/utils";

export interface FlightHistoryPanelFlight {
  id: Id<"flights">;
  callsign: string;
  aircraftType: string;
  depICAO?: string;
  arrICAO?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
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
  canSubmitChallengeFlights?: boolean;
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

function formatDuration(start: number, end?: number, duration?: number) {
  if (!end && duration === undefined) return "In Progress";
  const ms =
    typeof duration === "number" && Number.isFinite(duration)
      ? duration
      : end !== undefined
        ? end - start
        : 0;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatTopSpeed(speed?: number) {
  if (typeof speed !== "number" || !Number.isFinite(speed)) return null;
  return `${Math.round(speed).toLocaleString()} kt`;
}

function formatMaxAltitude(altitude?: number) {
  if (typeof altitude !== "number" || !Number.isFinite(altitude)) return null;
  return altitude >= 18000
    ? `FL${Math.round(altitude / 100)}`
    : `${Math.round(altitude).toLocaleString()} ft`;
}

function FlightMetadataRow({ flight }: { flight: FlightHistoryPanelFlight }) {
  const topSpeed = formatTopSpeed(flight.maxSpeed);
  const maxAltitude = formatMaxAltitude(flight.maxAltitude);

  return (
    <div className="flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <span className="flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        {formatDate(flight.startTime)}
      </span>
      <span className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {formatDuration(flight.startTime, flight.endTime, flight.duration)}
      </span>
      {topSpeed && (
        <span className="flex items-center gap-1">
          <Gauge className="h-3 w-3" />
          {topSpeed}
        </span>
      )}
      {maxAltitude && (
        <span className="flex items-center gap-1">
          <Mountain className="h-3 w-3" />
          {maxAltitude}
        </span>
      )}
    </div>
  );
}

export function FlightHistoryPanel({
  userId,
  variant = "static",
  expanded = true,
  onExpandedChange,
  canGenerateFlightCard,
  canSubmitChallengeFlights = false,
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
  const [selectedChallengeFlightIds, setSelectedChallengeFlightIds] = useState<
    string[]
  >([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>("");
  const [challengeSubmissionNote, setChallengeSubmissionNote] = useState("");
  const [isSubmittingChallengeFlights, setIsSubmittingChallengeFlights] =
    useState(false);

  useEffect(() => {
    setPage(1);
  }, [deferredSearchQuery, userId]);

  const historyPage = useQuery(api.flights.getFlightHistoryPage, {
    userId,
  });
  const viewerChallenges = useQuery(
    api.challenges.listActiveForViewer,
    canSubmitChallengeFlights ? {} : "skip",
  );
  const submitManualClaim = useMutation(api.challenges.submitManualClaim);

  const isExpanded = variant === "static" ? true : expanded;
  const hasSearchQuery = searchQuery.trim().length > 0;
  const filteredFlights = useMemo(() => {
    const flights = historyPage?.flights ?? [];
    if (!deferredSearchQuery.trim()) return flights;
    return flights.filter((flight) =>
      matchesFlightHistorySearch(flight, deferredSearchQuery),
    );
  }, [deferredSearchQuery, historyPage?.flights]);
  const totalMatchingFlights = filteredFlights.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalMatchingFlights / FLIGHT_HISTORY_PAGE_SIZE),
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const startIndex = (page - 1) * FLIGHT_HISTORY_PAGE_SIZE;
  const paginatedFlights = filteredFlights.slice(
    startIndex,
    startIndex + FLIGHT_HISTORY_PAGE_SIZE,
  );
  const pageStart = totalMatchingFlights === 0 ? 0 : startIndex + 1;
  const pageEnd =
    totalMatchingFlights === 0 ? 0 : startIndex + paginatedFlights.length;
  const canAccessFullHistory = historyPage?.canAccessFullHistory ?? false;
  const totalRecordedFlights = historyPage?.totalRecordedFlights ?? 0;
  const hiddenFlightCount = historyPage?.hiddenFlightCount ?? 0;
  const flightsById = useMemo(
    () =>
      new Map(
        (historyPage?.flights ?? []).map((flight) => [flight.id, flight]),
      ),
    [historyPage?.flights],
  );
  const availableManualChallenges =
    viewerChallenges?.filter((challenge) =>
      challenge.mode === "manual" && "canSubmitManual" in challenge
        ? challenge.canSubmitManual
        : false,
    ) ?? [];
  const selectedChallengeFlights = selectedChallengeFlightIds
    .map((flightId) => flightsById.get(flightId as Id<"flights">))
    .filter((flight): flight is NonNullable<typeof flight> => Boolean(flight));

  function toggleFlightChallengeSelection(flight: FlightHistoryPanelFlight) {
    if (availableManualChallenges.length === 0) {
      toast.error("No active manual challenges are accepting submissions");
      return;
    }

    setSelectedChallengeFlightIds((current) =>
      current.includes(flight.id)
        ? current.filter((flightId) => flightId !== flight.id)
        : [...current, flight.id],
    );
    setSelectedChallengeId(
      (current) => current || availableManualChallenges[0]?.id || "",
    );
  }

  async function handleSubmitChallengeReview() {
    if (selectedChallengeFlightIds.length === 0) {
      toast.error("Select at least one flight first");
      return;
    }

    if (!selectedChallengeId) {
      toast.error("Choose a challenge first");
      return;
    }

    const submissionNote = challengeSubmissionNote.trim() || undefined;
    setIsSubmittingChallengeFlights(true);

    try {
      await submitManualClaim({
        challengeId: selectedChallengeId as Id<"challenges">,
        flightIds: selectedChallengeFlightIds as Id<"flights">[],
        submissionNote,
      });
      Analytics.track("challenge_claim_submitted", {
        challenge_id: selectedChallengeId,
        flight_count: selectedChallengeFlightIds.length,
        has_note: Boolean(submissionNote),
        source: "flight_history",
      });
      toast.success(
        `${selectedChallengeFlightIds.length} flight${selectedChallengeFlightIds.length === 1 ? "" : "s"} submitted for challenge review`,
      );
      setSelectedChallengeFlightIds([]);
      setSelectedChallengeId("");
      setChallengeSubmissionNote("");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not submit flights for review",
      );
    } finally {
      setIsSubmittingChallengeFlights(false);
    }
  }

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
        <div className="flex flex-col gap-2 border-b border-white/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <h3 className="font-mono text-sm font-bold tracking-wider text-slate-400">
            RECENT FLIGHTS
          </h3>
          <span className="font-mono text-xs text-slate-600">
            {FLIGHT_HISTORY_PAGE_SIZE} per page
          </span>
        </div>
      )}

      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          variant === "static"
            ? "grid-rows-[1fr] opacity-100"
            : isExpanded
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "space-y-4 px-4 pb-4 transition-transform duration-300 ease-out sm:px-6 sm:pb-6",
              variant === "static" || isExpanded
                ? "translate-y-0"
                : "-translate-y-2",
            )}
          >
            <div className="pt-1">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search anything: route, callsign, aircraft, date, time..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pr-12 pl-10 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
                />
                {hasSearchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute top-1/2 right-3 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-slate-500 transition hover:bg-white/10 hover:text-white"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {historyPage === undefined ? (
              <HistoryLoadingState />
            ) : (
              <>
                <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-300">
                      {totalMatchingFlights === 0
                        ? "No matching flights"
                        : `Showing ${pageStart}-${pageEnd} of ${totalMatchingFlights} matching flights`}
                    </p>
                    <p className="mt-1 font-mono text-[11px] tracking-wide text-slate-500 uppercase">
                      {canAccessFullHistory
                        ? `${totalRecordedFlights} total recorded flights`
                        : `Free includes the latest ${FREE_RECENT_FLIGHTS_LIMIT} flights`}
                    </p>
                  </div>
                  {totalPages > 1 && (
                    <div className="inline-flex w-full items-center justify-between gap-2 rounded-full border border-white/10 bg-black/30 px-2 py-1 sm:w-auto sm:justify-start">
                      <button
                        onClick={() =>
                          setPage((current) => Math.max(1, current - 1))
                        }
                        disabled={page <= 1}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="min-w-0 flex-1 text-center font-mono text-xs text-slate-300 sm:min-w-24 sm:flex-none">
                        Page {page} / {totalPages}
                      </span>
                      <button
                        onClick={() =>
                          setPage((current) =>
                            Math.min(totalPages, current + 1),
                          )
                        }
                        disabled={page >= totalPages}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {canSubmitChallengeFlights &&
                  availableManualChallenges.length > 0 &&
                  selectedChallengeFlightIds.length > 0 && (
                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="flex items-center gap-2 font-mono text-xs tracking-wide text-cyan-200 uppercase">
                            <Flag className="h-3.5 w-3.5" />
                            Challenge Submission
                          </p>
                          <p className="mt-1 text-sm text-cyan-100">
                            {selectedChallengeFlightIds.length} flight
                            {selectedChallengeFlightIds.length === 1
                              ? ""
                              : "s"}{" "}
                            selected for admin review.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedChallengeFlightIds([]);
                            setChallengeSubmissionNote("");
                          }}
                          disabled={isSubmittingChallengeFlights}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-60"
                        >
                          Clear selection
                        </button>
                      </div>

                      <div className="mb-3 flex flex-wrap gap-2">
                        {selectedChallengeFlights.map((flight) => (
                          <span
                            key={flight.id}
                            className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-mono text-[10px] tracking-wider text-cyan-100"
                          >
                            {(flight.depICAO ?? "???") +
                              "-" +
                              (flight.arrICAO ?? "???")}{" "}
                            {flight.callsign ? `• ${flight.callsign}` : ""}
                          </span>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <label className="block">
                          <span className="mb-2 block font-mono text-[10px] tracking-wider text-cyan-200 uppercase">
                            Challenge
                          </span>
                          <select
                            value={selectedChallengeId}
                            onChange={(event) =>
                              setSelectedChallengeId(event.target.value)
                            }
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
                          >
                            {availableManualChallenges.map((challenge) => (
                              <option key={challenge.id} value={challenge.id}>
                                {challenge.title}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-2 block font-mono text-[10px] tracking-wider text-cyan-200 uppercase">
                            Note for admins
                          </span>
                          <textarea
                            value={challengeSubmissionNote}
                            onChange={(event) =>
                              setChallengeSubmissionNote(event.target.value)
                            }
                            rows={3}
                            placeholder="Explain how these flights satisfy the challenge."
                            className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-500/50"
                          />
                        </label>

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            onClick={() => void handleSubmitChallengeReview()}
                            disabled={isSubmittingChallengeFlights}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSubmittingChallengeFlights ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            Submit selected flights
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                {paginatedFlights.length === 0 ? (
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
                    {paginatedFlights.map((flight) => (
                      <div
                        key={flight.id}
                        className="group rounded-xl border border-white/5 bg-white/5 p-4 transition-all hover:border-cyan-500/30 hover:bg-white/10"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <div className="flex items-start gap-3 sm:items-center">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
                              <Plane className="h-5 w-5 text-cyan-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="font-mono text-sm font-bold text-white">
                                  {flight.depICAO || "???"}
                                </span>
                                <Route className="h-3 w-3 text-slate-500" />
                                <span className="font-mono text-sm font-bold text-white">
                                  {flight.arrICAO || "???"}
                                </span>
                              </div>
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                                  {flight.aircraftType
                                    .replace(/\s*\([^)]*\)/g, "")
                                    .trim()}
                                </span>
                                {flight.callsign && (
                                  <span className="rounded bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-300/80">
                                    {flight.callsign}
                                  </span>
                                )}
                              </div>
                              <FlightMetadataRow flight={flight} />
                            </div>
                          </div>

                          <div className="hidden flex-wrap items-center gap-2 sm:ml-auto sm:flex sm:justify-end">
                            {canSubmitChallengeFlights &&
                              availableManualChallenges.length > 0 && (
                                <button
                                  onClick={() =>
                                    toggleFlightChallengeSelection(flight)
                                  }
                                  className={`flex h-9 items-center justify-center gap-1 rounded-lg border px-2.5 transition-all sm:h-8 sm:opacity-0 sm:group-hover:opacity-100 ${
                                    selectedChallengeFlightIds.includes(
                                      flight.id,
                                    )
                                      ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-200"
                                      : "border-white/10 bg-white/5 text-white/60 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-400 sm:text-white/40"
                                  }`}
                                  title={
                                    selectedChallengeFlightIds.includes(
                                      flight.id,
                                    )
                                      ? "Remove this flight from the challenge submission"
                                      : "Add this flight to a challenge submission"
                                  }
                                >
                                  <Flag className="h-3.5 w-3.5" />
                                  <span className="font-mono text-[10px] tracking-wider uppercase">
                                    {selectedChallengeFlightIds.includes(
                                      flight.id,
                                    )
                                      ? "Selected"
                                      : "Challenge"}
                                  </span>
                                </button>
                              )}
                            {flight.routeData &&
                              flight.routeData.length > 1 && (
                                <>
                                  <button
                                    onClick={() => onShareFlight(flight)}
                                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition-all hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400 sm:h-8 sm:w-8 sm:text-white/40 sm:opacity-0 sm:group-hover:opacity-100"
                                    title="Copy share link"
                                  >
                                    <Share2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => onGenerateFlightCard(flight)}
                                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition-all hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-400 sm:h-8 sm:w-8 sm:text-white/40 sm:opacity-0 sm:group-hover:opacity-100"
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
                                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 transition-all hover:bg-amber-500/20 sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100"
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
                                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:hover:bg-red-500/10 sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100"
                                title={
                                  deletingFlightId === flight.id
                                    ? "Deleting flight..."
                                    : "Delete this flight"
                                }
                                aria-label={
                                  deletingFlightId === flight.id
                                    ? "Deleting flight"
                                    : "Delete this flight"
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 sm:hidden">
                          {canSubmitChallengeFlights &&
                            availableManualChallenges.length > 0 && (
                              <button
                                onClick={() =>
                                  toggleFlightChallengeSelection(flight)
                                }
                                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 font-mono text-[10px] tracking-wider uppercase transition-colors ${
                                  selectedChallengeFlightIds.includes(flight.id)
                                    ? "border-cyan-400/40 bg-cyan-500/20 text-cyan-100"
                                    : "border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                                }`}
                                title={
                                  selectedChallengeFlightIds.includes(flight.id)
                                    ? "Remove this flight from the challenge submission"
                                    : "Add this flight to a challenge submission"
                                }
                              >
                                <Flag className="h-3.5 w-3.5" />
                                {selectedChallengeFlightIds.includes(flight.id)
                                  ? "Selected"
                                  : "Challenge"}
                              </button>
                            )}
                          {flight.routeData && flight.routeData.length > 1 && (
                            <>
                              <button
                                onClick={() => onReplayFlight(flight)}
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-mono text-[10px] tracking-wider text-amber-300 uppercase transition-colors hover:bg-amber-500/20"
                                title="Replay this flight"
                              >
                                <Play className="h-3.5 w-3.5" />
                                Replay
                              </button>
                              <button
                                onClick={() => onShareFlight(flight)}
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-[10px] tracking-wider text-white/70 uppercase transition-colors hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-300"
                                title="Copy share link"
                              >
                                <Share2 className="h-3.5 w-3.5" />
                                Share
                              </button>
                              <button
                                onClick={() => onGenerateFlightCard(flight)}
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-[10px] tracking-wider text-white/70 uppercase transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300"
                                title={
                                  canGenerateFlightCard
                                    ? "Generate flight card"
                                    : "Unlock PRO to generate a flight card"
                                }
                              >
                                <Camera className="h-3.5 w-3.5" />
                                Card
                              </button>
                            </>
                          )}
                          {canDeleteFlights && onDeleteFlight && (
                            <button
                              onClick={() => onDeleteFlight(flight)}
                              disabled={deletingFlightId === flight.id}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-[10px] tracking-wider text-red-300 uppercase transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:hover:bg-red-500/10"
                              title={
                                deletingFlightId === flight.id
                                  ? "Deleting flight..."
                                  : "Delete this flight"
                              }
                              aria-label={
                                deletingFlightId === flight.id
                                  ? "Deleting flight"
                                  : "Delete this flight"
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!canAccessFullHistory && hiddenFlightCount > 0 && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="flex items-center gap-2 font-mono text-xs tracking-wide text-amber-300 uppercase">
                          <Lock className="h-3.5 w-3.5" />
                          Free history cap
                        </p>
                        <p className="mt-2 text-sm text-amber-100/85">
                          {hasSearchQuery
                            ? `Search covers the latest ${FREE_RECENT_FLIGHTS_LIMIT} flights on Free. Upgrade to search all ${totalRecordedFlights} recorded flights.`
                            : `Upgrade to browse ${hiddenFlightCount} more flights beyond the latest ${FREE_RECENT_FLIGHTS_LIMIT}.`}
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
        </div>
      </div>
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
