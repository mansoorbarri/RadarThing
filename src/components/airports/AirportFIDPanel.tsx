"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { X, Plane } from "lucide-react";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { calculateDistance } from "~/lib/map-utils";
import { normalizeAircraftType } from "~/lib/utils";

function getAirlineLogoUrl(flightNo?: string): string | null {
  const match = flightNo?.match(/^([A-Z]{2,3})/);
  const code = match?.[1]?.toLowerCase() ?? null;
  if (!code) return null;
  return `https://content.airhex.com/content/logos/airlines_${code}_200_200_s.png?theme=dark`;
}

function formatEta(
  ac: PositionUpdate,
  airportLat: number,
  airportLon: number,
): string | null {
  if (ac.speed < 30) return null;
  const distanceKm = calculateDistance(ac.lat, ac.lon, airportLat, airportLon);
  const distanceNm = distanceKm * 0.539957;
  const minutesRemaining = Math.round((distanceNm / ac.speed) * 60);
  if (minutesRemaining < 1) return "<1m";
  if (minutesRemaining >= 600) return null;
  const hours = Math.floor(minutesRemaining / 60);
  const mins = minutesRemaining % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

type Tab = "arrivals" | "departures";

interface AirportFIDPanelProps {
  icao: string;
  airportLat: number;
  airportLon: number;
  aircrafts: PositionUpdate[];
  onTrack: (aircraft: PositionUpdate) => void;
  onClose: () => void;
  isMobile: boolean;
}

function FlightRow({
  ac,
  isArrival,
  airportLat,
  airportLon,
  onTrack,
}: {
  ac: PositionUpdate;
  isArrival: boolean;
  airportLat: number;
  airportLon: number;
  onTrack: (ac: PositionUpdate) => void;
}) {
  const logo = getAirlineLogoUrl(ac.flightNo);
  const eta = isArrival ? formatEta(ac, airportLat, airportLon) : null;

  return (
    <button
      onClick={() => onTrack(ac)}
      className="flex w-full cursor-pointer items-center gap-3 border-b border-white/5 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
    >
      {/* Airline logo */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/60">
        {logo ? (
          <Image
            src={logo}
            alt=""
            width={24}
            height={24}
            className="rounded object-contain"
            unoptimized
          />
        ) : (
          <Plane size={14} className="text-white/30" />
        )}
      </div>

      {/* Route, flight number & pilot */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-medium text-white">
            {ac.departure || "----"}
          </span>
          <span className="text-[10px] text-white/30">→</span>
          <span className="font-mono text-xs font-medium text-white">
            {ac.arrival || "----"}
          </span>
          {ac.flightNo && (
            <span className="font-mono text-[10px] text-white/40">
              {ac.flightNo}
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[10px] text-white/50">
          {ac.callsign || "N/A"}
        </div>
      </div>

      {/* ETA (arrivals only) */}
      {isArrival && eta && (
        <div className="shrink-0 text-right">
          <div className="text-[10px] text-white/30">ETA</div>
          <div className="font-mono text-xs text-cyan-400">{eta}</div>
        </div>
      )}

      {/* Aircraft type */}
      <div className="shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/50">
        {normalizeAircraftType(ac.type) || "???"}
      </div>
    </button>
  );
}

export function AirportFIDPanel({
  icao,
  airportLat,
  airportLon,
  aircrafts,
  onTrack,
  onClose,
  isMobile,
}: AirportFIDPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("departures");

  const arrivals = useMemo(
    () => aircrafts.filter((ac) => ac.arrival === icao),
    [aircrafts, icao],
  );

  const departures = useMemo(
    () => aircrafts.filter((ac) => ac.departure === icao),
    [aircrafts, icao],
  );

  const currentList = activeTab === "arrivals" ? arrivals : departures;

  const content = (
    <>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Plane className="h-4 w-4 text-cyan-400" />
          <span className="font-mono text-sm text-cyan-400">
            {icao} Flights
          </span>
        </div>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-white/10">
        <button
          onClick={() => setActiveTab("departures")}
          className={`flex-1 cursor-pointer px-4 py-2 text-center text-xs font-medium transition-colors ${
            activeTab === "departures"
              ? "border-b-2 border-cyan-400 text-cyan-400"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          Departures ({departures.length})
        </button>
        <button
          onClick={() => setActiveTab("arrivals")}
          className={`flex-1 cursor-pointer px-4 py-2 text-center text-xs font-medium transition-colors ${
            activeTab === "arrivals"
              ? "border-b-2 border-cyan-400 text-cyan-400"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          Arrivals ({arrivals.length})
        </button>
      </div>

      {/* Flight list */}
      <div className="max-h-[40vh] overflow-y-auto">
        {currentList.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-xs text-white/30">
            No {activeTab} to/from {icao}
          </div>
        ) : (
          currentList.map((ac) => (
            <FlightRow
              key={ac.id || ac.callsign}
              ac={ac}
              isArrival={activeTab === "arrivals"}
              airportLat={airportLat}
              airportLon={airportLon}
              onTrack={onTrack}
            />
          ))
        )}
      </div>
    </>
  );

  // Mobile: render content inline (page.tsx wraps in MobileSwipeSheet)
  if (isMobile) {
    return <div className="flex h-full flex-col">{content}</div>;
  }

  // Desktop: floating popup above bottom bar, same style as ATC Audio
  return (
    <div className="animate-scale-in fixed bottom-24 left-1/2 z-[10013] w-[calc(100vw-2rem)] max-w-[420px] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl">
      {content}
    </div>
  );
}
