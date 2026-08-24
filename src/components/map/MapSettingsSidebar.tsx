"use client";

import React from "react";
import { PanelLeftClose } from "lucide-react";

import { MobileSwipeSheet } from "~/components/ui/MobileSwipeSheet";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface MapSettingsSidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const MapSettingsSidebar = ({
  isOpen,
  isMobile,
  onClose,
  children,
}: MapSettingsSidebarProps) => {
  if (!isOpen) {
    return null;
  }

  if (isMobile) {
    return (
      <MobileSwipeSheet onClose={onClose} initialState="half">
        <div
          data-tour="map-settings-panel"
          className="min-h-full bg-[#050f14]/95 p-3 pb-4"
        >
          <button
            type="button"
            data-tour="map-settings-close"
            onClick={onClose}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />
          {children}
        </div>
      </MobileSwipeSheet>
    );
  }

  return (
    <aside
      data-tour="map-settings-panel"
      className={cn(
        "animate-slide-in-left fixed inset-y-0 left-0 z-[10020] w-full max-w-[360px] border-r border-white/10 bg-black/90 backdrop-blur-xl xl:max-w-[400px]",
      )}
    >
      <Button
        data-tour="map-settings-close"
        variant="ghost"
        size="icon-xs"
        onClick={onClose}
        className="absolute top-1/2 -right-3 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-slate-900 text-slate-400 shadow-lg transition-colors hover:bg-slate-800 hover:text-white"
        title="Close settings"
        aria-label="Close settings"
      >
        <PanelLeftClose />
      </Button>

      <div className="custom-scrollbar h-full overflow-y-auto p-4">
        {children}
      </div>
    </aside>
  );
};
