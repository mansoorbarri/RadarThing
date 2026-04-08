"use client";

import { useState } from "react";
import { DockIcon } from "~/utils/dockIcons";

interface DockItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}

interface BottomAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

interface ControlDockProps {
  items: DockItem[];
  side?: "left" | "right";
  bottomAction?: BottomAction;
  rightOffset?: number;
  isMobile?: boolean;
}

export function ControlDock({
  items,
  side = "left",
  bottomAction,
  rightOffset,
  isMobile = false,
}: ControlDockProps) {
  const [open, setOpen] = useState(false);

  const isRight = side === "right";

  const btnSize = isMobile ? "h-11 w-11" : "h-13 w-13";
  const itemWidth = isMobile ? "w-[130px]" : "w-[140px]";
  const bottomPos = isMobile ? "bottom-3" : "bottom-6";
  const sidePos = isMobile
    ? isRight ? "right-3" : "left-3"
    : isRight && !rightOffset ? "right-6" : !isRight ? "left-6" : "";

  return (
    <div
      className={`pointer-events-auto fixed ${bottomPos} ${
        sidePos
      } z-[10013] flex flex-col items-center gap-2 transition-[right] duration-200`}
      style={isRight && rightOffset && !isMobile ? { right: rightOffset } : undefined}
    >
      {/* Dock toggle + items wrapper */}
      <div className="relative">
        {/* Tool buttons (absolute, so dock never moves) */}
        <div
          className={`absolute ${isMobile ? "bottom-13" : "bottom-14"} ${
            isRight ? "right-0 items-end" : "left-0 items-start"
          } flex flex-col gap-1.5 transition-all duration-200 ease-out ${
            open
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-2 opacity-0"
          }`}
        >
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              className={`flex ${itemWidth} cursor-pointer items-center gap-2 rounded-xl border ${isMobile ? "px-3 py-2 text-[11px]" : "px-4 py-2 text-xs"} backdrop-blur-md transition-all duration-150 ${
                item.active
                  ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-300"
                  : "border-white/10 bg-black/70 text-slate-400 hover:bg-black/80 hover:text-slate-200"
              }`}
            >
              <span className="text-cyan-300">{item.icon}</span>
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Dock toggle (anchored, never moves) */}
        <button
          onClick={() => setOpen(!open)}
          className={`flex ${btnSize} cursor-pointer items-center justify-center rounded-md border font-mono font-bold transition-all duration-200 ${
            open
              ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.5)]"
              : "border-cyan-400/30 bg-black/80 text-cyan-400 shadow-[0_0_6px_rgba(0,255,255,0.25)] hover:border-cyan-400/50 hover:bg-cyan-400/15 hover:shadow-[0_0_10px_rgba(0,255,255,0.5)]"
          }`}
        >
          {DockIcon}
        </button>
      </div>

      {/* Bottom action (below dock, outside relative wrapper) */}
      {bottomAction && (
        <button
          onClick={bottomAction.onClick}
          title={bottomAction.label}
          className={`flex ${btnSize} cursor-pointer items-center justify-center rounded-md border border-cyan-400/30 bg-black/80 text-cyan-400 shadow-[0_0_6px_rgba(0,255,255,0.25)] transition-all duration-200 hover:border-cyan-400/50 hover:bg-cyan-400/15 hover:shadow-[0_0_10px_rgba(0,255,255,0.5)]`}
        >
          {bottomAction.icon}
        </button>
      )}
    </div>
  );
}
