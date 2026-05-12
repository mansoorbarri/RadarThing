"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

interface MobileDrawerProps {
  children: React.ReactNode;
  onClose: () => void;
}

type DrawerState = "minimized" | "partial" | "full";

const DRAWER_HEIGHTS: Record<DrawerState, number> = {
  minimized: 14,
  partial: 40,
  full: 92,
};

const SNAP_ORDER: DrawerState[] = ["minimized", "partial", "full"];

export const MobileDrawer = ({ children, onClose }: MobileDrawerProps) => {
  const [drawerState, setDrawerState] = useState<DrawerState>("partial");
  const [height, setHeight] = useState(DRAWER_HEIGHTS.partial);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(DRAWER_HEIGHTS.partial);
  const heightRef = useRef(DRAWER_HEIGHTS.partial);

  useEffect(() => {
    heightRef.current = height;
  }, [height]);

  const snapToNearestState = useCallback((nextHeight: number) => {
    const nextState = SNAP_ORDER.reduce((closest, state) => {
      const closestDistance = Math.abs(
        DRAWER_HEIGHTS[closest] - nextHeight,
      );
      const currentDistance = Math.abs(DRAWER_HEIGHTS[state] - nextHeight);
      return currentDistance < closestDistance ? state : closest;
    }, "partial" as DrawerState);

    setDrawerState(nextState);
    setHeight(DRAWER_HEIGHTS[nextState]);
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const deltaPx = dragStartYRef.current - e.clientY;
      const deltaVh = (deltaPx / window.innerHeight) * 100;
      const nextHeight = Math.min(
        DRAWER_HEIGHTS.full,
        Math.max(
          DRAWER_HEIGHTS.minimized,
          dragStartHeightRef.current + deltaVh,
        ),
      );
      setHeight(nextHeight);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      snapToNearestState(heightRef.current);
      document.body.style.userSelect = "";
    };

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDragging, snapToNearestState]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragStartYRef.current = e.clientY;
      dragStartHeightRef.current = height;
      setIsDragging(true);
    },
    [height],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[10015]">
      <div
        className={`pointer-events-auto fixed inset-x-0 bottom-0 overflow-hidden rounded-t-[28px] border-t border-white/10 bg-black/95 shadow-[0_-24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl ${
          isDragging ? "" : "transition-[height] duration-250 ease-out"
        }`}
        style={{ height: `${height}dvh` }}
      >
        <div className="flex h-full flex-col">
          <div
            onPointerDown={handlePointerDown}
            className="flex touch-none justify-center border-b border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent px-4 pt-3 pb-2"
          >
            <div className="h-1.5 w-12 rounded-full bg-white/35" />
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom,0px)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
