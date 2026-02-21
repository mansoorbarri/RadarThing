"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { X, Plane } from "lucide-react";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { calculateDistance } from "~/lib/map-utils";

const AIRCRAFT_TYPE_MAP: Record<string, string> = {
  // Boeing
  "Boeing 737-800": "B738",
  "Boeing 737-700": "B737",
  "Boeing 737-900": "B739",
  "Boeing 737 MAX 8": "B38M",
  "Boeing 737 MAX 9": "B39M",
  "Boeing 737 MAX 10": "B3XM",
  "Boeing 747-400": "B744",
  "Boeing 747-8": "B748",
  "Boeing 757-200": "B752",
  "Boeing 757-300": "B753",
  "Boeing 767-300": "B763",
  "Boeing 767-300ER": "B763",
  "Boeing 767-400ER": "B764",
  "Boeing 777-200": "B772",
  "Boeing 777-200ER": "B772",
  "Boeing 777-200LR": "B77L",
  "Boeing 777-300": "B773",
  "Boeing 777-300ER": "B77W",
  "Boeing 777X": "B779",
  "Boeing 787-8": "B788",
  "Boeing 787-9": "B789",
  "Boeing 787-10": "B78X",
  // Airbus
  "Airbus A220-300": "BCS3",
  "Airbus A220-100": "BCS1",
  "Airbus A300": "A306",
  "Airbus A310": "A310",
  "Airbus A318": "A318",
  "Airbus A319": "A319",
  "Airbus A320": "A320",
  "Airbus A320neo": "A20N",
  "Airbus A321": "A321",
  "Airbus A321neo": "A21N",
  "Airbus A330-200": "A332",
  "Airbus A330-300": "A333",
  "Airbus A330-900neo": "A339",
  "Airbus A340-300": "A343",
  "Airbus A340-600": "A346",
  "Airbus A350-900": "A359",
  "Airbus A350-1000": "A35K",
  "Airbus A380": "A388",
  "Airbus A380-800": "A388",
  // Regional / Others
  "Bombardier CRJ-700": "CRJ7",
  "Bombardier CRJ-900": "CRJ9",
  "Embraer E170": "E170",
  "Embraer E175": "E75S",
  "Embraer E190": "E190",
  "Embraer E195": "E195",
  "ATR 72": "AT76",
  "ATR 42": "AT45",
  "Cessna 172": "C172",
  "Cessna 208": "C208",
  "Bombardier Dash 8": "DH8D",
  "McDonnell Douglas MD-11": "MD11",
  "Concorde": "CONC",
};

function normalizeAircraftType(type?: string): string {
  if (!type) return "???";
  if (/^[A-Z0-9]{2,4}$/.test(type)) return type;
  const upper = type.trim();
  if (AIRCRAFT_TYPE_MAP[upper]) return AIRCRAFT_TYPE_MAP[upper];
  for (const [key, code] of Object.entries(AIRCRAFT_TYPE_MAP)) {
    if (upper.toLowerCase().startsWith(key.toLowerCase())) return code;
  }
  return type.length > 6 ? type.slice(0, 6) : type;
}

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
        {normalizeAircraftType(ac.type)}
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
          <span className="font-mono text-sm text-cyan-400">{icao} Flights</span>
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
    <div className="animate-scale-in fixed bottom-24 left-1/2 z-[10013] w-[420px] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl">
      {content}
    </div>
  );
}
