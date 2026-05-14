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

interface DockSection {
  id: string;
  label: string;
  items: DockItem[];
}

interface BottomAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

interface ControlDockProps {
  sections: DockSection[];
  side?: "left" | "right";
  bottomAction?: BottomAction;
  rightOffset?: number;
  isMobile?: boolean;
}

export function ControlDock({
  sections,
  side = "left",
  bottomAction,
  rightOffset,
  isMobile = false,
}: ControlDockProps) {
  const [open, setOpen] = useState(false);

  const isRight = side === "right";

  const btnSize = isMobile ? "h-11 w-11" : "h-13 w-13";
  const panelWidth = isMobile ? "w-[220px]" : "w-[236px]";
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
          } flex flex-col gap-1.5 transform-gpu transition-[opacity,transform] duration-180 ease-out ${
            open
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-1.5 opacity-0"
          }`}
        >
          <div
            className={`${panelWidth} ${isRight ? "origin-bottom-right" : "origin-bottom-left"} rounded-2xl border border-cyan-500/20 bg-black/75 p-2.5 shadow-[0_0_18px_rgba(0,255,255,0.08)] backdrop-blur-xl`}
          >
            <div className="flex flex-col gap-3.5">
              {sections.map((section) => (
                <div key={section.id}>
                  <div className="mb-1.5 px-1 text-[10px] font-medium tracking-[0.18em] text-cyan-300/80 uppercase">
                    {section.label}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          item.onClick();
                          setOpen(false);
                        }}
                        className={`flex w-full cursor-pointer items-center gap-2 rounded-xl border ${isMobile ? "px-3 py-2 text-[11px]" : "px-4 py-2 text-xs"} backdrop-blur-md transition-all duration-150 ${
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
                </div>
              ))}
            </div>
          </div>
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
