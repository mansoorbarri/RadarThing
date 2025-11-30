"use client";

import React, { useMemo, useState, useRef, useCallback } from "react";
import {
  TbPlaneInflight,
  TbPlaneDeparture,
  TbPlane,
  TbPlaneArrival,
} from "react-icons/tb";
import { type PositionUpdate } from "~/lib/aircraft-store";

const getFlightPhase = (altAGL: number, vspeed: number, flightPlan?: string) => {
  const isOnGround = altAGL < 100;
  const isClimbing = vspeed > 200;
  const isDescending = vspeed < -200;

  if (isOnGround) return "onGround";
  if (isClimbing) return "climbing";
  if (isDescending) return flightPlan && altAGL < 5000 ? "landing" : "descending";
  if (altAGL > 5000) return "cruising";
  return "unknown";
};

export const Sidebar = React.memo(
  ({
    aircraft,
    onWaypointClick,
    isMobile,
  }: {
    aircraft: PositionUpdate & { altMSL?: number };
    onWaypointClick?: (waypoint: any, index: number) => void;
    isMobile: boolean;
  }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [dragStart, setDragStart] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const altMSL = aircraft.altMSL ?? aircraft.alt;
    const altAGL = aircraft.alt;

    const currentFlightPhase = useMemo(
      () => getFlightPhase(altAGL, Number(aircraft.vspeed), aircraft.flightPlan),
      [altAGL, aircraft.vspeed, aircraft.flightPlan],
    );

    const getPhaseIcon = (phase: string) => {
      const iconProps = { size: 20, strokeWidth: 1.4, color: "#fff" };
      switch (phase) {
        case "climbing":
          return <TbPlaneDeparture {...iconProps} />;
        case "cruising":
          return <TbPlaneInflight {...iconProps} />;
        case "descending":
        case "landing":
          return <TbPlaneArrival {...iconProps} />;
        default:
          return <TbPlane {...iconProps} />;
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
        : `${altMSL.toFixed(0)} ft`;

    // Touch handlers
    const handleTouchStart = (e: React.TouchEvent) => {
      if (!isMobile || !e.touches[0]) return;
      setDragStart(e.touches[0].clientY);
    };
    const handleTouchMove = (e: React.TouchEvent) => {
      if (!isMobile || dragStart === null || !e.touches[0]) return;
      setDragOffset(e.touches[0].clientY - dragStart);
    };
    const handleTouchEnd = () => {
      if (!isMobile || dragStart === null) return;
      if (dragOffset > 80) setIsExpanded(false);
      else if (dragOffset < -80) setIsExpanded(true);
      setDragStart(null);
      setDragOffset(0);
    };

    const renderFlightPlan = useCallback(() => {
      if (!aircraft.flightPlan)
        return (
          <div className="p-4 text-center text-sm text-white/60">
            No flight plan available
          </div>
        );
      try {
        const waypoints = JSON.parse(aircraft.flightPlan);
        return (
          <div className="h-full overflow-y-auto px-3 pb-3">
            <div className="text-xs font-semibold text-white/90 mb-2 uppercase tracking-wide">
              Flight Plan
            </div>
            {waypoints.map((wp: any, i: number) => (
              <div
                key={i}
                className="p-2.5 mb-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 transition cursor-pointer"
                onClick={() => onWaypointClick?.(wp, i)}
              >
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-semibold text-white">
                    {wp.ident}
                  </span>
                  <span className="text-[10px] text-white/60 uppercase">
                    {wp.type}
                  </span>
                </div>
                <div className="text-xs text-white/70 flex gap-3">
                  <span>
                    Alt: <strong>{wp.alt ? `${wp.alt} ft` : "N/A"}</strong>
                  </span>
                  <span>
                    Spd: <strong>{wp.spd ? `${wp.spd} kt` : "N/A"}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      } catch {
        return (
          <div className="p-4 text-center text-sm text-red-400/80">
            Error loading flight plan
          </div>
        );
      }
    }, [aircraft.flightPlan, onWaypointClick]);

    const baseStyle =
      "backdrop-blur-lg text-white flex flex-col z-50 transition-all overflow-hidden";

    return (
      <div
        ref={containerRef}
        style={{
          transform: `translateY(${dragOffset}px)`,
          height: isMobile ? (isExpanded ? "88vh" : "180px") : undefined,
        }}
        className={
          isMobile
            ? `${baseStyle} fixed bottom-0 left-0 right-0 bg-gray-900/95 border-t border-white/10 rounded-t-xl shadow-2xl`
            : `${baseStyle} absolute top-0 right-0 w-[340px] h-full bg-gray-900/95 border-l border-white/10 shadow-xl`
        }
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* --- Drag Handle (Mobile) --- */}
        {isMobile && (
          <div className="flex justify-center py-2 cursor-grab">
            <div className="w-10 h-1 bg-white/30 rounded-full" />
          </div>
        )}

        {/* --- Header --- */}
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-white/10 px-4 py-2.5">
          <div className="font-bold text-lg leading-tight">
            {aircraft.callsign || aircraft.flightNo || "N/A"}
          </div>
          <div className="text-xs text-white/60 font-medium">
            {aircraft.type || "Unknown Type"}
          </div>
        </div>

        {/* --- Flight Info Section --- */}
        <div
          className={`flex flex-col gap-2 p-3 ${
            isMobile && !isExpanded ? "overflow-hidden" : "overflow-y-auto"
          }`}
        >
          {/* Callsign Block */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5">
            <div className="text-[10px] uppercase text-white/60 font-semibold mb-1">
              Callsign
            </div>
            <div className="text-sm font-semibold">
              {aircraft.flightNo || "N/A"}
            </div>
          </div>

          {/* Route / Phase */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 text-center bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
              <div className="text-sm font-semibold">
                {aircraft.departure || "UNK"}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center w-12 text-center text-white">
              {getPhaseIcon(currentFlightPhase)}
              <div className="text-[9px] uppercase text-white/50 mt-1">
                {phaseTextMap[currentFlightPhase]}
              </div>
            </div>

            <div className="flex-1 text-center bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
              <div className="text-sm font-semibold">
                {aircraft.arrival || "UNK"}
              </div>
            </div>
          </div>

          {/* MSL / AGL / Speed / Heading */}
          {(isExpanded || !isMobile) && (
            <div className="grid grid-cols-2 gap-2 bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm">
              <Detail label="Alt MSL" value={displayAltMSL} />
              <Detail label="Alt AGL" value={`${altAGL.toFixed(0)} ft`} />
              <Detail
                label="V-Speed"
                value={`${aircraft.vspeed || 0} fpm`}
              />
              <Detail
                label="Speed"
                value={`${aircraft.speed?.toFixed(0)} kt`}
              />
              <Detail
                label="Heading"
                value={`${aircraft.heading?.toFixed(0)}°`}
              />
              <Detail label="Squawk" value={aircraft.squawk || "N/A"} />
              {aircraft.nextWaypoint && (
                <Detail label="Next WPT" value={aircraft.nextWaypoint} />
              )}
            </div>
          )}

          {/* --- Flight Plan --- */}
          {(isExpanded || !isMobile) && (
            <div className="flex-1 mt-2">{renderFlightPlan()}</div>
          )}
        </div>
      </div>
    );
  },
);

Sidebar.displayName = "Sidebar";

// Helper subcomponent
const Detail = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[10px] uppercase text-white/50 font-semibold mb-0.5">
      {label}
    </div>
    <div className="font-semibold text-sm truncate">{value}</div>
  </div>
);