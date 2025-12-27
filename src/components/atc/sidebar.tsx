"use client";

import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import {
  TbPlaneInflight,
  TbPlaneDeparture,
  TbPlane,
  TbPlaneArrival,
  TbHistory,
  TbInfoCircle,
  TbUserCircle,
} from "react-icons/tb";
import { type PositionUpdate } from "~/lib/aircraft-store";
import { getFlightHistory } from "~/app/actions/get-flight-history";
import { getUserProfile } from "~/app/actions/get-user-profile";

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
    const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [dragStart, setDragStart] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const altMSL = aircraft.altMSL ?? aircraft.alt;
    const altAGL = aircraft.alt;
    
    // Use DB role if available, fallback to aircraft object
    const currentRole = dbProfile?.role || aircraft.role;
    const isPremium = currentRole === "PREMIUM";
    
    // Priority: DB Logo -> SSE Logo -> Placeholder
    const displayLogo = dbProfile?.airlineLogo || (aircraft as any).airlineLogo;

    const currentFlightPhase = useMemo(
      () => getFlightPhase(altAGL, Number(aircraft.vspeed), aircraft.flightPlan),
      [altAGL, aircraft.vspeed, aircraft.flightPlan],
    );

    // Fetch Profile (Logo/Role)
    useEffect(() => {
      if (aircraft.googleId) {
        getUserProfile(aircraft.googleId).then(setDbProfile).catch(console.error);
      } else {
        setDbProfile(null);
      }
    }, [aircraft.googleId]);

    // Fetch History
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
      const iconProps = { size: 20, strokeWidth: 1.4, color: "#fff" };
      switch (phase) {
        case "climbing": return <TbPlaneDeparture {...iconProps} />;
        case "cruising": return <TbPlaneInflight {...iconProps} />;
        case "descending":
        case "landing": return <TbPlaneArrival {...iconProps} />;
        default: return <TbPlane {...iconProps} />;
      }
    };

    const phaseTextMap: Record<string, string> = {
      onGround: "Ground", climbing: "Climb", cruising: "Cruise",
      descending: "Descend", landing: "Land", unknown: "Flight",
    };

    const displayAltMSL = altMSL >= 18000 ? `FL${Math.round(altMSL / 100)}` : `${altMSL.toFixed(0)} ft`;

    const handleTouchStart = (e: React.TouchEvent) => { if (isMobile && e.touches[0]) setDragStart(e.touches[0].clientY); };
    const handleTouchMove = (e: React.TouchEvent) => { if (isMobile && dragStart !== null && e.touches[0]) setDragOffset(e.touches[0].clientY - dragStart); };
    const handleTouchEnd = () => {
      if (isMobile && dragStart !== null) {
        if (dragOffset > 80) setIsExpanded(false);
        else if (dragOffset < -80) setIsExpanded(true);
        setDragStart(null);
        setDragOffset(0);
      }
    };

    const renderFlightPlan = useCallback(() => {
      if (!aircraft.flightPlan) return <div className="p-4 text-center text-sm text-white/60 font-medium italic">No flight plan available</div>;
      try {
        const waypoints = JSON.parse(aircraft.flightPlan);
        return (
          <div className="h-full overflow-y-auto px-3 pb-3 mt-2">
            <div className="text-xs font-semibold text-white/90 mb-2 uppercase tracking-wide">Flight Plan</div>
            {waypoints.map((wp: any, i: number) => (
              <div key={i} className="p-2.5 mb-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 transition cursor-pointer" onClick={() => onWaypointClick?.(wp, i)}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-semibold text-white">{wp.ident}</span>
                  <span className="text-[10px] text-white/60 uppercase">{wp.type}</span>
                </div>
                <div className="text-xs text-white/70 flex gap-3">
                  <span>Alt: <strong>{wp.alt ? `${wp.alt} ft` : "N/A"}</strong></span>
                  <span>Spd: <strong>{wp.spd ? `${wp.spd} kt` : "N/A"}</strong></span>
                </div>
              </div>
            ))}
          </div>
        );
      } catch { return <div className="p-4 text-center text-sm text-red-400/80">Error loading flight plan</div>; }
    }, [aircraft.flightPlan, onWaypointClick]);

    const baseStyle = "backdrop-blur-lg text-white flex flex-col z-50 transition-all overflow-hidden";

    return (
      <div
        ref={containerRef}
        style={{ transform: `translateY(${dragOffset}px)`, height: isMobile ? (isExpanded ? "88vh" : "180px") : undefined }}
        className={isMobile
            ? `${baseStyle} fixed bottom-0 left-0 right-0 bg-gray-900/95 border-t border-white/10 rounded-t-xl shadow-2xl`
            : `${baseStyle} absolute top-0 right-0 w-[340px] h-full bg-gray-900/95 border-l border-white/10 shadow-xl`}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      >
        {isMobile && (
          <div className="flex justify-center py-2 cursor-grab">
            <div className="w-10 h-1 bg-white/30 rounded-full" />
          </div>
        )}

        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-white/10 px-4 py-3 flex items-center gap-3">
          <div className="relative">
            {displayLogo ? (
              <img 
                src={displayLogo} 
                alt="Airline Logo" 
                className="w-12 h-12 rounded bg-black/40 object-contain border border-white/10"
              />
            ) : (
              <div className="w-12 h-12 rounded bg-white/5 border border-dashed border-white/20 flex items-center justify-center text-white/20">
                 <TbPlane size={24} />
              </div>
            )}
            {isPremium && (
              <div className="absolute -top-1.5 -right-1.5 bg-yellow-500 text-black text-[8px] font-black px-1 rounded shadow-sm">
                PRO
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg leading-tight truncate">
              {aircraft.callsign || aircraft.flightNo || "N/A"}
            </div>
            <div className="text-xs text-white/60 font-medium truncate uppercase tracking-tighter">
              {aircraft.type || "Unknown Type"}
            </div>
          </div>
        </div>

        <div className="flex border-b border-white/10 bg-black/20">
          <button 
            onClick={() => setTab("info")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[11px] font-bold tracking-wider transition ${tab === "info" ? "text-white border-b-2 border-blue-500" : "text-white/40"}`}
          >
            <TbInfoCircle size={16} /> LIVE INFO
          </button>
          <button 
            onClick={() => setTab("history")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[11px] font-bold tracking-wider transition ${tab === "history" ? "text-white border-b-2 border-blue-500" : "text-white/40"}`}
          >
            <TbHistory size={16} /> HISTORY
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {tab === "info" ? (
            <div className="p-3 flex flex-col gap-2">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5">
                <div className="text-[10px] uppercase text-white/60 font-semibold mb-1">Callsign</div>
                <div className="text-sm font-semibold">{aircraft.flightNo || "N/A"}</div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 text-center bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
                  <div className="text-sm font-semibold">{aircraft.departure || "UNK"}</div>
                </div>
                <div className="flex flex-col items-center justify-center w-12 text-center text-white">
                  {getPhaseIcon(currentFlightPhase)}
                  <div className="text-[9px] uppercase text-white/50 mt-1">{phaseTextMap[currentFlightPhase]}</div>
                </div>
                <div className="flex-1 text-center bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                  <div className="text-sm font-semibold">{aircraft.arrival || "UNK"}</div>
                </div>
              </div>

              {(isExpanded || !isMobile) && (
                <div className="grid grid-cols-2 gap-2 bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm">
                  <Detail label="Alt MSL" value={displayAltMSL} />
                  <Detail label="Alt AGL" value={`${altAGL.toFixed(0)} ft`} />
                  <Detail label="V-Speed" value={`${aircraft.vspeed || 0} fpm`} />
                  <Detail label="Speed" value={`${aircraft.speed?.toFixed(0)} kt`} />
                  <Detail label="Heading" value={`${aircraft.heading?.toFixed(0)}°`} />
                  <Detail label="Squawk" value={aircraft.squawk || "N/A"} />
                </div>
              )}

              {(isExpanded || !isMobile) && renderFlightPlan()}
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {isPremium ? (
                <>
                  {loadingHistory ? (
                    <div className="text-center py-10 text-white/50 animate-pulse text-xs uppercase font-bold">Fetching logs...</div>
                  ) : history.length === 0 ? (
                    <div className="text-center py-10 text-white/30 text-xs italic">No past flights found for this pilot.</div>
                  ) : (
                    history.map((f) => (
                      <div 
                        key={f.id} 
                        onClick={() => {
                            setSelectedFlightId(f.id);
                            if (f.routeData) onHistoryClick?.(f.routeData as [number, number][]);
                        }}
                        className={`bg-white/5 border transition cursor-pointer rounded-lg p-3 ${selectedFlightId === f.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 hover:bg-white/10'}`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-bold text-white">{f.depICAO || "???"} → {f.arrICAO || "???"}</span>
                          <span className="text-[10px] text-white/40">{new Date(f.startTime).toLocaleDateString()}</span>
                        </div>
                        <div className="text-[10px] text-white/50 uppercase italic font-medium">{f.aircraftType || "Unknown"}</div>
                      </div>
                    ))
                  )}
                </>
              ) : (
                <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-200/80 text-center leading-relaxed">
                  <div className="font-bold mb-1 uppercase tracking-tight text-amber-400">Premium Feature</div>
                  Automatic flight logging and history tracking is restricted to Premium pilots.
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

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[10px] uppercase text-white/50 font-semibold mb-0.5">{label}</div>
    <div className="font-semibold text-sm truncate">{value}</div>
  </div>
);