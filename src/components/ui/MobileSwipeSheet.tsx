"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { FocusTrap } from "~/components/ui/focus-trap";
import { useBackToClose } from "~/hooks/useBackToClose";

type SheetState = "half" | "full" | "closed";

interface MobileSwipeSheetProps {
  children: React.ReactNode;
  onClose: () => void;
  /** Title shown at the top of the sheet and used as its accessible name. */
  label: string;
  /** Hide the visible title when the content already has its own heading. */
  hideTitle?: boolean;
  /** Start only as tall as the content (up to half the screen). */
  fitContent?: boolean;
  initialState?: SheetState;
}

export const MobileSwipeSheet = ({
  children,
  onClose,
  label,
  hideTitle = false,
  fitContent = false,
  initialState = "half",
}: MobileSwipeSheetProps) => {
  const [state, setState] = useState<SheetState>(initialState);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const closeTimeoutRef = useRef<number | null>(null);

  // Heights for each state (in vh)
  const heights: Record<SheetState, number> = {
    half: 50,
    full: 92,
    closed: 0,
  };

  const requestClose = useCallback(() => {
    // A content-sized sheet has no fixed height to animate from, so pin it
    // to its current height first, then let it slide to 0.
    const panel = panelRef.current;
    if (panel && !panel.style.height) {
      panel.style.height = `${panel.getBoundingClientRect().height}px`;
      void panel.offsetHeight;
    }
    setIsDragging(false);
    setDragOffset(0);
    setState("closed");

    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      onClose();
    }, 200);
  }, [onClose]);

  // The first sheet someone opens explains how to expand it, once.
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("radarthing-swipe-hint-shown")) return;
      localStorage.setItem("radarthing-swipe-hint-shown", "1");
      setShowSwipeHint(true);
    } catch {
      // Storage unavailable: skip the hint.
    }
  }, []);
  const panelRef = useRef<HTMLDivElement>(null);
  // The sheet's real height (in dvh) when a drag starts, so a sheet that
  // fits its content doesn't jump to half-screen the moment it's touched.
  const dragBaseRef = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Taps on the header buttons are taps, not drags.
    if ((e.target as Element).closest("button")) return;
    const touch = e.touches[0];
    if (!touch) return;
    const panelHeight = panelRef.current?.getBoundingClientRect().height;
    dragBaseRef.current = panelHeight
      ? (panelHeight / window.innerHeight) * 100
      : null;
    startYRef.current = touch.clientY;
    currentYRef.current = touch.clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      if (!touch) return;

      currentYRef.current = touch.clientY;
      const delta = startYRef.current - currentYRef.current;
      setDragOffset(delta);
    },
    [isDragging],
  );

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const delta = startYRef.current - currentYRef.current;
    const threshold = 50; // minimum swipe distance in pixels

    if (state === "half") {
      if (delta > threshold) {
        // Swiped up - expand to full
        setState("full");
      } else if (delta < -threshold) {
        requestClose();
      }
    } else if (state === "full") {
      if (delta < -threshold) {
        // Swiped down - go to half or close based on distance
        if (delta < -150) {
          requestClose();
        } else {
          setState("half");
        }
      }
    }

    setDragOffset(0);
  }, [isDragging, requestClose, state]);

  // Calculate current height based on state and drag
  const getHeight = () => {
    const baseHeight =
      isDragging && dragBaseRef.current !== null
        ? dragBaseRef.current
        : heights[state];
    if (!isDragging || state === "closed") return `${baseHeight}dvh`;

    // Convert drag offset (pixels) to vh adjustment
    const windowHeight = window.innerHeight;
    const vhPerPixel = 100 / windowHeight;
    const adjustment = dragOffset * vhPerPixel;

    // Clamp the height
    const newHeight = Math.min(92, Math.max(0, baseHeight + adjustment));
    return `${newHeight}dvh`;
  };

  // Android Back closes the sheet instead of leaving the radar.
  useBackToClose(true, requestClose);

  useEffect(
    () => () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    },
    [],
  );

  return (
    // Above the flight drawer (z-10015), so a sheet opened while a flight is
    // selected is never covered by it.
    <div className="fixed inset-0 z-[10016]">
      <button
        type="button"
        // Tap-outside target only; the header has the real close button.
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 bg-black/45"
        onClick={requestClose}
      />

      <FocusTrap
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onEscape={requestClose}
        className={`absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl border-t border-white/10 bg-black/90 backdrop-blur-xl ${
          isDragging ? "" : "transition-[height] duration-200 ease-out"
        }`}
        containerRef={panelRef}
        style={
          fitContent && state === "half" && !isDragging
            ? { maxHeight: "60dvh" }
            : { height: getHeight() }
        }
      >
        {/* Drag handle: swipe up to expand, down to collapse or close. The
            same actions are buttons for keyboard and screen-reader users. */}
        <div
          className="flex shrink-0 touch-none items-center justify-between gap-2 px-3 pt-2 pb-1"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Spacer so the title stays centred between the two sides. */}
          <span aria-hidden="true" className="w-20 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col items-center">
            <div
              aria-hidden="true"
              className="h-1.5 w-12 rounded-full bg-white/30"
            />
            {!hideTitle && (
              <h2 className="mt-1.5 truncate text-sm font-semibold text-white">
                {label}
              </h2>
            )}
            {showSwipeHint && (
              <p className="mt-0.5 text-[11px] text-slate-400">
                Swipe up or tap ⌃ for more
              </p>
            )}
          </div>
          <div className="flex w-20 shrink-0 justify-end">
            <button
              type="button"
              onClick={() => setState(state === "full" ? "half" : "full")}
              aria-expanded={state === "full"}
              aria-label={state === "full" ? "Collapse panel" : "Expand panel"}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={state === "full" ? "rotate-180" : ""}
              >
                <path d="m6 15 6-6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={requestClose}
              aria-label={`Close ${label.toLowerCase()}`}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom,0px)]">
          {children}
        </div>
      </FocusTrap>
    </div>
  );
};
