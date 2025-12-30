"use client";

import React, { useMemo } from "react";
import { type PositionUpdate } from "~/lib/aircraft-store";

interface CallsignFilterProps {
  aircrafts: PositionUpdate[];
  selectedCallsigns: Set<string>;
  onToggleCallsign: (prefix: string) => void;
  onClearFilters: () => void;
}

export function CallsignFilter({
  aircrafts,
  selectedCallsigns,
  onToggleCallsign,
  onClearFilters,
}: CallsignFilterProps) {
  const callsignPrefixes = useMemo(() => {
    const prefixMap = new Map<string, number>();
    const prefixRegex = /^[A-Z]+/;

    aircrafts.forEach((aircraft) => {
      if (!aircraft.flightNo) return;

      const trimmed = aircraft.flightNo.trim();
      const upperFlightNo = trimmed.toUpperCase();
      const match = prefixRegex.exec(upperFlightNo);
      const prefix = match?.[0];

      if (prefix && prefix.length >= 2) {
        prefixMap.set(prefix, (prefixMap.get(prefix) || 0) + 1);
      }
    });

    return Array.from(prefixMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([prefix, count]) => ({ prefix, count }));
  }, [aircrafts]);

  return (
    <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-xs font-medium tracking-wider text-slate-400 uppercase">
          Filter by Airline
        </span>
        {selectedCallsigns.size > 0 && (
          <button
            onClick={onClearFilters}
            className="text-xs text-cyan-400 transition-colors hover:text-cyan-300"
          >
            Clear
          </button>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto p-2">
        {callsignPrefixes.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">
            No aircraft with flight numbers found
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {callsignPrefixes.map(({ prefix, count }) => {
              const isSelected = selectedCallsigns.has(prefix);
              return (
                <button
                  key={prefix}
                  onClick={() => onToggleCallsign(prefix)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-300"
                      : "border-white/10 bg-black/20 text-slate-400 hover:border-white/20 hover:bg-black/40"
                  }`}
                >
                  <span className="font-mono">{prefix}</span>
                  <span className="ml-1.5 text-[10px] opacity-60">
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}