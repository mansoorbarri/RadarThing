"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Image from "next/image";
import { ArrowLeft, Plane, Navigation, Clock, Trophy, ChevronDown, Flame } from "lucide-react";

type SortKey = "flights" | "distance" | "time" | "streak";

function formatFlightTime(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const leaderboard = useQuery(api.flights.getLeaderboard);
  const [sortBy, setSortBy] = useState<SortKey>("flights");

  const currentUserRef = useRef<HTMLButtonElement>(null);

  const sorted = leaderboard
    ? [...leaderboard].sort((a, b) => {
        if (sortBy === "flights") return b.totalFlights - a.totalFlights;
        if (sortBy === "distance") return b.totalDistanceNm - a.totalDistanceNm;
        if (sortBy === "streak") return b.currentStreak - a.currentStreak;
        return b.totalFlightTimeMs - a.totalFlightTimeMs;
      })
    : null;

  const currentUserRank = sorted
    ? sorted.findIndex((p) => p.clerkId === user?.id) + 1
    : 0;
  const currentUserEntry = sorted?.find((p) => p.clerkId === user?.id) ?? null;

  const scrollToCurrentUser = () => {
    currentUserRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <button
            onClick={() => router.push("/radar")}
            className="cursor-pointer"
          >
            <Image src="/logo-white.svg" alt="RadarThing" width={100} height={30} />
          </button>
          <button
            onClick={() => router.push("/radar")}
            className="flex cursor-pointer items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Map
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* Title */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-500/50 bg-amber-500/10">
            <Trophy className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
            <p className="text-sm text-slate-500">Top pilots on RadarThing</p>
          </div>
        </div>

        {/* Your Position */}
        {currentUserEntry && currentUserRank > 0 && (
          <button
            onClick={scrollToCurrentUser}
            className="mb-6 flex w-full cursor-pointer items-center gap-4 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.06] p-4 text-left transition-all hover:bg-cyan-500/[0.1]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 font-mono text-sm font-bold text-cyan-400">
              {currentUserRank}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500 font-mono uppercase tracking-wider">Your Position</div>
              <div className="font-mono text-sm font-bold text-white truncate">
                {currentUserEntry.discordUsername ?? currentUserEntry.callsign}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-4 text-right">
              <div className="hidden sm:block">
                <div className="text-[10px] text-slate-600 font-mono uppercase">Flights</div>
                <div className="font-mono text-sm font-bold text-white">{currentUserEntry.totalFlights}</div>
              </div>
              <div className="hidden sm:block">
                <div className="text-[10px] text-slate-600 font-mono uppercase">Distance</div>
                <div className="font-mono text-sm font-bold text-white">{currentUserEntry.totalDistanceNm.toLocaleString()}</div>
              </div>
              <div className="hidden sm:block">
                <div className="text-[10px] text-slate-600 font-mono uppercase">Time</div>
                <div className="font-mono text-sm font-bold text-white">{formatFlightTime(currentUserEntry.totalFlightTimeMs)}</div>
              </div>
              <div className="hidden sm:block">
                <div className="text-[10px] text-slate-600 font-mono uppercase">Streak</div>
                <div className="font-mono text-sm font-bold text-amber-400">{currentUserEntry.currentStreak > 0 ? `${currentUserEntry.currentStreak}d` : "—"}</div>
              </div>
              <ChevronDown className="h-4 w-4 text-cyan-400/60" />
            </div>
          </button>
        )}

        {/* Sort Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1 w-fit">
          {([
            { key: "flights" as SortKey, label: "Flights", icon: Plane },
            { key: "distance" as SortKey, label: "Distance", icon: Navigation },
            { key: "time" as SortKey, label: "Flight Time", icon: Clock },
            { key: "streak" as SortKey, label: "Streak", icon: Flame },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                sortBy === key
                  ? "bg-white/10 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Leaderboard List */}
        {sorted === null ? (
          <LeaderboardSkeleton />
        ) : sorted.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
            <Plane className="mx-auto mb-4 h-12 w-12 text-slate-600" />
            <h3 className="mb-2 text-xl font-semibold text-white">No Pilots Yet</h3>
            <p className="text-slate-400">
              Be the first to record a flight and claim the top spot!
            </p>
          </div>
        ) : (
          <div>
            {/* Column Headers */}
            <div className="flex items-center gap-4 px-4 pb-3">
              <div className="w-9 shrink-0" />
              <div className="min-w-0 flex-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                Pilot
              </div>
              <div className="flex shrink-0 items-center gap-6">
                <div className="w-12 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Flights
                </div>
                <div className="hidden w-16 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-600 sm:block">
                  Distance
                </div>
                <div className="hidden w-14 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-600 sm:block">
                  Time
                </div>
                <div className="hidden w-12 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-600 sm:block">
                  Streak
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {sorted.map((pilot, i) => {
                const rank = i + 1;
                const isTop3 = rank <= 3;
                const isCurrentUser = user?.id === pilot.clerkId;
                const medalColor =
                  rank === 1
                    ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
                    : rank === 2
                      ? "text-slate-300 border-slate-400/40 bg-slate-400/10"
                      : rank === 3
                        ? "text-orange-400 border-orange-500/40 bg-orange-500/10"
                        : "";

                return (
                  <button
                    key={pilot.userId}
                    ref={isCurrentUser ? currentUserRef : undefined}
                    onClick={() => router.push(`/pilot/${pilot.userId}`)}
                    className={`flex w-full cursor-pointer items-center gap-4 rounded-xl border p-4 text-left transition-all hover:border-cyan-500/30 hover:bg-white/10 ${
                      isCurrentUser
                        ? "border-cyan-500/40 bg-cyan-500/[0.08] ring-1 ring-cyan-500/20"
                        : isTop3
                          ? "border-white/10 bg-white/[0.04]"
                          : "border-white/5 bg-white/[0.02]"
                    }`}
                  >
                    {/* Rank */}
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-bold ${
                        isTop3
                          ? medalColor
                          : "border-white/10 bg-white/5 text-slate-500"
                      }`}
                    >
                      {rank}
                    </div>

                    {/* Pilot Name + Badge */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-sm font-bold text-white">
                          {pilot.discordUsername ?? pilot.callsign}
                        </span>
                        {isCurrentUser && (
                          <span className="shrink-0 rounded bg-cyan-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyan-400">
                            YOU
                          </span>
                        )}
                        {(pilot.role === "PRO" || pilot.role === "ADMIN") && (
                          <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-400">
                            PRO
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex shrink-0 items-center gap-6">
                      <div
                        className={`w-12 text-right font-mono text-sm font-bold ${
                          sortBy === "flights" ? "text-cyan-400" : "text-white"
                        }`}
                      >
                        {pilot.totalFlights}
                      </div>
                      <div
                        className={`hidden w-16 text-right font-mono text-sm font-bold sm:block ${
                          sortBy === "distance" ? "text-cyan-400" : "text-white"
                        }`}
                      >
                        {pilot.totalDistanceNm.toLocaleString()}
                      </div>
                      <div
                        className={`hidden w-14 text-right font-mono text-sm font-bold sm:block ${
                          sortBy === "time" ? "text-cyan-400" : "text-white"
                        }`}
                      >
                        {formatFlightTime(pilot.totalFlightTimeMs)}
                      </div>
                      <div
                        className={`hidden w-12 text-right font-mono text-sm font-bold sm:block ${
                          sortBy === "streak" ? "text-cyan-400" : "text-amber-400"
                        }`}
                      >
                        {pilot.currentStreak > 0 ? `${pilot.currentStreak}d` : "—"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4"
        >
          <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
          <div className="flex-1">
            <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
          </div>
          <div className="flex items-center gap-6">
            <div className="h-4 w-12 animate-pulse rounded bg-white/10" />
            <div className="hidden h-4 w-16 animate-pulse rounded bg-white/10 sm:block" />
            <div className="hidden h-4 w-14 animate-pulse rounded bg-white/10 sm:block" />
            <div className="hidden h-4 w-12 animate-pulse rounded bg-white/10 sm:block" />
          </div>
        </div>
      ))}
    </div>
  );
}
