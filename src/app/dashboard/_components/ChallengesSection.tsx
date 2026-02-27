"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Trophy, Clock, Target, Medal, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Analytics } from "~/lib/analytics";

function formatTimeRemaining(endDate: number): string {
  const diff = endDate - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m left`;
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatDistance(nm: number): string {
  return `${Math.round(nm).toLocaleString()} nm`;
}

interface ChallengeProgressData {
  challenge: {
    _id: Id<"challenges">;
    title: string;
    description: string;
    type: "weekly" | "monthly";
    startDate: number;
    endDate: number;
    criteria: {
      minFlights?: number;
      regions?: string[];
      uniqueAirports?: number;
      specificAirports?: string[];
      minAvgDurationMs?: number;
      minTotalDurationMs?: number;
      minSingleDurationMs?: number;
      minTotalDistanceNm?: number;
      minSingleDistanceNm?: number;
      aircraftTypes?: string[];
      minMaxAltitude?: number;
    };
    isActive: boolean;
    firstCompletedBy?: Id<"users">;
    firstCompletedAt?: number;
  };
  progress: {
    qualifyingFlightCount: number;
    uniqueAirportsVisited: string[];
    totalDurationMs: number;
    totalDistanceNm: number;
    isCompleted: boolean;
  } | null;
  topCompleters: {
    userId: Id<"users">;
    callsign: string;
    completedAt?: number;
  }[];
}

function ProgressBar({
  current,
  target,
  label,
  format,
}: {
  current: number;
  target: number;
  label: string;
  format?: (v: number) => string;
}) {
  const pct = Math.min(100, target > 0 ? (current / target) * 100 : 0);
  const fmt = format ?? ((v: number) => v.toString());

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="font-mono text-xs text-slate-300">
          {fmt(current)} / {fmt(target)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function formatCompletionDate(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

const PLACE_COLORS = [
  "text-amber-400", // 1st - gold
  "text-slate-300", // 2nd - silver
  "text-amber-600", // 3rd - bronze
];

const PLACE_LABELS = ["1st", "2nd", "3rd"];

function ChallengeCard({ data }: { data: ChallengeProgressData }) {
  const { challenge, progress, topCompleters } = data;
  const isCompleted = progress?.isCompleted ?? false;
  const criteria = challenge.criteria;

  // Calculate overall completion percentage
  const progressParts: number[] = [];
  if (criteria.minFlights) {
    progressParts.push(
      Math.min(1, (progress?.qualifyingFlightCount ?? 0) / criteria.minFlights),
    );
  }
  if (criteria.uniqueAirports) {
    progressParts.push(
      Math.min(
        1,
        (progress?.uniqueAirportsVisited?.length ?? 0) /
          criteria.uniqueAirports,
      ),
    );
  }
  if (criteria.specificAirports && criteria.specificAirports.length > 0) {
    const visited = new Set(progress?.uniqueAirportsVisited ?? []);
    const matched = criteria.specificAirports.filter((a) => visited.has(a))
      .length;
    progressParts.push(matched / criteria.specificAirports.length);
  }
  if (criteria.minTotalDurationMs) {
    progressParts.push(
      Math.min(
        1,
        (progress?.totalDurationMs ?? 0) / criteria.minTotalDurationMs,
      ),
    );
  }
  if (criteria.minTotalDistanceNm) {
    progressParts.push(
      Math.min(
        1,
        (progress?.totalDistanceNm ?? 0) / criteria.minTotalDistanceNm,
      ),
    );
  }

  const overallPct =
    progressParts.length > 0
      ? Math.round(
          (progressParts.reduce((a, b) => a + b, 0) / progressParts.length) *
            100,
        )
      : 0;

  return (
    <div
      className={`rounded-2xl border p-5 backdrop-blur-xl transition-all ${
        isCompleted
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-white/10 bg-black/40"
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
              challenge.type === "weekly"
                ? "bg-cyan-500/20 text-cyan-400"
                : "bg-purple-500/20 text-purple-400"
            }`}
          >
            {challenge.type}
          </span>
          {isCompleted && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
              <Target className="h-3 w-3" />
              COMPLETED
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
          <Clock className="h-3 w-3" />
          {formatTimeRemaining(challenge.endDate)}
        </span>
      </div>

      {/* Title & Description */}
      <h4 className="mb-1 text-sm font-bold text-white">{challenge.title}</h4>
      <p className="mb-4 text-xs text-slate-400">{challenge.description}</p>

      {/* Progress Bars */}
      <div className="mb-4 space-y-2.5">
        {criteria.minFlights && (
          <ProgressBar
            current={progress?.qualifyingFlightCount ?? 0}
            target={criteria.minFlights}
            label="Flights"
            format={(v) => `${v} flights`}
          />
        )}
        {criteria.uniqueAirports && (
          <ProgressBar
            current={progress?.uniqueAirportsVisited?.length ?? 0}
            target={criteria.uniqueAirports}
            label="Unique Airports"
            format={(v) => `${v} airports`}
          />
        )}
        {criteria.specificAirports && criteria.specificAirports.length > 0 && (
          <ProgressBar
            current={
              criteria.specificAirports.filter((a) =>
                (progress?.uniqueAirportsVisited ?? []).includes(a),
              ).length
            }
            target={criteria.specificAirports.length}
            label="Specific Airports"
            format={(v) => `${v} airports`}
          />
        )}
        {criteria.minTotalDurationMs && (
          <ProgressBar
            current={progress?.totalDurationMs ?? 0}
            target={criteria.minTotalDurationMs}
            label="Total Flight Time"
            format={formatDuration}
          />
        )}
        {criteria.minTotalDistanceNm && (
          <ProgressBar
            current={progress?.totalDistanceNm ?? 0}
            target={criteria.minTotalDistanceNm}
            label="Total Distance"
            format={formatDistance}
          />
        )}
      </div>

      {/* Overall Progress */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs text-slate-500">Overall</span>
        <span
          className={`font-mono text-sm font-bold ${isCompleted ? "text-emerald-400" : "text-white"}`}
        >
          {isCompleted ? "100%" : `${overallPct}%`}
        </span>
      </div>
      <div className="mb-4 h-2 w-full rounded-full bg-white/10">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${
            isCompleted
              ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
              : "bg-gradient-to-r from-cyan-500 to-blue-500"
          }`}
          style={{ width: `${isCompleted ? 100 : overallPct}%` }}
        />
      </div>

      {/* Top Completers */}
      <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
        {topCompleters.length > 0 ? (
          <div className="space-y-1.5">
            {topCompleters.map((completer, i) => (
              <div
                key={completer.userId}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  {i === 0 ? (
                    <Trophy className={`h-3.5 w-3.5 ${PLACE_COLORS[i]}`} />
                  ) : (
                    <Medal className={`h-3.5 w-3.5 ${PLACE_COLORS[i]}`} />
                  )}
                  <span
                    className={`font-mono text-xs font-bold ${PLACE_COLORS[i]}`}
                  >
                    {PLACE_LABELS[i]}
                  </span>
                  <span className="font-mono text-xs text-slate-300">
                    {completer.callsign}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-600">
                  {formatCompletionDate(completer.completedAt)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-slate-600" />
            <span className="font-mono text-xs text-slate-500">
              Be the first to complete!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChallengesSection({
  userId,
  collapsible = false,
  defaultCollapsed = false,
}: {
  userId: Id<"users">;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const challengeProgress = useQuery(api.challenges.getProgressForUser, {
    userId,
  });

  const hasTracked = useRef(false);
  useEffect(() => {
    if (challengeProgress && challengeProgress.length > 0 && !hasTracked.current) {
      hasTracked.current = true;
      Analytics.track("challenge_viewed", {
        challengeCount: challengeProgress.length,
      });
    }
  }, [challengeProgress]);

  if (!challengeProgress || challengeProgress.length === 0) return null;

  return (
    <div className="mb-8">
      {collapsible ? (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mb-4 flex w-full cursor-pointer items-center gap-2 font-mono text-sm font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-300"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
          ACTIVE CHALLENGES
        </button>
      ) : (
        <h3 className="mb-4 font-mono text-sm font-bold uppercase tracking-wider text-slate-400">
          ACTIVE CHALLENGES
        </h3>
      )}
      {!collapsed && (
        <div className="grid gap-4 sm:grid-cols-2">
          {challengeProgress.map((data) => (
            <ChallengeCard key={data.challenge._id} data={data} />
          ))}
        </div>
      )}
    </div>
  );
}
