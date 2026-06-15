"use client";

import { useEffect } from "react";
import type { MouseEvent } from "react";
import { Gauge, ShieldAlert, Trophy, X } from "lucide-react";

const exclusionRules = [
  {
    icon: <Gauge className="h-4 w-4" />,
    title: "Speed over the normal stats limit",
    body: "Most aircraft are excluded when the recorded max speed is above 750 kt.",
  },
  {
    icon: <Gauge className="h-4 w-4" />,
    title: "Speed over the high-performance limit",
    body: "Concorde and recognized military/high-performance aircraft use a higher 1100 kt limit.",
  },
  {
    icon: <ShieldAlert className="h-4 w-4" />,
    title: "Excluded after review",
    body: "RadarThing may leave a flight in your history but remove it from stats if it looks invalid.",
  },
];

const affectedStats = [
  "Total flights",
  "Total flight time",
  "Total distance",
  "Current and longest streaks",
  "Top aircraft, routes, and airports",
  "Leaderboard and challenge progress that relies on counted flights",
];

export function StatsExclusionsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[10040] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm"
      onMouseDown={handleBackdropMouseDown}
    >
      <div className="max-h-[92vh] w-full max-w-xl overflow-hidden rounded-xl border border-cyan-400/25 bg-[#050b10]/96 text-slate-100 shadow-[0_24px_90px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.2em] text-cyan-300 uppercase">
              Stats
            </div>
            <h2 className="text-lg font-semibold">Why a flight may not count</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-200"
            aria-label="Close stats rules modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-74px)] space-y-5 overflow-y-auto px-5 py-5">
          <p className="text-sm leading-6 text-slate-300">
            Excluded flights can still appear in flight history, but they are
            skipped when RadarThing updates or rebuilds user stats.
          </p>

          <div className="grid gap-3">
            {exclusionRules.map((rule) => (
              <div
                key={rule.title}
                className="rounded-lg border border-white/10 bg-black/45 p-4"
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-100">
                  <span className="grid h-7 w-7 place-items-center rounded-md border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
                    {rule.icon}
                  </span>
                  {rule.title}
                </div>
                <p className="text-sm leading-5 text-slate-300">{rule.body}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-100">
              <Trophy className="h-4 w-4" />
              Not counted toward
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {affectedStats.map((stat) => (
                <div
                  key={stat}
                  className="rounded-md border border-white/10 bg-black/35 px-3 py-2 text-xs text-slate-200"
                >
                  {stat}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
