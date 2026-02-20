"use client";

import { useState } from "react";
import { TrendingUp, Eye, X } from "lucide-react";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { type MostTrackedFlight } from "~/hooks/useMostTrackedFlights";
import { Analytics } from "~/lib/analytics";

interface Props {
  flights: MostTrackedFlight[];
  onTrack: (aircraft: PositionUpdate) => void;
}

export function MostTrackedPanel({ flights, onTrack }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || flights.length === 0) return null;

  return (
    <div className="fixed left-6 top-1/2 z-[10011] w-[280px] -translate-y-1/2 rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-cyan-400" />
          <span className="font-mono text-xs tracking-widest text-cyan-400 uppercase">
            Most Tracked
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="cursor-pointer text-slate-500 transition-colors hover:text-white"
        >
          <X size={14} />
        </button>
      </div>

      {/* Flight list */}
      <div className="max-h-[300px] overflow-y-auto py-1">
        {flights.map((flight, index) => (
          <button
            key={flight.callsign}
            onClick={() => {
              if (flight.aircraft) {
                Analytics.mostTrackedFlightClicked({
                  callsign: flight.callsign,
                  trackerCount: flight.count,
                  rank: index + 1,
                });
                onTrack(flight.aircraft);
              }
            }}
            disabled={!flight.aircraft}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 transition-colors hover:bg-white/5 disabled:cursor-default disabled:opacity-40"
          >
            {/* Rank */}
            <span className="w-5 text-right font-mono text-xs font-bold text-slate-500">
              {index + 1}
            </span>

            {/* Flight info */}
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate font-mono text-xs font-medium text-white">
                {flight.aircraft?.flightNo || flight.callsign}
              </div>
              {flight.aircraft && (
                <div className="truncate text-[10px] text-slate-500">
                  {flight.aircraft.departure || "UNK"} →{" "}
                  {flight.aircraft.arrival || "UNK"}
                </div>
              )}
            </div>

            {/* Tracker count */}
            <div className="flex items-center gap-1 text-slate-400">
              <Eye size={12} />
              <span className="font-mono text-xs">{flight.count}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
