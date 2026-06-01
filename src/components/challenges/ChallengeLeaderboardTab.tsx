"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Clock3, Loader2, Trophy, UserRound } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";

interface ChallengeLeaderboardEntry {
  userId: Id<"users">;
  displayName: string;
  callsign: string | null;
  progressCurrent: number;
  progressTarget: number;
  progressLabel: string;
  isComplete: boolean;
  completedAt: number | null;
  status: "completed" | "in_progress" | "pending" | "rejected";
}

interface ChallengeLeaderboard {
  id: Id<"challenges">;
  title: string;
  description: string;
  cadence: "weekly" | "monthly" | "custom";
  mode: "auto" | "manual";
  ruleType: string;
  targetAirport: string | null;
  targetDepartureAirport: string | null;
  targetArrivalAirport: string | null;
  targetAircraftType: string | null;
  requiredAirportCount: number | null;
  requiredFlightCount: number | null;
  minDurationMinutes: number | null;
  minDistanceNm: number | null;
  startAt: number;
  endAt: number;
  entries: ChallengeLeaderboardEntry[];
}

function formatWindow(startAt: number, endAt: number) {
  return `${new Date(startAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} - ${new Date(endAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

function getRuleSummary(challenge: ChallengeLeaderboard) {
  if (challenge.mode === "manual") return "Manual review challenge";

  switch (challenge.ruleType) {
    case "visit_airport":
      return `Visit ${challenge.targetAirport}`;
    case "visit_airport_count":
      return `Visit ${challenge.requiredAirportCount} unique airports`;
    case "depart_airport":
      return `Depart ${challenge.targetAirport}`;
    case "arrive_airport":
      return `Arrive at ${challenge.targetAirport}`;
    case "route":
      return `Fly ${challenge.targetDepartureAirport} to ${challenge.targetArrivalAirport}`;
    case "aircraft_type":
      return `Use ${challenge.targetAircraftType}`;
    case "flight_count":
      return `Complete ${challenge.requiredFlightCount} flights`;
    case "min_duration":
      return `Fly at least ${challenge.minDurationMinutes} minutes`;
    case "min_distance":
      return `Fly at least ${challenge.minDistanceNm} nm`;
    default:
      return "Automatic challenge";
  }
}

function getRankTone(rank: number) {
  if (rank === 1) {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }
  if (rank === 2) {
    return "border-slate-400/30 bg-slate-400/10 text-slate-200";
  }
  if (rank === 3) {
    return "border-orange-500/30 bg-orange-500/10 text-orange-200";
  }
  return "border-white/10 bg-white/5 text-slate-400";
}

function getStatusTone(status: ChallengeLeaderboardEntry["status"]) {
  if (status === "completed") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  if (status === "pending") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-100";
  }
  if (status === "rejected") {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }
  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
}

function getStatusLabel(entry: ChallengeLeaderboardEntry) {
  if (entry.status === "completed") return "Completed";
  if (entry.status === "pending") return "Pending review";
  if (entry.status === "rejected") return "Needs resubmission";
  return entry.progressLabel;
}

export function ChallengeLeaderboardTab({
  challenges,
  highlightedUserId,
  isLoading,
  maxEntries,
}: {
  challenges: ChallengeLeaderboard[] | undefined;
  highlightedUserId?: Id<"users"> | null;
  isLoading?: boolean;
  maxEntries?: number;
}) {
  if (isLoading || challenges === undefined) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading challenge leaderboard...
      </div>
    );
  }

  const shouldDefaultCollapseEntries = challenges.length > 2;

  return (
    <div
      className={
        challenges.length > 1
          ? "flex flex-col gap-4 lg:flex-row lg:flex-wrap"
          : "space-y-4"
      }
    >
      {challenges.map((challenge) => {
        const visibleEntries =
          typeof maxEntries === "number"
            ? challenge.entries.slice(0, maxEntries)
            : challenge.entries;

        return (
          <ChallengeLeaderboardCard
            key={challenge.id}
            allowCollapsing={shouldDefaultCollapseEntries}
            challenge={challenge}
            highlightedUserId={highlightedUserId}
            initialEntriesOpen={!shouldDefaultCollapseEntries}
            visibleEntries={visibleEntries}
          />
        );
      })}
    </div>
  );
}

function ChallengeLeaderboardCard({
  allowCollapsing,
  challenge,
  highlightedUserId,
  initialEntriesOpen,
  visibleEntries,
}: {
  allowCollapsing: boolean;
  challenge: ChallengeLeaderboard;
  highlightedUserId?: Id<"users"> | null;
  initialEntriesOpen: boolean;
  visibleEntries: ChallengeLeaderboardEntry[];
}) {
  const [entriesOpen, setEntriesOpen] = useState(
    initialEntriesOpen || visibleEntries.length === 0,
  );

  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-5 lg:basis-[calc(50%-0.5rem)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] tracking-wider text-slate-400 uppercase">
              {challenge.cadence}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase ${
                challenge.mode === "auto"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              {challenge.mode === "auto" ? "auto" : "manual"}
            </span>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 font-mono text-[10px] tracking-wider text-cyan-200 uppercase">
              {visibleEntries.length} ranked
            </span>
          </div>
          <h4 className="text-lg font-semibold text-white">
            {challenge.title}
          </h4>
          <p className="mt-2 text-sm text-slate-300">
            {challenge.description}
          </p>
          <p className="mt-2 font-mono text-xs text-cyan-300">
            {getRuleSummary(challenge)}
          </p>
        </div>

        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Clock3 className="h-3.5 w-3.5" />
          <span>{formatWindow(challenge.startAt, challenge.endAt)}</span>
        </div>
      </div>

      <Collapsible open={entriesOpen} onOpenChange={setEntriesOpen}>
        {allowCollapsing && visibleEntries.length > 0 && (
          <CollapsibleTrigger className="mb-3 flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left font-mono text-[11px] tracking-wider text-slate-400 uppercase transition-colors hover:border-white/15 hover:bg-white/[0.06]">
            <span>{entriesOpen ? "Hide rankings" : "Show rankings"}</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                entriesOpen ? "rotate-180" : ""
              }`}
            />
          </CollapsibleTrigger>
        )}

        <CollapsibleContent>
          {visibleEntries.length > 0 ? (
            <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {visibleEntries.map((entry, index) => {
                const rank = index + 1;
                const progressPercent = Math.min(
                  100,
                  Math.round(
                    (entry.progressCurrent /
                      Math.max(1, entry.progressTarget)) *
                      100,
                  ),
                );
                const isHighlighted = highlightedUserId === entry.userId;

                return (
                  <Link
                    key={entry.userId}
                    href={`/pilot/${entry.userId}`}
                    className={`block rounded-2xl border px-4 py-3 transition-colors ${
                      isHighlighted
                        ? "border-cyan-500/35 bg-cyan-500/[0.08]"
                        : "border-white/10 bg-black/20 hover:border-white/15 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold ${getRankTone(rank)}`}
                      >
                        {rank}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-white">
                            {entry.displayName}
                          </span>
                        </div>
                        {entry.callsign &&
                          entry.callsign !== entry.displayName && (
                            <p className="mt-1 font-mono text-[11px] text-slate-500">
                              {entry.callsign}
                            </p>
                          )}

                        {challenge.mode === "auto" && (
                          <div className="mt-3">
                            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                              <span>{entry.progressLabel}</span>
                              <span className="font-mono">
                                {progressPercent}%
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                              <div
                                className={`h-full rounded-full ${
                                  entry.isComplete
                                    ? "bg-emerald-400"
                                    : "bg-cyan-400"
                                }`}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-right font-mono text-[10px] tracking-wider uppercase ${getStatusTone(entry.status)}`}
                      >
                        {getStatusLabel(entry)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-sm text-slate-500">
              <div className="mb-2 flex items-center gap-2 text-slate-400">
                {challenge.mode === "auto" ? (
                  <Trophy className="h-4 w-4 text-cyan-300" />
                ) : (
                  <UserRound className="h-4 w-4 text-amber-300" />
                )}
                <span>
                  {challenge.mode === "auto"
                    ? "No pilots have made progress yet."
                    : "No submissions have landed yet."}
                </span>
              </div>
              <p className="font-mono text-xs text-slate-600">
                {challenge.mode === "auto"
                  ? "Ranks appear as soon as flights start counting toward the challenge."
                  : "Manual challenges rank pilots once they submit work for review."}
              </p>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
