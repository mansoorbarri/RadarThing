"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { DockIcon } from "~/utils/dockIcons";

const SECTION_STORAGE_KEY = "radarthing:dock-collapsed-sections";

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
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const panelId = useId();

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        window.localStorage.getItem(SECTION_STORAGE_KEY) ?? "{}",
      );
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        setCollapsedSections(
          Object.fromEntries(
            Object.entries(stored).filter(
              ([, value]) => typeof value === "boolean",
            ),
          ),
        );
      }
    } catch {
      // Keep the collapsed defaults if storage is unavailable or invalid.
    }
  }, []);

  const toggleSection = (sectionId: string) => {
    const next = {
      ...collapsedSections,
      [sectionId]: !(collapsedSections[sectionId] ?? true),
    };
    setCollapsedSections(next);
    try {
      window.localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Section controls still work when the browser blocks storage.
    }
  };

  // Leave space for the dock buttons, their gaps, and a top viewport margin.
  const reservedHeight = isMobile
    ? 76 + (bottomAction ? 52 : 0)
    : 96 + (bottomAction ? 60 : 0);
  const horizontalInset = isMobile
    ? 12
    : side === "right"
      ? rightOffset || 16
      : 24;

  const isRight = side === "right";

  const btnSize = isMobile ? "h-11 w-11" : "h-13 w-13";
  const panelWidth = isMobile ? "w-[220px]" : "w-[236px]";
  const bottomPos = isMobile ? "bottom-3" : "bottom-6";
  const sidePos = isMobile
    ? isRight
      ? "right-3"
      : "left-3"
    : isRight && !rightOffset
      ? "right-4"
      : !isRight
        ? "left-6"
        : "";

  return (
    <div
      data-tour="radar-tools"
      className={`pointer-events-auto fixed ${bottomPos} ${
        sidePos
      } z-[10013] flex flex-col items-center gap-2 transition-[right] duration-200`}
      style={
        isRight && rightOffset && !isMobile ? { right: rightOffset } : undefined
      }
    >
      {/* Dock toggle + items wrapper */}
      <div className="relative">
        {/* Tool buttons (absolute, so dock never moves) */}
        <div
          id={panelId}
          inert={!open}
          aria-hidden={!open}
          className={`absolute ${isMobile ? "bottom-13" : "bottom-14"} ${
            isRight ? "right-0 items-end" : "left-0 items-start"
          } flex transform-gpu flex-col gap-1.5 transition-[opacity,transform] duration-180 ease-out ${
            open
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-1.5 opacity-0"
          }`}
        >
          <div
            className={`${panelWidth} ${isRight ? "origin-bottom-right" : "origin-bottom-left"} overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-cyan-500/20 bg-black/75 p-2.5 shadow-[0_0_18px_rgba(0,255,255,0.08)] backdrop-blur-xl`}
            style={{
              maxHeight: `calc(100dvh - ${reservedHeight}px)`,
              maxWidth: `calc(100vw - ${horizontalInset + 12}px)`,
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(34, 211, 238, 0.4) transparent",
            }}
          >
            <div className="flex flex-col gap-3.5">
              {sections.map((section) => {
                const collapsed = collapsedSections[section.id] ?? true;
                return (
                  <div key={section.id}>
                    <button
                      type="button"
                      aria-expanded={!collapsed}
                      aria-controls={`${panelId}-${section.id}`}
                      onClick={() => toggleSection(section.id)}
                      className="flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-1 text-left text-[10px] font-medium tracking-[0.18em] text-cyan-300/80 uppercase transition-colors hover:bg-cyan-500/10 hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-cyan-300"
                    >
                      {section.label}
                      <ChevronDown
                        aria-hidden="true"
                        size={14}
                        className={`shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none ${collapsed ? "-rotate-90" : ""}`}
                      />
                    </button>
                    <div
                      id={`${panelId}-${section.id}`}
                      inert={collapsed}
                      aria-hidden={collapsed}
                      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
                        collapsed
                          ? "grid-rows-[0fr] opacity-0"
                          : "grid-rows-[1fr] opacity-100"
                      }`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="flex flex-col gap-1.5 pt-1.5">
                          {section.items.map((item) => (
                            <button
                              key={item.id}
                              data-tour={`radar-tool-${item.id}`}
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
                              <span className="shrink-0 text-cyan-300">
                                {item.icon}
                              </span>
                              <span className="min-w-0 text-left break-words">
                                {item.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dock toggle (anchored, never moves) */}
        <button
          type="button"
          aria-label={open ? "Close control dock" : "Open control dock"}
          aria-expanded={open}
          aria-controls={panelId}
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
          aria-label={bottomAction.label}
          className={`flex ${btnSize} cursor-pointer items-center justify-center rounded-md border border-cyan-400/30 bg-black/80 text-cyan-400 shadow-[0_0_6px_rgba(0,255,255,0.25)] transition-all duration-200 hover:border-cyan-400/50 hover:bg-cyan-400/15 hover:shadow-[0_0_10px_rgba(0,255,255,0.5)]`}
        >
          {bottomAction.icon}
        </button>
      )}
    </div>
  );
}
