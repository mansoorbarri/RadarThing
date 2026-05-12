"use client";

import { useMemo, useRef, useState } from "react";
import {
  Clock3,
  FileJson,
  MapPinned,
  Route,
  X,
} from "lucide-react";
import {
  getImportedFlightPlanSummary,
  type ImportedFlightPlan,
} from "~/lib/flightPlanImport";

interface ImportedFlightPlanPanelProps {
  flightPlan: ImportedFlightPlan;
  onClose: () => void;
  isMobile?: boolean;
}

function formatDuration(totalMinutes: number) {
  const roundedMinutes = Math.max(1, Math.round(totalMinutes));
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatAltitude(value: number | null) {
  if (value === null) return "N/A";
  if (value >= 18000) return `FL${Math.round(value / 100)}`;
  return `${Math.round(value).toLocaleString()} ft`;
}

function formatSpeed(value: string | number | null) {
  if (value === null || value === "") return "AUTO";
  return `${value} kt`;
}

export function ImportedFlightPlanPanel({
  flightPlan,
  onClose,
  isMobile = false,
}: ImportedFlightPlanPanelProps) {
  const summary = useMemo(
    () => getImportedFlightPlanSummary(flightPlan),
    [flightPlan],
  );
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingHeader, setIsDraggingHeader] = useState(false);
  const touchStartYRef = useRef(0);

  const handleHeaderTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    const touch = e.touches[0];
    if (!touch) return;
    touchStartYRef.current = touch.clientY;
    setIsDraggingHeader(true);
  };

  const handleHeaderTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile || !isDraggingHeader) return;
    const touch = e.touches[0];
    if (!touch) return;
    const deltaY = touch.clientY - touchStartYRef.current;
    setDragOffset(Math.max(0, Math.min(96, deltaY)));
  };

  const handleHeaderTouchEnd = () => {
    if (!isMobile) return;
    const shouldClose = dragOffset > 64;
    setIsDraggingHeader(false);
    setDragOffset(0);
    if (shouldClose) {
      onClose();
    }
  };

  return (
    <aside
      className={`pointer-events-auto fixed z-[10014] flex flex-col overflow-hidden border border-cyan-400/20 bg-black/86 text-slate-100 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl ${
        isMobile
          ? "top-16 right-3 left-3 bottom-20 rounded-2xl"
          : "top-20 right-6 max-h-[calc(100vh-6.5rem)] w-[380px] rounded-3xl"
      }`}
      style={{
        transform:
          isMobile && dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
        transition: isDraggingHeader ? "none" : "transform 180ms ease-out",
      }}
    >
      <div
        className="border-b border-cyan-400/15 bg-gradient-to-r from-cyan-400/10 via-transparent to-emerald-400/10 px-4 py-4"
        onTouchStart={handleHeaderTouchStart}
        onTouchMove={handleHeaderTouchMove}
        onTouchEnd={handleHeaderTouchEnd}
        onTouchCancel={handleHeaderTouchEnd}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-medium tracking-[0.28em] text-cyan-300 uppercase">
              <Route size={14} strokeWidth={1.8} />
              Imported Plan
            </div>
            <h2 className="truncate font-mono text-lg font-semibold text-white">
              {flightPlan.displayName}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <FileJson size={13} strokeWidth={1.8} />
              <span className="truncate">{flightPlan.sourceName}.json</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close imported flight plan panel"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] tracking-[0.22em] text-slate-400 uppercase">
              <MapPinned size={13} strokeWidth={1.8} />
              Distance
            </div>
            <div className="font-mono text-xl font-semibold text-white">
              {summary.totalDistanceNm.toFixed(0)} nm
            </div>
            <div className="text-xs text-slate-500">
              {summary.totalDistanceKm.toFixed(0)} km total
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] tracking-[0.22em] text-slate-400 uppercase">
              <Clock3 size={13} strokeWidth={1.8} />
              Approx Time
            </div>
            <div className="font-mono text-xl font-semibold text-white">
              {formatDuration(summary.totalDurationMinutes)}
            </div>
            <div className="text-xs text-slate-500">
              Uses plan speeds when present
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-white/6 px-4 py-3 text-xs text-slate-400">
        Missing speed entries fall back to an altitude-based estimate, so time is approximate.
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 touch-pan-y">
        <div className="space-y-3 pb-4">
          {flightPlan.waypoints.map((waypoint, index) => {
            const leg = index > 0 ? summary.legs[index - 1] : null;

            return (
              <div
                key={`${waypoint.ident}-${index}`}
                className="rounded-2xl border border-white/8 bg-white/[0.045] px-3 py-3"
              >
                {leg ? (
                  <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-cyan-400/10 bg-cyan-400/6 px-3 py-2 text-[11px] text-cyan-100">
                    <span className="truncate">
                      {leg.fromIdent} to {leg.toIdent}
                    </span>
                    <span className="shrink-0 font-mono">
                      {leg.distanceNm.toFixed(0)} nm /{" "}
                      {formatDuration(leg.estimatedDurationMinutes)}
                    </span>
                  </div>
                ) : null}

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-400/10 font-mono text-xs text-cyan-200">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-sm font-semibold text-white">
                          {waypoint.ident}
                        </div>
                        <div className="text-[11px] tracking-[0.2em] text-slate-500 uppercase">
                          {waypoint.type}
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-slate-400">
                        <div>{formatAltitude(waypoint.alt)}</div>
                        <div>{formatSpeed(waypoint.spd)}</div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                      <div>
                        LAT {waypoint.lat.toFixed(4)}
                      </div>
                      <div className="text-right">
                        LON {waypoint.lon.toFixed(4)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
