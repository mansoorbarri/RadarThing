"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { CheckCircle2, Clock3, Flag, Loader2 } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { ChallengeLeaderboardTab } from "~/components/challenges/ChallengeLeaderboardTab";

function formatWindow(startAt: number, endAt: number) {
  return `${new Date(startAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} - ${new Date(endAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

function getRuleSummary(challenge: {
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
  rules?: {
    ruleType: string;
    targetAirport: string | null;
    targetDepartureAirport: string | null;
    targetArrivalAirport: string | null;
    targetAircraftType: string | null;
    requiredAirportCount: number | null;
    requiredFlightCount: number | null;
    minDurationMinutes: number | null;
    minDistanceNm: number | null;
  }[];
}) {
  if (challenge.mode === "manual") return "Manual review required";

  const rules =
    challenge.rules && challenge.rules.length > 0
      ? challenge.rules
      : [challenge];

  return rules.map((rule) => getSingleRuleSummary(rule)).join(" + ");
}

function getSingleRuleSummary(rule: {
  ruleType: string;
  targetAirport: string | null;
  targetDepartureAirport: string | null;
  targetArrivalAirport: string | null;
  targetAircraftType: string | null;
  requiredAirportCount: number | null;
  requiredFlightCount: number | null;
  minDurationMinutes: number | null;
  minDistanceNm: number | null;
}) {
  switch (rule.ruleType) {
    case "visit_airport":
      return `Visit ${rule.targetAirport}`;
    case "visit_airport_count":
      return `Visit ${rule.requiredAirportCount} unique airports`;
    case "depart_airport":
      return `Depart ${rule.targetAirport}`;
    case "arrive_airport":
      return `Arrive at ${rule.targetAirport}`;
    case "route":
      return `Fly ${rule.targetDepartureAirport} to ${rule.targetArrivalAirport}`;
    case "aircraft_type":
      return `Use ${rule.targetAircraftType}`;
    case "flight_count":
      return `Complete ${rule.requiredFlightCount} flights`;
    case "min_duration":
      return `Fly at least ${rule.minDurationMinutes} minutes`;
    case "min_distance":
      return `Fly at least ${rule.minDistanceNm} nm`;
    default:
      return "Automatic challenge";
  }
}

export function PilotChallengesPanel({ userId }: { userId: Id<"users"> }) {
  const challenges = useQuery(api.challenges.listActiveForUser, { userId });
  const leaderboard = useQuery(api.challenges.listActiveLeaderboard, {});
  const [activeTab, setActiveTab] = useState<"challenges" | "leaderboard">(
    "challenges",
  );

  if (challenges === undefined) {
    return (
      <div className="mb-8 rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading challenge progress...
        </div>
      </div>
    );
  }

  if (challenges.length === 0) return null;

  return (
    <div className="mb-8 rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-cyan-400" />
          <h3 className="font-mono text-sm font-bold tracking-wider text-slate-400">
            ACTIVE CHALLENGES
          </h3>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="grid w-full grid-cols-2 rounded-xl border border-white/10 bg-white/5 p-1 sm:flex sm:w-auto">
            <button
              onClick={() => setActiveTab("challenges")}
              className={`cursor-pointer rounded-lg px-3 py-2 font-mono text-[10px] tracking-wider uppercase transition-colors sm:px-3 sm:py-1.5 ${
                activeTab === "challenges"
                  ? "bg-white/10 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Challenges
            </button>
            <button
              onClick={() => setActiveTab("leaderboard")}
              className={`cursor-pointer rounded-lg px-3 py-2 font-mono text-[10px] tracking-wider uppercase transition-colors sm:px-3 sm:py-1.5 ${
                activeTab === "leaderboard"
                  ? "bg-white/10 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Leaderboard
            </button>
          </div>
        </div>
      </div>

      {activeTab === "leaderboard" ? (
        <ChallengeLeaderboardTab
          challenges={leaderboard}
          highlightedUserId={userId}
          isLoading={leaderboard === undefined}
          maxEntries={10}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {challenges.map((challenge) => {
            const isComplete = challenge.userStatus === "completed";
            const progressTarget = Math.max(1, challenge.progressTarget);
            const progressPercent = Math.min(
              100,
              Math.round((challenge.progressCurrent / progressTarget) * 100),
            );

            return (
              <div
                key={challenge.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"
              >
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] tracking-wider text-slate-400 uppercase">
                        {challenge.cadence}
                      </span>
                      {isComplete ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] tracking-wider text-emerald-300 uppercase">
                          completed
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-[10px] tracking-wider text-slate-400 uppercase">
                          in progress
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg leading-tight font-semibold text-white">
                      {challenge.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>
                      {formatWindow(challenge.startAt, challenge.endAt)}
                    </span>
                  </div>
                </div>

                <p className="mb-3 text-sm text-slate-300">
                  {challenge.description}
                </p>
                <p className="mb-4 font-mono text-xs text-cyan-300">
                  {getRuleSummary(challenge)}
                </p>

                <div className="space-y-2">
                  <div className="flex items-center text-xs sm:hidden">
                    <span
                      className={
                        isComplete ? "text-emerald-300" : "text-slate-400"
                      }
                    >
                      {isComplete ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Complete
                        </span>
                      ) : (
                        "In progress"
                      )}
                    </span>
                  </div>
                  <div className="hidden items-center justify-between text-xs sm:flex">
                    <span
                      className={
                        isComplete ? "text-emerald-300" : "text-slate-400"
                      }
                    >
                      {isComplete ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Complete
                        </span>
                      ) : (
                        challenge.progressLabel
                      )}
                    </span>
                    <span className="font-mono text-slate-500">
                      {progressPercent}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${
                        isComplete ? "bg-emerald-400" : "bg-cyan-400"
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
