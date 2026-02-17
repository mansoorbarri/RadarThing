"use client";

import React, {
  useMemo,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";

import { useUserByGoogleId } from "~/hooks/useUserByGoogleId";
// Inline SVG icons to avoid bundling entire react-icons library (~7.8MB)
const PlaneInflightIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 12h5a2 2 0 0 1 0 4h-15l-3 -6h3l2 2h3l-2 -7h3l4 7z" />
    <path d="M3 16h18" />
  </svg>
);

const PlaneIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 10h4a2 2 0 0 1 0 4h-4l-4 7h-3l2 -7h-4l-2 2h-3l2 -4l-2 -4h3l2 2h4l-2 -7h3z" />
  </svg>
);

const HistoryIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 8l0 4l2 2" />
    <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
  </svg>
);

const InfoCircleIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
    <path d="M12 9h.01" />
    <path d="M11 12h1v4h1" />
  </svg>
);
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { useProStatus } from "~/hooks/useProStatus";
import Image from "next/image";
import { useAircraftPhoto } from "~/hooks/useAircraftPhoto";
import { useCurrentUserProfile } from "~/hooks/useCurrentUserProfile";
import { AircraftControlPanel } from "./AircraftControlPanel";
import Link from "next/link";

const getFlightPhase = (
  altAGL: number,
  vspeed: number,
  flightPlan?: string,
) => {
  if (altAGL < 100) return "onGround";
  if (vspeed > 200) return "climbing";
  if (vspeed < -200)
    return flightPlan && altAGL < 5000 ? "landing" : "descending";
  if (altAGL > 5000) return "cruising";
  return "unknown";
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

export interface HistoryFlight {
  id: string;
  depICAO?: string;
  arrICAO?: string;
  startTime: number;
  endTime?: number;
  aircraftType?: string;
  callsign?: string;
  duration?: number;
  routeData?: [number, number][];
}

export const Sidebar = ({
  aircraft,
  onWaypointClick,
  onHistoryClick,
  isMobile,
  onClose,
  isFollowMode,
  onToggleFollow,
}: {
  aircraft: PositionUpdate & { altMSL?: number };
  onWaypointClick?: (waypoint: any, index: number) => void;
  onHistoryClick?: (flight: HistoryFlight) => void;
  isMobile: boolean;
  onClose?: () => void;
  isFollowMode?: boolean;
  onToggleFollow?: () => void;
}) => {
  const [tab, setTab] = useState<"info" | "history">("info");
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Real-time flight history query
  const { isProUser } = useProStatus();
  const googleId = aircraft.googleId;
  const shouldFetchHistory = tab === "history" && googleId && isProUser;
  const historyQuery = useQuery(
    api.flights.getHistoryByGoogleId,
    shouldFetchHistory && googleId ? { googleId } : "skip"
  );
  const history = useMemo(() => {
    if (!historyQuery) return [];
    return historyQuery.map((flight) => ({
      ...flight,
      startTime: new Date(flight.startTime),
    }));
  }, [historyQuery]);
  const loadingHistory = shouldFetchHistory && historyQuery === undefined;
  const canAccessHistory = isProUser;

  // Calculate display values using useMemo instead of DOM manipulation
  const displayValues = useMemo(() => {
    const altMSL = Number(aircraft.altMSL ?? aircraft.alt ?? 0);
    const mslVal =
      altMSL >= 18000
        ? `FL${Math.round(altMSL / 100)}`
        : `${Math.round(altMSL).toLocaleString()}`;

    return {
      altitude: mslVal,
      speed: String(Math.round(Number(aircraft.speed ?? 0))),
      vspeed: String(Math.round(Number(aircraft.vspeed ?? 0))),
      heading: `${Math.round(Number(aircraft.heading ?? 0))}°`,
      altAGL: String(Math.round(Number(aircraft.alt ?? 0))),
      squawk: aircraft.squawk ?? "---",
    };
  }, [
    aircraft.alt,
    aircraft.altMSL,
    aircraft.speed,
    aircraft.vspeed,
    aircraft.heading,
    aircraft.squawk,
  ]);

  const currentFlightPhase = useMemo(
    () =>
      getFlightPhase(
        Number(aircraft.alt ?? 0),
        Number(aircraft.vspeed ?? 0),
        aircraft.flightPlan,
      ),
    [aircraft.alt, aircraft.vspeed, aircraft.flightPlan],
  );

  // Get the next waypoint identifier from the aircraft
  const nextWaypointIdent = aircraft.nextWaypoint;

  const renderFlightPlan = useCallback(() => {
    if (!aircraft.flightPlan) return null;
    try {
      const waypoints = JSON.parse(aircraft.flightPlan);
      return (
        <div className="mt-6 space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <div className="h-[1px] flex-1 bg-white/20" />
            <span className="font-mono text-[9px] font-black tracking-[0.3em] text-white/50 uppercase">
              Enroute Path
            </span>
            <div className="h-[1px] flex-1 bg-white/20" />
          </div>
          {waypoints.map((wp: any, i: number) => {
            const isActive = wp.ident === nextWaypointIdent;
            return (
              <div
                key={i}
                className={`group flex cursor-pointer items-center gap-4 rounded-xl border p-3.5 transition ${
                  isActive
                    ? "border-green-500/60 bg-green-500/10 shadow-[0_0_12px_rgba(34,197,94,0.2)]"
                    : "border-white/10 bg-black/40 hover:border-cyan-500/40 hover:bg-black/60"
                }`}
                onClick={() => onWaypointClick?.(wp, i)}
              >
                <div className={`font-mono text-xs font-black ${isActive ? "text-green-400" : "text-cyan-400"}`}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-sm font-black tracking-wider ${isActive ? "text-green-300" : "text-white"}`}>
                      {wp.ident}
                    </span>
                    <span className="font-mono text-[9px] font-bold text-white/40 uppercase">
                      {wp.type}
                    </span>
                  </div>
                  <div className="flex gap-4 font-mono text-[10px] font-bold text-white/60">
                    <span>
                      ALT:{" "}
                      <span className={isActive ? "text-green-200/90" : "text-cyan-100/90"}>{wp.alt ?? "---"}</span>
                    </span>
                    <span>
                      SPD:{" "}
                      <span className={isActive ? "text-green-200/90" : "text-cyan-100/90"}>{wp.spd ?? "---"}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    } catch {
      return null;
    }
  }, [aircraft.flightPlan, onWaypointClick, nextWaypointIdent]);

  const airlineLogo = getAirlineLogoFromFlightNumber(aircraft.flightNo);
  const { photo: aircraftPhoto } = useAircraftPhoto(
    aircraft.flightNo || aircraft.callsign,
    aircraft.type
  );

  // Check if this is the user's own aircraft or if user has special control privileges
  const { googleId: userGoogleId, isLoaded: userLoaded } = useCurrentUserProfile();
  const canControlAnyAircraft = process.env.NODE_ENV === "development" && userGoogleId === "101233162035372298523";
  const isOwnAircraft = userLoaded && (canControlAnyAircraft || (userGoogleId && aircraft.googleId === userGoogleId));

  // Query the pilot's user record for the stats link (with client-side caching)
  const pilotUser = useUserByGoogleId(aircraft.googleId);

  // Reset image loaded state when photo changes
  useEffect(() => {
    setImageLoaded(false);
  }, [aircraftPhoto?.imageUrl]);

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col text-white bg-[#050f14]/90"
    >
      {/* Scrollable content wrapper for mobile */}
      <div className={`${isMobile ? 'flex-1 overflow-y-auto' : 'flex flex-col flex-1 overflow-hidden'}`}>
      {/* Header with optional aircraft photo background */}
      <div className={`relative ${isMobile ? '' : ''} ${aircraftPhoto ? (isMobile ? 'min-h-[140px]' : 'min-h-[200px]') : ''}`}>
        {/* Aircraft Photo Background */}
        {aircraftPhoto && (
          <>
            {/* Loading skeleton while image loads */}
            {!imageLoaded && (
              <div className="absolute inset-0 z-0 animate-pulse bg-white/5" />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={aircraftPhoto.imageUrl}
              alt="Aircraft"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
            />
            {/* Dark gradient overlay for text readability */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050f14] via-[#050f14]/80 to-black/40" />
          </>
        )}

        {/* Flight Info Overlay */}
        <div className={`relative z-10 ${isMobile ? 'p-4 pb-2' : 'p-6 pb-4'} ${aircraftPhoto ? 'pt-32' : ''}`}>
          <div className={`${isMobile ? 'mb-3' : 'mb-5'} flex items-end justify-between`}>
            <div className="min-w-0 flex-1 pr-4">
              <div className="mb-1.5 flex items-center gap-2">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500 shadow-[0_0_8px_#22d3ee]" />
                <span className="font-mono text-[10px] font-black tracking-[0.2em] text-cyan-400 uppercase">
                  {aircraftPhoto ? 'Tracking' : 'Active Radar Lock'}
                </span>
              </div>
              <h1 className="mb-1 truncate font-mono text-4xl leading-none font-black tracking-tighter text-white uppercase drop-shadow-lg">
                {aircraft.flightNo || aircraft.callsign || "N/A"}
              </h1>
              <p className="truncate font-mono text-[11px] font-black tracking-[0.15em] text-slate-300 uppercase">
                {aircraft.type || "Unknown Class"}
              </p>
              {aircraft.callsign && (
                pilotUser ? (
                  <Link
                    href={`/pilot/${pilotUser._id}?callsign=${encodeURIComponent(aircraft.callsign)}`}
                    className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <span className="text-white/40">Pilot:</span> {aircraft.callsign}
                  </Link>
                ) : (
                  <p className="mt-1 font-mono text-[10px] font-bold text-white/60">
                    <span className="text-white/40">Pilot:</span> {aircraft.callsign}
                  </p>
                )
              )}
            </div>
            <div className="relative shrink-0">
              {airlineLogo ? (
                <Image
                  src={airlineLogo}
                  alt="Airline Logo"
                  width={64}
                  height={64}
                  className="rounded-2xl border border-white/20 bg-black/80 object-contain p-2 shadow-xl backdrop-blur-sm"
                  unoptimized
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-black/50 text-white/20 backdrop-blur-sm">
                  <PlaneIcon size={32} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`relative ${isMobile ? 'px-4 pb-2' : 'px-6 pb-4'}`}>
        {/* Follow button */}
        {onToggleFollow && (
          <button
            onClick={onToggleFollow}
            className={`mb-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-[10px] font-black tracking-wider uppercase transition-all ${
              isFollowMode
                ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.2)]"
                : "border-white/10 bg-black/40 text-white/60 hover:border-cyan-500/30 hover:bg-black/60 hover:text-white"
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isFollowMode ? "text-cyan-400" : ""}
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3m0 14v3m10-10h-3M5 12H2m15.5-6.5l-2.1 2.1m-6.8 6.8l-2.1 2.1m0-11l2.1 2.1m6.8 6.8l2.1 2.1" />
            </svg>
            {isFollowMode ? "Following" : "Follow"}
            <span className="text-[8px] text-white/40">(F)</span>
          </button>
        )}

        <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-black/40 p-1.5 shadow-inner">
          <div className="flex flex-col items-center rounded-xl p-3.5">
            <span className="mb-1.5 font-mono text-[9px] font-black text-slate-400 uppercase">
              Altitude
            </span>
            <span className="font-mono text-base leading-none font-black tracking-tight text-white">
              {displayValues.altitude}
            </span>
            <span className="mt-0.5 font-mono text-[8px] font-black tracking-widest text-cyan-400/80 uppercase">
              FT MSL
            </span>
          </div>
          <div className="z-10 flex scale-105 flex-col items-center rounded-xl border border-white/10 bg-white/10 p-3.5 shadow-lg">
            <PlaneInflightIcon size={20} className="text-cyan-400" />
            <span className="mt-1.5 font-mono text-[10px] font-black tracking-wide text-white uppercase">
              {currentFlightPhase}
            </span>
          </div>
          <div className="flex flex-col items-center rounded-xl p-3.5">
            <span className="mb-1.5 font-mono text-[9px] font-black text-slate-400 uppercase">
              Speed
            </span>
            <span className="font-mono text-base leading-none font-black tracking-tight text-white">
              {displayValues.speed}
            </span>
            <span className="mt-0.5 font-mono text-[8px] font-black tracking-widest text-cyan-400/80 uppercase">
              KNOTS GS
            </span>
          </div>
        </div>
      </div>

      {/* Mobile: Show control panel and flight plan */}
      {isMobile ? (
        <div className="px-4 pb-6">
          {isOwnAircraft && <AircraftControlPanel aircraft={aircraft} />}
          {!isOwnAircraft && (
            <div className="py-4 text-center font-mono text-[10px] tracking-widest text-white/40 uppercase">
              {aircraft.departure || "---"} → {aircraft.arrival || "---"}
            </div>
          )}
          {renderFlightPlan()}
        </div>
      ) : (
        <>
          <nav className="mb-5 flex px-6">
            <div className="flex w-full rounded-2xl border border-white/10 bg-black/60 p-1.5 shadow-xl">
              <button
                onClick={() => setTab("info")}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 font-mono text-[10px] font-black transition-all ${
                  tab === "info"
                    ? "bg-white text-black shadow-lg"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <InfoCircleIcon size={14} /> LIVE DATA
              </button>
              <button
                onClick={() => setTab("history")}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 font-mono text-[10px] font-black transition-all ${
                  tab === "history"
                    ? "bg-white text-black shadow-lg"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <HistoryIcon size={14} /> LOGBOOK
              </button>
            </div>
          </nav>

          <div className="custom-scrollbar flex-1 overflow-y-auto px-6 pb-12">
            {tab === "info" ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3.5">
                  <StatBox
                    label="Departure"
                    value={aircraft.departure || "---"}
                    sub="ORIG"
                  />
                  <StatBox
                    label="Arrival"
                    value={aircraft.arrival || "---"}
                    sub="DEST"
                  />
                  <StatBox label="V-Speed" value={displayValues.vspeed} sub="FPM" />
                  <StatBox label="Heading" value={displayValues.heading} sub="MAG" />
                  <StatBox label="Squawk" value={displayValues.squawk} sub="XPDR" />
                  <StatBox label="Alt AGL" value={displayValues.altAGL} sub="FEET" />
                </div>
                {isOwnAircraft && <AircraftControlPanel aircraft={aircraft} />}
                {renderFlightPlan()}
              </div>
            ) : (
              <div className="space-y-3">
                {loadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-60">
                    <div className="mb-4 h-6 w-6 animate-spin rounded-full border-2 border-cyan-400" />
                    <span className="font-mono text-[11px] font-black tracking-widest">
                      LOADING
                    </span>
                  </div>
                ) : canAccessHistory === false ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
                      <HistoryIcon size={28} className="text-amber-400" />
                    </div>
                    <span className="mb-2 font-mono text-sm font-black tracking-wide text-white">
                      PRO Feature
                    </span>
                    <p className="mb-4 max-w-[240px] text-center font-mono text-[10px] leading-relaxed text-white/50">
                      Flight history is available for Pro and Admin users only.
                    </p>
                    <a
                      href="/pricing"
                      className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 font-mono text-[10px] font-black tracking-wide text-black transition-all hover:shadow-lg hover:shadow-amber-500/20"
                    >
                      UPGRADE TO PRO
                    </a>
                  </div>
                ) : history.length === 0 ? (
                  <div className="py-20 text-center font-mono text-[10px] tracking-widest text-white/40 uppercase">
                    No Records
                  </div>
                ) : (
                  history.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => {
                        if (f.routeData) {
                          onHistoryClick?.({
                            id: f.id as string,
                            depICAO: f.depICAO,
                            arrICAO: f.arrICAO,
                            startTime: f.startTime.getTime(),
                            endTime: f.endTime,
                            aircraftType: f.aircraftType,
                            callsign: f.callsign,
                            duration: f.duration,
                            routeData: f.routeData as [number, number][],
                          });
                        }
                      }}
                      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4 shadow-lg transition-all hover:border-amber-500/40"
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-mono text-sm font-black text-white group-hover:text-amber-400">
                          {f.depICAO} → {f.arrICAO}
                        </span>
                        <span className="font-mono text-[10px] font-bold text-white/30">
                          {new Date(f.startTime).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {f.callsign && (
                          <span className="font-mono text-[10px] text-cyan-400/70">
                            {f.callsign}
                          </span>
                        )}
                        {f.aircraftType && (
                          <span className="font-mono text-[10px] text-white/40">
                            {f.aircraftType}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  );
};

const StatBox = ({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) => (
  <div className="group rounded-2xl border border-white/10 bg-black/40 p-4 shadow-lg transition-all hover:bg-black/60">
    <div className="mb-2 font-mono text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase transition-colors group-hover:text-cyan-400/80">
      {label}
    </div>
    <div className="flex items-baseline gap-1.5">
      <div className="truncate font-mono text-lg font-black tracking-tighter text-white">
        {value}
      </div>
      <span className="font-mono text-[9px] font-black tracking-tighter text-cyan-400 uppercase opacity-80">
        {sub}
      </span>
    </div>
  </div>
);
