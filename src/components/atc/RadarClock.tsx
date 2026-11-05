"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, X } from "lucide-react";
import { useDisplayedTime } from "~/hooks/useDisplayedTime";
import { useTimer } from "~/hooks/useTimer";
import { FocusTrap } from "~/components/ui/focus-trap";

/*
 * The radar clock and stopwatch tick every second. They live in their own
 * components so those ticks re-render only the clock, not the whole radar
 * page (header, dock, sidebars and map controls).
 */

type Timer = ReturnType<typeof useTimer>;

const TimerContext = createContext<Timer | null>(null);

/**
 * Holds the stopwatch above the parts of the UI that come and go (hiding the
 * UI, switching between phone and desktop layouts), so a running timer keeps
 * its time. Only context consumers re-render on each tick; the radar page
 * passed in as children does not.
 */
export function RadarTimerProvider({ children }: { children: ReactNode }) {
  const timer = useTimer();
  return (
    <TimerContext.Provider value={timer}>{children}</TimerContext.Provider>
  );
}

function useRadarTimer(): Timer {
  const timer = useContext(TimerContext);
  if (!timer)
    throw new Error("Radar clocks must be rendered inside RadarTimerProvider");
  return timer;
}

interface ClockProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function TimerControls({
  formattedTime,
  isRunning,
  start,
  stop,
  reset,
}: Timer) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/90 p-3 backdrop-blur-xl">
      {/* Not a live region: it ticks every second. Start/Stop/Reset are
          announced through the status line below instead. */}
      <div className="mb-2 font-mono text-sm text-emerald-400">
        {formattedTime}
      </div>
      <span className="sr-only" role="status">
        {isRunning ? "Timer running" : "Timer stopped"}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={start}
          disabled={isRunning}
          className="min-h-9 cursor-pointer rounded-lg bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300 disabled:opacity-50"
        >
          Start
        </button>
        <button
          type="button"
          onClick={stop}
          disabled={!isRunning}
          className="min-h-9 cursor-pointer rounded-lg bg-red-500/20 px-3 py-1 text-xs text-red-300 disabled:opacity-50"
        >
          Stop
        </button>
        <button
          type="button"
          onClick={reset}
          className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-slate-500/20 px-3 py-1 text-xs text-slate-300"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset
        </button>
      </div>
    </div>
  );
}

export function DesktopRadarClock({
  open,
  onOpenChange,
  isTablet,
}: ClockProps & { isTablet: boolean }) {
  const { time, zoneLabel } = useDisplayedTime();
  const timer = useRadarTimer();

  return (
    <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label={`${time} ${zoneLabel}. ${open ? "Close" : "Open"} timer`}
        className={`cursor-pointer rounded-lg border border-white/10 bg-black/75 backdrop-blur-md ${isTablet ? "px-3 py-1" : "px-4 py-1.5"}`}
      >
        <span
          className={`font-mono text-cyan-400 ${isTablet ? "text-base" : "text-xl"}`}
        >
          {time} <span className="text-[11px] text-slate-400">{zoneLabel}</span>
        </span>
        {timer.isRunning && (
          <span className="block animate-pulse text-[11px] tracking-widest text-emerald-400">
            Timer active
          </span>
        )}
      </button>

      {open && (
        <div className="animate-fade-in-up absolute top-full left-1/2 mt-2 -translate-x-1/2">
          <TimerControls {...timer} />
        </div>
      )}
    </div>
  );
}

export function PhoneRadarClock({ open, onOpenChange }: ClockProps) {
  const { time, zoneLabel } = useDisplayedTime();
  const timer = useRadarTimer();

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label={`${time} ${zoneLabel}. ${open ? "Close" : "Open"} timer`}
        // On the narrowest phones (under 360px) the clock gives way so status,
        // What's New and the account menu still fit; the dock opens the timer.
        className="flex h-9 items-center justify-center rounded-lg border border-white/10 bg-black/75 px-2.5 backdrop-blur-md max-[359px]:hidden"
      >
        <span className="flex h-full items-center justify-center gap-1 font-mono text-[11px] leading-none text-cyan-400">
          <span className="leading-none">{time}</span>
          <span className="text-[11px] leading-none text-slate-400">
            {zoneLabel}
          </span>
        </span>
      </button>

      {/* Portaled to <body> so the popup sits above the dock and drawer
          instead of inside the header's stacking layer. */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Tap outside to close */}
            <div
              className="fixed inset-0 z-[10040]"
              aria-hidden="true"
              onClick={() => onOpenChange(false)}
            />
            <FocusTrap
              onEscape={() => onOpenChange(false)}
              role="dialog"
              aria-label="Clock and timer"
              className="animate-fade-in-up pointer-events-auto fixed top-16 right-3 z-[10041]"
            >
              <div className="mb-1 flex items-center justify-end gap-2 font-mono text-xs text-cyan-300">
                <span>
                  {time} {zoneLabel}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close timer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/70 text-white/70"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <TimerControls {...timer} />
            </FocusTrap>
          </>,
          document.body,
        )}
    </>
  );
}
