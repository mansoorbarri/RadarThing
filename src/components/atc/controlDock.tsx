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

interface ControlDockProps {
  items: DockItem[];
  side?: "left" | "right";
}

export function ControlDock({ items, side = "left" }: ControlDockProps) {
  const [open, setOpen] = useState(false);

  const isRight = side === "right";

  return (
    <div
      className={`pointer-events-auto fixed bottom-6 ${
        isRight ? "right-6" : "left-6"
      } z-[10020]`}
    >
      <div className="relative">
        {/* Tool buttons (absolute, so dock never moves) */}
        <div
          className={`absolute bottom-14 ${
            isRight ? "right-0 items-end" : "left-0 items-start"
          } flex flex-col gap-2 transition-all duration-200 ease-out ${
            open
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-2 opacity-0"
          }`}
        >
          {items.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`flex items-center gap-3 rounded-xl border px-4 py-2 text-xs backdrop-blur-md transition-all duration-150 ${
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
          className={`flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-black/80 backdrop-blur-md transition-all duration-150 ${
            open
              ? "bg-black/90 text-cyan-300"
              : "text-slate-400 hover:bg-black/90 hover:text-cyan-300"
          }`}
        >
          {DockIcon}
        </button>
      </div>
    </div>
  );
}
