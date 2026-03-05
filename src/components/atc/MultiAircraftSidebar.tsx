"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { type PositionUpdate } from "~/lib/aircraft-store";

// Flight path colors matching useFlightPlanDrawing.ts
const FLIGHT_PATH_COLORS = [
  "#00ff00", // green
  "#ff6b6b", // red
  "#4dabf7", // blue
  "#ffd43b", // yellow
  "#da77f2", // purple
  "#69db7c", // light green
  "#ff922b", // orange
  "#22b8cf", // cyan
];

const CloseIcon = ({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const getFlightPhase = (
  altAGL: number,
  vspeed: number,
  flightPlan?: string,
) => {
  if (altAGL < 100) return "GND";
  if (vspeed > 200) return "CLB";
  if (vspeed < -200) return flightPlan && altAGL < 5000 ? "LND" : "DES";
  if (altAGL > 5000) return "CRZ";
  return "---";
};

const extractAirlineFromFlightNumber = (flightNo?: string): string | null => {
  const match = flightNo?.match(/^([A-Z]{2,3})/);
  return match?.[1]?.toLowerCase() ?? null;
};

const getAirlineLogoFromFlightNumber = (flightNo?: string): string | null => {
  const code = extractAirlineFromFlightNumber(flightNo);
  if (!code) return null;
  return `https://content.airhex.com/content/logos/airlines_${code}_200_200_s.png?theme=dark`;
};

interface AircraftCardProps {
  aircraft: PositionUpdate & { altMSL?: number };
  colorIndex: number;
  onRemove: () => void;
}

const AircraftCard = ({
  aircraft,
  colorIndex,
  onRemove,
}: AircraftCardProps) => {
  const color = FLIGHT_PATH_COLORS[colorIndex % FLIGHT_PATH_COLORS.length]!;
  const airlineLogo = getAirlineLogoFromFlightNumber(aircraft.flightNo);

  const displayValues = useMemo(() => {
    const altMSL = Number(aircraft.altMSL ?? aircraft.alt ?? 0);
    const mslVal =
      altMSL >= 18000
        ? `FL${Math.round(altMSL / 100)}`
        : `${Math.round(altMSL).toLocaleString()}`;

    return {
      altitude: mslVal,
      speed: String(Math.round(Number(aircraft.speed ?? 0))),
      heading: `${Math.round(Number(aircraft.heading ?? 0))}°`,
      phase: getFlightPhase(
        Number(aircraft.alt ?? 0),
        Number(aircraft.vspeed ?? 0),
        aircraft.flightPlan,
      ),
    };
  }, [
    aircraft.alt,
    aircraft.altMSL,
    aircraft.speed,
    aircraft.heading,
    aircraft.vspeed,
    aircraft.flightPlan,
  ]);

  return (
    <div
      className="animate-fade-in-up relative rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur-sm"
      style={{ animationDelay: `${colorIndex * 60}ms` }}
    >
      {/* Color indicator strip */}
      <div
        className="absolute top-0 bottom-0 left-0 w-1 rounded-l-xl"
        style={{ backgroundColor: color }}
      />

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 cursor-pointer rounded-full p-1 transition-colors hover:bg-white/10"
      >
        <CloseIcon size={14} className="text-white/40 hover:text-white/80" />
      </button>

      <div className="flex items-start gap-3 pl-2">
        {/* Airline logo */}
        {airlineLogo && (
          <div className="shrink-0">
            <Image
              src={airlineLogo}
              alt="Airline"
              width={36}
              height={36}
              className="rounded-lg border border-white/10 bg-black/50 object-contain p-1"
              unoptimized
            />
          </div>
        )}

        {/* Flight info */}
        <div className="min-w-0 flex-1 pr-4">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-sm font-bold text-white">
              {aircraft.flightNo || aircraft.callsign || "N/A"}
            </span>
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold"
              style={{ backgroundColor: `${color}30`, color }}
            >
              {displayValues.phase}
            </span>
          </div>
          <div className="truncate font-mono text-[10px] text-white/50">
            {aircraft.type || "Unknown"}
          </div>
          <div className="mt-1 font-mono text-[10px] text-white/40">
            {aircraft.departure || "---"} → {aircraft.arrival || "---"}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-2 flex gap-4 pl-2 font-mono text-[10px]">
        <div>
          <span className="text-white/40">ALT </span>
          <span className="text-white/80">{displayValues.altitude}</span>
        </div>
        <div>
          <span className="text-white/40">SPD </span>
          <span className="text-white/80">{displayValues.speed}kt</span>
        </div>
        <div>
          <span className="text-white/40">HDG </span>
          <span className="text-white/80">{displayValues.heading}</span>
        </div>
      </div>
    </div>
  );
};

export const MultiAircraftSidebar = ({
  aircrafts,
  onRemoveAircraft,
  onClose,
  isMobile,
}: {
  aircrafts: PositionUpdate[];
  onRemoveAircraft: (aircraft: PositionUpdate) => void;
  onClose: () => void;
  isMobile: boolean;
}) => {
  return (
    <div className="flex h-full flex-col bg-[#050f14]/90 text-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500 shadow-[0_0_8px_#22d3ee]" />
          <span className="font-mono text-[11px] font-bold tracking-wider text-cyan-400 uppercase">
            {aircrafts.length} Aircraft Selected
          </span>
        </div>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-white/10"
        >
          <CloseIcon size={16} className="text-white/60" />
        </button>
      </div>

      {/* Aircraft cards */}
      <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto p-3">
        {aircrafts.map((aircraft, index) => (
          <AircraftCard
            key={aircraft.callsign || aircraft.id}
            aircraft={aircraft}
            colorIndex={index}
            onRemove={() => onRemoveAircraft(aircraft)}
          />
        ))}
      </div>

      {/* Footer hint */}
      <div className="shrink-0 border-t border-white/10 px-4 py-2">
        <p className="text-center font-mono text-[9px] text-white/30">
          CTRL+Click to add/remove aircraft
        </p>
      </div>
    </div>
  );
};
