"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { type PositionUpdate } from "~/lib/aircraft-store";

interface CallsignFilterProps {
  aircrafts: PositionUpdate[];
  selectedCallsigns: Set<string>;
  onToggleCallsign: (prefix: string) => void;
  onClearFilters: () => void;
}

const getAirlineLogoFromFlightNumber = (flightNo?: string): string | null => {
  if (!flightNo) return null;
  const match = /^[A-Z]{2,3}/.exec(flightNo.trim().toUpperCase());
  if (!match) return null;
  const code = match[0];
  return `https://content.airhex.com/content/logos/airlines_${code}_200_200_s.png?theme=dark`;
};

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
      const match = prefixRegex.exec(aircraft.flightNo.trim().toUpperCase());
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
    <div className="animate-in fade-in slide-in-from-right-2 pointer-events-auto flex h-full flex-col border-l border-white/10 bg-black/85 backdrop-blur-xl duration-200 ease-out">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <span className="text-sm font-semibold tracking-widest text-cyan-400 uppercase">
          Airline Filter
        </span>
        {selectedCallsigns.size > 0 && (
          <button
            onClick={onClearFilters}
            className="text-sm tracking-wide text-cyan-400 hover:text-cyan-300"
          >
            Clear
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {callsignPrefixes.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No flights with callsigns
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {callsignPrefixes.map(({ prefix, count }) => (
              <AirlineRow
                key={prefix}
                prefix={prefix}
                count={count}
                isSelected={selectedCallsigns.has(prefix)}
                onToggle={onToggleCallsign}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------
 * Airline row (isolated for hook safety)
 * ------------------------------------------ */

function AirlineRow({
  prefix,
  count,
  isSelected,
  onToggle,
}: {
  prefix: string;
  count: number;
  isSelected: boolean;
  onToggle: (prefix: string) => void;
}) {
  const [logoError, setLogoError] = useState(false);
  const logoUrl = getAirlineLogoFromFlightNumber(prefix);

  return (
    <li>
      <button
        onClick={() => onToggle(prefix)}
        className={`flex w-full items-center gap-5 px-6 py-4 transition-all duration-150 ${
          isSelected
            ? "bg-cyan-500/15 text-cyan-300"
            : "text-slate-200 hover:bg-white/5"
        }`}
      >
        {/* Logo */}
        <div className="flex h-10 w-10 items-center justify-center">
          {logoUrl && !logoError ? (
            <Image
              src={logoUrl}
              alt={prefix}
              width={40}
              height={40}
              className="rounded bg-black/40 object-contain select-none"
              unoptimized
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded bg-white/5 font-mono text-sm text-slate-400">
              {prefix}
            </div>
          )}
        </div>

        {/* Airline info */}
        <div className="flex flex-col items-start">
          <span className="font-mono text-lg leading-tight">{prefix}</span>
          <span className="text-sm text-slate-500">
            {count} flight{count > 1 ? "s" : ""}
          </span>
        </div>

        {/* Selected indicator */}
        {isSelected && (
          <div className="ml-auto rounded-full bg-cyan-400/20 px-3 py-1 text-xs font-bold text-cyan-300 uppercase">
            Active
          </div>
        )}
      </button>
    </li>
  );
}
