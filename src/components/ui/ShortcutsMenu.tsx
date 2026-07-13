"use client";

import { useEffect, useRef } from "react";

interface ShortcutGroup {
  title: string;
  shortcuts: {
    keys: string;
    description: string;
  }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "Keyboard",
    shortcuts: [
      {
        keys: "Esc",
        description:
          "Close open drawers, clear active callsign filters, or deselect the current map selection.",
      },
      {
        keys: "F",
        description: "Toggle follow mode for the currently selected aircraft.",
      },
      {
        keys: "U",
        description: "Show or hide radar UI elements.",
      },
      {
        keys: "L",
        description:
          "Cycle flight display: default, labels hidden, route waypoints hidden, or both hidden. Hidden route waypoints show a dotted direct line to arrival.",
      },
      {
        keys: "T",
        description: "Enter Heading Mode without clicking the map control.",
      },
    ],
  },
  {
    title: "Mouse",
    shortcuts: [
      {
        keys: "Ctrl + Click",
        description: "Add or remove an aircraft from the current selection.",
      },
    ],
  },
];

interface ShortcutsMenuProps {
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
  isFollowMode: boolean;
  canFollowAircraft: boolean;
  onFollowModeChange: (enabled: boolean) => void;
  showAircraftLabels: boolean;
  onAircraftLabelsChange: (enabled: boolean) => void;
  showRouteWaypoints: boolean;
  onRouteWaypointsChange: (enabled: boolean) => void;
  isHeadingMode: boolean;
  onHeadingModeChange: (enabled: boolean) => void;
  isUiHidden: boolean;
  onUiHiddenChange: (hidden: boolean) => void;
}

export function ShortcutsMenu({
  open,
  onClose,
  isMobile,
  isFollowMode,
  canFollowAircraft,
  onFollowModeChange,
  showAircraftLabels,
  onAircraftLabelsChange,
  showRouteWaypoints,
  onRouteWaypointsChange,
  isHeadingMode,
  onHeadingModeChange,
  isUiHidden,
  onUiHiddenChange,
}: ShortcutsMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[10024] flex items-end bg-black/70 px-3 pb-3 backdrop-blur-sm">
        <div
          ref={panelRef}
          className="w-full overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#071019]/95 shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
            <div>
              <p className="font-mono text-[11px] tracking-[0.24em] text-cyan-400/75 uppercase">
                Radar Controls
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                Quick toggles
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close radar controls"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="divide-y divide-white/6 px-5">
            <ToggleRow
              label="Follow selected aircraft"
              description={
                canFollowAircraft
                  ? "Keep the selected aircraft centered on the map."
                  : "Select an aircraft to enable following."
              }
              checked={isFollowMode}
              disabled={!canFollowAircraft}
              onChange={onFollowModeChange}
            />
            <ToggleRow
              label="Show aircraft labels"
              description="Show labels alongside aircraft on the map."
              checked={showAircraftLabels}
              onChange={onAircraftLabelsChange}
            />
            <ToggleRow
              label="Show route waypoints"
              description="Show waypoints along selected flight routes."
              checked={showRouteWaypoints}
              onChange={onRouteWaypointsChange}
            />
            <ToggleRow
              label="Heading mode"
              description="Set aircraft heading directly from the map."
              checked={isHeadingMode}
              onChange={onHeadingModeChange}
            />
            <ToggleRow
              label="Show radar UI"
              description="Hide panels and controls for an unobstructed map."
              checked={!isUiHidden}
              onChange={(enabled) => onUiHiddenChange(!enabled)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10024] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div
        ref={panelRef}
        className={`w-full overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#071019]/95 shadow-[0_24px_80px_rgba(0,0,0,0.65)] ${isMobile ? "max-w-sm" : "max-w-4xl"}`}
      >
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] tracking-[0.24em] text-cyan-400/75 uppercase">
                Radar Shortcuts
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">
                Shortcut Reference
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                Keyboard and mouse shortcuts currently available on the radar.
              </p>
            </div>

            <button
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close shortcuts"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          {shortcutGroups.map((group) => (
            <section
              key={group.title}
              className="rounded-xl border border-white/10 bg-black/20"
            >
              <div className="border-b border-white/8 px-4 py-3">
                <h3 className="font-mono text-[11px] tracking-[0.22em] text-cyan-400 uppercase">
                  {group.title}
                </h3>
              </div>

              <div className="divide-y divide-white/6">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={`${group.title}-${shortcut.keys}`}
                    className={`grid gap-3 px-4 py-4 ${isMobile ? "grid-cols-1" : "grid-cols-[140px_minmax(0,1fr)] items-start"}`}
                  >
                    <div className="flex items-center">
                      <span className="rounded-md border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-cyan-300">
                        {shortcut.keys}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-300">
                      {shortcut.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex min-h-20 items-center justify-between gap-4 py-4 ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
    >
      <span>
        <span className="block text-sm font-medium text-white">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-slate-400">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-full bg-slate-700 transition-colors peer-checked:bg-cyan-500 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-300 peer-disabled:bg-slate-800 after:absolute after:top-1 after:left-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
