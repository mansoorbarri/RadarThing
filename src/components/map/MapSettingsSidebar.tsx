"use client";

import React from "react";

import { MobileSwipeSheet } from "~/components/ui/MobileSwipeSheet";
import { cn } from "~/lib/utils";

interface MapSettingsSidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapsed: () => void;
  children: React.ReactNode;
}

export const MapSettingsSidebar = ({
  isOpen,
  isMobile,
  isCollapsed,
  onClose,
  onToggleCollapsed,
  children,
}: MapSettingsSidebarProps) => {
  if (!isOpen) {
    return null;
  }

  if (isMobile) {
    return (
      <MobileSwipeSheet onClose={onClose} initialState="half">
        <div className="min-h-full bg-[#050f14]/95 p-3 pb-4">
          {children}
        </div>
      </MobileSwipeSheet>
    );
  }

  return (
    <aside
      className={cn(
        "animate-slide-in-left fixed inset-y-0 left-0 z-[10020] border-r border-white/10 bg-black/90 backdrop-blur-xl transition-[width] duration-300 ease-in-out",
        isCollapsed ? "w-12" : "w-full max-w-[360px] xl:max-w-[400px]",
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="absolute top-1/2 -right-3 z-10 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-slate-900 text-slate-400 shadow-lg transition-colors hover:bg-slate-800 hover:text-white"
        title={isCollapsed ? "Expand settings" : "Collapse settings"}
        aria-label={isCollapsed ? "Expand settings" : "Collapse settings"}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "transition-transform duration-300",
            !isCollapsed ? "rotate-180" : "",
          )}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {isCollapsed ? (
        <div className="flex h-full flex-col items-center py-6">
          <div className="mb-4 h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500 shadow-[0_0_8px_#22d3ee]" />
          <div
            className="font-mono text-[10px] font-bold tracking-wider text-cyan-400 uppercase"
            style={{ writingMode: "vertical-rl" }}
          >
            SETTINGS
          </div>
        </div>
      ) : (
        <div className="custom-scrollbar h-full overflow-y-auto p-4">
          {children}
        </div>
      )}
    </aside>
  );
};
