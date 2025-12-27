"use client";

import React, {
  useMemo,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import {
  TbPlaneInflight,
  TbPlaneDeparture,
  TbPlane,
  TbPlaneArrival,
  TbHistory,
  TbInfoCircle,
  TbPointFilled,
} from "react-icons/tb";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { getFlightHistory } from "~/app/actions/get-flight-history";
import { getUserProfile } from "~/app/actions/get-user-profile";
import Image from "next/image";

const getFlightPhase = (altAGL: number, vspeed: number, flightPlan?: string) => {
  const isOnGround = altAGL < 100;
  const isClimbing = vspeed > 200;
  const isDescending = vspeed < -200;

  if (isOnGround) return "onGround";
  if (isClimbing) return "climbing";
  if (isDescending)
    return flightPlan && altAGL < 5000 ? "landing" : "descending";
  if (altAGL > 5000) return "cruising";
  return "unknown";
};

export const Sidebar = React.memo(
  ({
    aircraft,
    onWaypointClick,
    onHistoryClick,
    isMobile,
  }: {
    aircraft: PositionUpdate & {
      altMSL?: number;
      googleId?: string;
      role?: string;
    };
    onWaypointClick?: (waypoint: any, index: number) => void;
    onHistoryClick?: (path: [number, number][]) => void;
    isMobile: boolean;
  }) => {
    const [tab, setTab] = useState<"info" | "history">("info");
    const [history, setHistory] = useState<any[]>([]);
    const [dbProfile, setDbProfile] = useState<any>(null);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [selectedFlightId, setSelectedFlightId] = useState<string | null>(
      null,
    );
    const [isExpanded, setIsExpanded] = useState(false);
    const [dragStart, setDragStart] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const altMSL = aircraft.altMSL ?? aircraft.alt;
    const altAGL = aircraft.alt;
    const currentRole = dbProfile?.role || aircraft.role;
    const isPremium = currentRole === "PREMIUM";

    /* ONLY use the logo from the aircraft stream. Do not fall back to DB profile */
    const displayLogo = (aircraft as any).airlineLogo;

    const currentFlightPhase = useMemo(
      () =>
        getFlightPhase(altAGL, Number(aircraft.vspeed), aircraft.flightPlan),
      [altAGL, aircraft.vspeed, aircraft.flightPlan],
    );

    useEffect(() => {
      if (aircraft.googleId) {
        getUserProfile(aircraft.googleId)
          .then(setDbProfile)
          .catch(console.error);
      } else {
        setDbProfile(null);
      }
    }, [aircraft.googleId]);

    useEffect(() => {
      if (tab === "history" && aircraft.googleId && isPremium) {
        setLoadingHistory(true);
        getFlightHistory(aircraft.googleId)
          .then(setHistory)
          .catch(console.error)
          .finally(() => setLoadingHistory(false));
      }
    }, [tab, aircraft.googleId, isPremium]);

    const getPhaseIcon = (phase: string) => {
      const iconProps = { size: 24, strokeWidth: 1.5 };
      switch (phase) {
        case "climbing":
          return <TbPlaneDeparture {...iconProps} className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" />;
        case "cruising":
          return <TbPlaneInflight {...iconProps} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" />;
        case "descending":
        case "landing":
          return <TbPlaneArrival {...iconProps} className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />;
        default:
          return <TbPlane {...iconProps} className="text-slate-300" />;
      }
    };

    const phaseTextMap: Record<string, string> = {
      onGround: "Ground",
      climbing: "Climb",
      cruising: "Cruise",
      descending: "Descend",
      landing: "Land",
      unknown: "Flight",
    };

    const displayAltMSL =
      altMSL >= 18000
        ? `FL${Math.round(altMSL / 100)}`
        : `${Math.round(altMSL).toLocaleString()}`;

    const handleTouchStart = (e: React.TouchEvent) => {
      if (isMobile && e.touches[0]) setDragStart(e.touches[0].clientY);
    };
    const handleTouchMove = (e: React.TouchEvent) => {
      if (isMobile && dragStart !== null && e.touches[0])
        setDragOffset(e.touches[0].clientY - dragStart);
    };
    const handleTouchEnd = () => {
      if (isMobile && dragStart !== null) {
        if (dragOffset > 80) setIsExpanded(false);
        else if (dragOffset < -80) setIsExpanded(true);
        setDragStart(null);
        setDragOffset(0);
      }
    };

    const renderFlightPlan = useCallback(() => {
      if (!aircraft.flightPlan)
        return (
          <div className="flex flex-col items-center justify-center p-8 opacity-40">
            <TbPointFilled className="animate-pulse text-cyan-500 mb-2" />
            <div className="font-mono text-[10px] tracking-widest uppercase text-white/70">No Route Data</div>
          </div>
        );
      try {
        const waypoints = JSON.parse(aircraft.flightPlan);
        return (
          <div className="mt-6 space-y-2.5">
             <div className="flex items-center gap-2 px-1">
                <div className="h-[1px] flex-1 bg-white/20" />
                <span className="font-mono text-[9px] font-black tracking-[0.3em] text-white/50 uppercase">Enroute Path</span>
                <div className="h-[1px] flex-1 bg-white/20" />
             </div>
            {waypoints.map((wp: any, i: number) => (
              <div
                key={i}
                className="group flex items-center gap-4 rounded-xl border border-white/10 bg-black/40 p-3.5 transition hover:bg-black/60 hover:border-cyan-500/40"
                onClick={() => onWaypointClick?.(wp, i)}
              >
                <div className="font-mono text-xs font-black text-cyan-400 group-hover:scale-110 transition-transform">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-white tracking-wider">{wp.ident}</span>
                    <span className="font-mono text-[9px] text-white/40 font-bold uppercase">{wp.type}</span>
                  </div>
                  <div className="flex gap-4 font-mono text-[10px] text-white/60">
                    <span>ALT: <span className="text-cyan-100/90">{wp.alt ? `${wp.alt}` : "---"}</span></span>
                    <span>SPD: <span className="text-cyan-100/90">{wp.spd ? `${wp.spd}` : "---"}</span></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      } catch {
        return <div className="p-4 font-mono text-[10px] text-red-400">PATH_DATA_ERROR</div>;
      }
    }, [aircraft.flightPlan, onWaypointClick]);

    return (
      <div
        ref={containerRef}
        style={{
          transform: `translateY(${dragOffset}px)`,
          height: isMobile ? (isExpanded ? "88vh" : "240px") : "100%",
        }}
        className={`
          flex flex-col overflow-hidden text-white transition-all duration-500 ease-in-out
          ${isMobile 
            ? "fixed inset-x-0 bottom-0 rounded-t-[2.5rem] border-t border-white/20 bg-[#050f14] shadow-[0_-20px_50px_rgba(0,0,0,0.8)]" 
            : "h-full w-full bg-[#050f14]/90 backdrop-blur-3xl border-l border-white/10 shadow-2xl"}
        `}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative p-6 pb-4">
          <div className="flex items-start justify-between mb-5">
            <div className="flex-1 min-w-0 pr-4">
               <div className="flex items-center gap-2 mb-1.5">
                 <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_#22d3ee]" />
                 <span className="font-mono text-[10px] font-black tracking-[0.2em] text-cyan-400 uppercase">
                   Active Radar Lock
                 </span>
               </div>
               <h1 className="truncate font-mono text-4xl font-black tracking-tighter text-white leading-none mb-1">
                {aircraft.callsign || aircraft.flightNo || "N/A"}
               </h1>
               <p className="truncate font-mono text-[11px] font-bold text-white/50 uppercase tracking-[0.15em]">
                {aircraft.type || "Unknown Class"}
               </p>
            </div>
            
            <div className="relative">
              <div className="absolute -inset-1.5 rounded-2xl bg-cyan-500/20 blur-md" />
              {displayLogo ? (
                <Image
                  src={displayLogo}
                  alt="Logo"
                  width={64}
                  height={64}
                  className="relative rounded-2xl border border-white/20 bg-black/80 object-contain p-2.5 shadow-xl"
                  unoptimized
                />
              ) : (
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/20">
                  <TbPlane size={32} />
                </div>
              )}
              {isPremium && (
                <div className="absolute -bottom-2 -right-1 rounded bg-cyan-500 px-2 py-0.5 font-mono text-[9px] font-black text-black shadow-lg">
                  PREMIUM
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-black/40 p-1.5 shadow-inner">
             <div className="flex flex-col items-center p-3.5 rounded-xl hover:bg-white/5 transition-colors">
                <span className="font-mono text-[9px] font-black uppercase text-white/40 mb-1.5">Altitude</span>
                <span className="font-mono text-base font-black text-white tracking-tight">{displayAltMSL}</span>
                <span className="font-mono text-[8px] font-black text-white/30 uppercase tracking-widest mt-0.5">FT MSL</span>
             </div>
             <div className="flex flex-col items-center p-3.5 rounded-xl bg-white/10 border border-white/10 shadow-lg scale-105 z-10">
                {getPhaseIcon(currentFlightPhase)}
                <span className="font-mono text-[11px] font-black text-white mt-1.5 uppercase tracking-wide">{phaseTextMap[currentFlightPhase]}</span>
             </div>
             <div className="flex flex-col items-center p-3.5 rounded-xl hover:bg-white/5 transition-colors">
                <span className="font-mono text-[9px] font-black uppercase text-white/40 mb-1.5">Speed</span>
                <span className="font-mono text-base font-black text-white tracking-tight">{Math.round(aircraft.speed || 0)}</span>
                <span className="font-mono text-[8px] font-black text-white/30 uppercase tracking-widest mt-0.5">KNOTS GS</span>
             </div>
          </div>
        </div>

        <nav className="flex px-6 mb-5">
          <div className="flex w-full rounded-2xl bg-black/60 p-1.5 border border-white/10 shadow-xl">
            <button
              onClick={() => setTab("info")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 font-mono text-[10px] font-black transition-all ${tab === "info" ? "bg-white/10 text-white shadow-lg border border-white/10" : "text-white/40 hover:text-white/70"}`}
            >
              <TbInfoCircle size={14} /> LIVE DATA
            </button>
            <button
              onClick={() => setTab("history")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 font-mono text-[10px] font-black transition-all ${tab === "history" ? "bg-white/10 text-white shadow-lg border border-white/10" : "text-white/40 hover:text-white/70"}`}
            >
              <TbHistory size={14} /> LOGBOOK
            </button>
          </div>
        </nav>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-6 pb-12">
          {tab === "info" ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3.5">
                 <StatBox label="Departure" value={aircraft.departure || "---"} sub="ORIG" />
                 <StatBox label="Arrival" value={aircraft.arrival || "---"} sub="DEST" />
                 <StatBox label="V-Speed" value={`${aircraft.vspeed || 0}`} sub="FPM" />
                 <StatBox label="Heading" value={`${Math.round(aircraft.heading || 0)}°`} sub="MAG" />
                 <StatBox label="Squawk" value={aircraft.squawk || "---"} sub="XPDR" />
                 <StatBox label="Alt AGL" value={`${Math.round(altAGL)}`} sub="FEET" />
              </div>
              
              {(isExpanded || !isMobile) && renderFlightPlan()}
            </div>
          ) : (
            <div className="space-y-3">
              {isPremium ? (
                <>
                  {loadingHistory ? (
                    <div className="flex flex-col items-center justify-center py-24 opacity-60">
                      <div className="h-6 w-6 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin mb-4" />
                      <span className="font-mono text-[11px] font-black tracking-[0.2em] uppercase text-cyan-400">Loading Logs</span>
                    </div>
                  ) : history.length === 0 ? (
                    <div className="py-24 text-center font-mono text-[10px] text-white/40 tracking-widest uppercase">No Historic Records</div>
                  ) : (
                    history.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => {
                          setSelectedFlightId(f.id);
                          if (f.routeData) onHistoryClick?.(f.routeData as [number, number][]);
                        }}
                        className={`group cursor-pointer rounded-2xl border p-4.5 transition-all duration-300 ${selectedFlightId === f.id ? "bg-cyan-500/20 border-cyan-500" : "bg-black/40 border-white/10 hover:border-white/30 hover:bg-black/60 shadow-lg"}`}
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="font-mono text-base font-black tracking-widest text-white group-hover:text-cyan-400 transition-colors">
                            {f.depICAO || "???"} <span className="text-white/20 mx-1">→</span> {f.arrICAO || "???"}
                          </span>
                          <span className="font-mono text-[10px] font-bold text-white/40">
                            {new Date(f.startTime).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="font-mono text-[10px] font-black text-white/60 uppercase tracking-widest flex items-center gap-2">
                          <TbPlane size={14} className="text-cyan-400/60" /> {f.aircraftType || "Gen. Aviation"}
                        </div>
                      </div>
                    ))
                  )}
                </>
              ) : (
                <div className="mt-6 overflow-hidden rounded-[2rem] border border-amber-500/30 bg-amber-500/10 p-8 text-center shadow-2xl">
                  <div className="font-mono text-[11px] font-black tracking-[0.2em] text-amber-400 uppercase mb-3">Premium Required</div>
                  <p className="font-mono text-[10px] text-amber-100/60 leading-relaxed uppercase tracking-wider">
                    Historic logbook tracking is restricted to authenticated Premium Radar operators.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
);

Sidebar.displayName = "Sidebar";

const StatBox = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
  <div className="group rounded-2xl border border-white/10 bg-black/40 p-4 transition-all hover:bg-black/60 hover:border-white/20 shadow-lg">
    <div className="font-mono text-[9px] font-black tracking-[0.2em] text-white/40 uppercase mb-2 group-hover:text-cyan-400 transition-colors">{label}</div>
    <div className="flex items-baseline gap-1.5">
      <div className="truncate font-mono text-lg font-black text-white tracking-tight">{value}</div>
      <span className="font-mono text-[9px] text-white/20 uppercase font-black tracking-tighter">{sub}</span>
    </div>
  </div>
);