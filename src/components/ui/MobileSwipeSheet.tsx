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
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  // Heights for each state (in vh)
  const heights: Record<SheetState, number> = {
    half: 50,
    full: 92,
    closed: 0,
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startYRef.current = touch.clientY;
    currentYRef.current = touch.clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    if (!touch) return;

    currentYRef.current = touch.clientY;
    const delta = startYRef.current - currentYRef.current;
    setDragOffset(delta);
  }, [isDragging]);

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
        // Swiped down - close
        setState("closed");
        setTimeout(onClose, 200);
      }
    } else if (state === "full") {
      if (delta < -threshold) {
        // Swiped down - go to half or close based on distance
        if (delta < -150) {
          setState("closed");
          setTimeout(onClose, 200);
        } else {
          setState("half");
        }
      }
    }

    setDragOffset(0);
  }, [isDragging, state, onClose]);

  // Calculate current height based on state and drag
  const getHeight = () => {
    const baseHeight = heights[state];
    if (!isDragging || state === "closed") return `${baseHeight}vh`;

    // Convert drag offset (pixels) to vh adjustment
    const windowHeight = window.innerHeight;
    const vhPerPixel = 100 / windowHeight;
    const adjustment = dragOffset * vhPerPixel;

    // Clamp the height
    const newHeight = Math.min(92, Math.max(0, baseHeight + adjustment));
    return `${newHeight}vh`;
  };

  // Close when state becomes closed
  useEffect(() => {
    if (state === "closed") {
      onClose();
    }
  }, [state, onClose]);

  return (
    <div
      ref={sheetRef}
      className={`fixed inset-x-0 bottom-0 z-[10014] rounded-t-3xl border-t border-white/10 bg-black/90 backdrop-blur-xl ${
        isDragging ? "" : "transition-[height] duration-200 ease-out"
      }`}
      style={{ height: getHeight() }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Drag handle */}
      <div className="flex items-center justify-center pt-3 pb-1 touch-none">
        <div className="h-1.5 w-12 rounded-full bg-white/30" />
      </div>

      {/* Content */}
      <div className="h-[calc(100%-24px)] overflow-hidden">
        {children}
      </div>
    </div>
  );
};
