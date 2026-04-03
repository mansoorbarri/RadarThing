"use client";

import React, { useState, useMemo } from "react";
import { X, Plane } from "lucide-react";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { calculateDistance } from "~/lib/map-utils";
import { normalizeAircraftType } from "~/lib/utils";

const toRadians = (value: number) => (value * Math.PI) / 180;

const normalizeHeading = (heading: number) => {
  const normalized = heading % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

function calculateBearing(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
) {
  const fromLatRad = toRadians(fromLat);
  const toLatRad = toRadians(toLat);
  const deltaLonRad = toRadians(toLon - fromLon);

  const y = Math.sin(deltaLonRad) * Math.cos(toLatRad);
  const x =
    Math.cos(fromLatRad) * Math.sin(toLatRad) -
    Math.sin(fromLatRad) * Math.cos(toLatRad) * Math.cos(deltaLonRad);

  return normalizeHeading((Math.atan2(y, x) * 180) / Math.PI);
}

function headingDelta(a: number, b: number) {
  const delta = Math.abs(normalizeHeading(a) - normalizeHeading(b));
  return delta > 180 ? 360 - delta : delta;
}

function getArrivalEtaMinutes(
  ac: PositionUpdate,
  airportLat: number,
  airportLon: number,
): number | null {
  const speed = Number(ac.speed);
  const heading = Number(ac.heading);
  const altitude = Number(ac.alt);
  const verticalSpeed = Number(ac.vspeed);

  if (
    !Number.isFinite(speed) ||
    !Number.isFinite(heading) ||
    !Number.isFinite(altitude) ||
    speed < 80 ||
    altitude < 75
  ) {
    return null;
  }

  const distanceKm = calculateDistance(ac.lat, ac.lon, airportLat, airportLon);
  const distanceNm = distanceKm * 0.539957;
  if (!Number.isFinite(distanceNm) || distanceNm < 0.3 || distanceNm >= 400) {
    return null;
  }

  const bearingToAirport = calculateBearing(
    ac.lat,
    ac.lon,
    airportLat,
    airportLon,
  );
  const delta = headingDelta(heading, bearingToAirport);

  // Ignore aircraft that are clearly not inbound to the airport.
  if (delta > 100) {
    return null;
  }

  const closingSpeed = speed * Math.cos(toRadians(delta));
  if (closingSpeed < 70) {
    return null;
  }

  // Account for route extension and vectoring instead of using a pure
  // straight-line estimate.
  const turnPenalty =
    distanceNm < 10
      ? delta / 120
      : distanceNm < 40
        ? delta / 200
        : delta / 300;
  const routeFactor =
    1 +
    turnPenalty +
    (distanceNm > 120 ? 0.08 : distanceNm > 40 ? 0.05 : 0.02) +
    (Number.isFinite(verticalSpeed) && verticalSpeed > 500 ? 0.06 : 0);

  const adjustedDistanceNm = distanceNm * routeFactor;
  const minutesRemaining = Math.round((adjustedDistanceNm / closingSpeed) * 60);

  if (minutesRemaining >= 600) return null;
  return minutesRemaining;
}

function formatEta(minutesRemaining: number | null): string | null {
  if (minutesRemaining === null) return null;
  if (minutesRemaining < 1) return "<1m";
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
  const eta = isArrival
    ? formatEta(getArrivalEtaMinutes(ac, airportLat, airportLon))
    : null;

  return (
    <button
      onClick={() => onTrack(ac)}
      className="flex w-full cursor-pointer items-center gap-3 border-b border-white/5 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
    >
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
    () =>
      aircrafts
        .filter((ac) => ac.arrival === icao)
        .sort((a, b) => {
          const etaA = getArrivalEtaMinutes(a, airportLat, airportLon);
          const etaB = getArrivalEtaMinutes(b, airportLat, airportLon);

          if (etaA === null && etaB === null) {
            return (b.speed || 0) - (a.speed || 0);
          }
          if (etaA === null) return 1;
          if (etaB === null) return -1;
          return etaA - etaB;
        }),
    [aircrafts, airportLat, airportLon, icao],
  );

  const departures = useMemo(
    () =>
      aircrafts
        .filter((ac) => ac.departure === icao)
        .sort((a, b) => {
          const altitudeA = Number(a.alt);
          const altitudeB = Number(b.alt);
          const speedA = Number(a.speed);
          const speedB = Number(b.speed);
          const isAirborneA = Number.isFinite(altitudeA) && altitudeA > 75;
          const isAirborneB = Number.isFinite(altitudeB) && altitudeB > 75;

          if (isAirborneA !== isAirborneB) {
            return isAirborneA ? -1 : 1;
          }

          return (speedB || 0) - (speedA || 0);
        }),
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
