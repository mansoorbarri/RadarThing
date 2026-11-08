"use client";

import { useBackToClose } from "~/hooks/useBackToClose";

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
      const closestDistance = Math.abs(DRAWER_HEIGHTS[closest] - nextHeight);
      const currentDistance = Math.abs(DRAWER_HEIGHTS[state] - nextHeight);
      return currentDistance < closestDistance ? state : closest;
    }, "partial" as DrawerState);

    setHeight(DRAWER_HEIGHTS[nextState]);
  }, []);

  const drawerRef = useRef<HTMLDivElement>(null);
  // Android Back closes the flight details instead of leaving the radar.
  useBackToClose(true, onClose);
  useEffect(() => {
    const drawer = drawerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    drawer?.focus({ preventScroll: true });
    // The drawer is non-modal: if the user has tabbed out to the map, closing
    // it must not pull focus back. Only restore focus that was inside it.
    let focusInside = true;
    const onFocusIn = () => (focusInside = true);
    const onFocusOut = (event: FocusEvent) => {
      if (!drawer?.contains(event.relatedTarget as Node | null))
        focusInside = false;
    };
    drawer?.addEventListener("focusin", onFocusIn);
    drawer?.addEventListener("focusout", onFocusOut);
    return () => {
      drawer?.removeEventListener("focusin", onFocusIn);
      drawer?.removeEventListener("focusout", onFocusOut);
      const lostFocus =
        !document.activeElement || document.activeElement === document.body;
      if ((focusInside || lostFocus) && previouslyFocused?.isConnected)
        previouslyFocused.focus();
    };
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
    (e: React.PointerEvent<HTMLElement>) => {
      dragStartYRef.current = e.clientY;
      dragStartHeightRef.current = height;
      setIsDragging(true);
    },
    [height],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[10015]">
      <div
        ref={drawerRef}
        data-tour="flight-details"
        // Non-modal: the map stays usable behind the drawer, so focus isn't
        // trapped, but it moves in on open and back out on close.
        role="dialog"
        aria-modal="false"
        aria-label="Flight details"
        tabIndex={-1}
        className={`pointer-events-auto fixed inset-x-0 bottom-0 overflow-hidden rounded-t-[28px] border-t border-white/10 bg-black/95 shadow-[0_-24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl focus:outline-none ${
          isDragging ? "" : "transition-[height] duration-250 ease-out"
        }`}
        style={{ height: `${height}dvh` }}
      >
        <div className="flex h-full flex-col">
          <div className="relative flex h-12 shrink-0 items-center border-b border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent">
            <button
              type="button"
              onPointerDown={handlePointerDown}
              onClick={(event) => {
                // Keyboard/assistive users can't drag; let a press cycle the
                // drawer size instead. (Pointer drags are handled above.)
                if (event.detail !== 0) return;
                const order = [
                  DRAWER_HEIGHTS.minimized,
                  DRAWER_HEIGHTS.partial,
                  DRAWER_HEIGHTS.full,
                ];
                const index = order.indexOf(heightRef.current);
                setHeight(order[(index + 1) % order.length]!);
              }}
              aria-label="Resize flight details"
              className="flex h-full flex-1 touch-none items-center justify-center px-14 focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-12 rounded-full bg-white/35"
              />
            </button>
            <button
              type="button"
              aria-label="Close flight details"
              onClick={onClose}
              className="absolute right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-2xl text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
