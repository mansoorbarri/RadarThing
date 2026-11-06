"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { CircleHelp, X } from "lucide-react";

const DISMISSED_KEY = "radarthing-tour-hint-dismissed";

/**
 * The guided tour opens by itself only for signed-in users (their progress
 * is stored on the account). First-time visitors who aren't signed in get
 * this one-time offer instead, remembered on the device.
 */
export function FirstVisitTourHint({
  ready,
  hidden,
  onStartTour,
}: {
  /** True once the radar has painted, so the hint doesn't flash in early. */
  ready: boolean;
  hidden: boolean;
  onStartTour: () => void;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ready || !isLoaded || isSignedIn) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      return;
    }
    setVisible(true);
  }, [ready, isLoaded, isSignedIn]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    } catch {
      // Private mode: the hint just shows again next visit.
    }
  }, []);

  if (!visible || hidden) return null;

  return (
    <section
      role="status"
      aria-label="Radar tour"
      // Escape dismisses it only while focus is inside the offer, so Escape
      // used elsewhere on the radar (search, deselecting) never hides it.
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          dismiss();
        }
      }}
      className="animate-fade-in-up pointer-events-auto fixed top-[calc(4rem+env(safe-area-inset-top))] right-3 left-[3.75rem] z-[10014] flex items-center gap-3 rounded-xl border border-cyan-400/30 bg-[#06121a]/95 p-3 text-sm text-slate-200 shadow-lg shadow-black/40 sm:top-20 sm:right-auto sm:left-1/2 sm:w-[32rem] sm:-translate-x-1/2"
    >
      <CircleHelp
        className="hidden h-5 w-5 shrink-0 text-cyan-300 sm:block"
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 leading-snug">
        New here? A short tour shows you search, flight details, map layers and
        charts.
      </p>
      <button
        type="button"
        onClick={() => {
          dismiss();
          onStartTour();
        }}
        className="shrink-0 cursor-pointer rounded-lg bg-cyan-400 px-3 py-2 text-xs font-semibold text-black hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none"
      >
        Take the tour
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss tour offer"
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </section>
  );
}
