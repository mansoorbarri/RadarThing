"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";

type SheetState = "half" | "full" | "closed";

interface MobileSwipeSheetProps {
  children: React.ReactNode;
  onClose: () => void;
  initialState?: SheetState;
}

export const MobileSwipeSheet = ({
  children,
  onClose,
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

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
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
    const baseHeight = heights[state];
    if (!isDragging || state === "closed") return `${baseHeight}dvh`;

    // Convert drag offset (pixels) to vh adjustment
    const windowHeight = window.innerHeight;
    const vhPerPixel = 100 / windowHeight;
    const adjustment = dragOffset * vhPerPixel;

    // Clamp the height
    const newHeight = Math.min(92, Math.max(0, baseHeight + adjustment));
    return `${newHeight}dvh`;
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [requestClose]);

  useEffect(
    () => () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    },
    [],
  );

  return (
    <div className="fixed inset-0 z-[10014]">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 bg-black/45"
        onClick={requestClose}
      />

      <div
        className={`absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/10 bg-black/90 backdrop-blur-xl ${
          isDragging ? "" : "transition-[height] duration-200 ease-out"
        }`}
        style={{ height: getHeight() }}
      >
        {/* Drag handle */}
        <div
          className="flex touch-none items-center justify-center pt-3 pb-2"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="h-1.5 w-12 rounded-full bg-white/30" />
        </div>

        {/* Content */}
        <div className="h-[calc(100%-28px)] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom,0px)]">
          {children}
        </div>
      </div>
    </div>
  );
};
