"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  CloudRain,
  ChevronLeft,
  ChevronRight,
  ImageUp,
  Layers3,
  MousePointer2,
  Plane,
  Radar,
  Search,
  UserRound,
  Wrench,
  X,
} from "lucide-react";

interface GuideStep {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  hint?: string;
  details?: string[];
  targets?: string[];
  task?:
    | { type: "event"; eventName: "click" | "input"; prompt: string }
    | {
        type: "signal";
        signal: keyof RadarGuideSignals;
        prompt: string;
      }
    | { type: "acknowledge"; prompt: string };
  icon: typeof Radar;
}

export interface RadarGuideSignals {
  hasSelectedAircraft: boolean;
  hasSelectedFreeChartAirport: boolean;
  isChartOpen: boolean;
}

const STEPS: GuideStep[] = [
  {
    id: "welcome",
    eyebrow: "Welcome aboard",
    title: "Your live radar, at a glance",
    description:
      "RadarThing shows live GeoFS traffic around the world. This quick tour follows the same path you’ll use to find a flight, inspect it, and learn more about its pilot.",
    hint: "You can replay this tour anytime from Help in the bottom-left menu.",
    icon: Radar,
  },
  {
    id: "search",
    eyebrow: "Find anything",
    title: "Start with search",
    description:
      "Search by flight number, callsign, pilot name, or airport ICAO. Choose a flight to locate it on the map, a pilot to open their profile, or an airport to jump there.",
    hint: "Type at least one character to complete this task.",
    targets: [
      '[data-tour="radar-search"]',
      '[data-tour="radar-mobile-search"]',
    ],
    task: { type: "event", eventName: "input", prompt: "Try search" },
    icon: Search,
  },
  {
    id: "flight",
    eyebrow: "Live traffic",
    title: "Pick a flight on the radar",
    description:
      "Each aircraft marker is a live flight. Click one to draw its route and open the flight panel. You can pan and zoom the map just as you normally would while this step is open.",
    hint: "Select an aircraft marker or a flight from the search results.",
    targets: ['[data-tour="radar-map"]'],
    task: {
      type: "signal",
      signal: "hasSelectedAircraft",
      prompt: "Select a live flight",
    },
    icon: MousePointer2,
  },
  {
    id: "pilot",
    eyebrow: "Flight details",
    title: "Open the pilot profile",
    description:
      "The flight panel contains aircraft, route, altitude, speed, progress, and flight-plan details. Click the pilot callsign to open their public profile in a new tab.",
    hint: "If the flight has a RadarThing pilot profile, its Pilot link is highlighted.",
    targets: [
      '[data-tour="pilot-profile-link"]',
      '[data-tour="flight-details"]',
    ],
    task: {
      type: "event",
      eventName: "click",
      prompt: "Open the pilot profile",
    },
    icon: UserRound,
  },
  {
    id: "map-layer",
    eyebrow: "Map layers",
    title: "Change the map beneath the traffic",
    description:
      "OpenStreetMap and OpenAIP give you different geographic and aviation context. Radar Mode is a Pro layer. Try the highlighted free OpenStreetMap control.",
    hint: "Click OpenStreetMap to switch the base layer.",
    targets: ['[data-control="osm-layer"]', '[data-control="openaip-layer"]'],
    task: { type: "event", eventName: "click", prompt: "Switch a map layer" },
    icon: Layers3,
  },
  {
    id: "configuration",
    eyebrow: "Configuration",
    title: "Open radar configuration",
    description:
      "Configuration contains map overlays, visibility controls, units, keyboard bindings, and saved layer presets.",
    hint: "Click the highlighted gear control.",
    targets: ['[data-control="radar-settings"]'],
    task: { type: "event", eventName: "click", prompt: "Open Configuration" },
    icon: Wrench,
  },
  {
    id: "weather",
    eyebrow: "Weather layers",
    title: "Turn weather on and off",
    description:
      "Precipitation is available to everyone. AIRMETs and SIGMETs are advanced Pro weather layers for broader hazard awareness.",
    hint: "Toggle Precipitation once to see how weather overlays work.",
    targets: ['[data-tour="weather-precipitation"]'],
    task: { type: "event", eventName: "click", prompt: "Toggle precipitation" },
    icon: CloudRain,
  },
  {
    id: "us-airport",
    eyebrow: "Free airport charts",
    title: "Find a US airport",
    description:
      "Airport charts are free for US airports and territories. Search for a US ICAO—try KJFK—and select the airport result.",
    hint: "The task completes when a free-chart airport is selected.",
    targets: [
      '[data-tour="radar-search"]',
      '[data-tour="radar-mobile-search"]',
    ],
    task: {
      type: "signal",
      signal: "hasSelectedFreeChartAirport",
      prompt: "Select a US airport",
    },
    icon: Search,
  },
  {
    id: "charts",
    eyebrow: "Airport charts",
    title: "Open the airport chart viewer",
    description:
      "Use Charts for taxi diagrams, SIDs, STARs, and approaches contributed by the community. Charts outside the free US coverage are included with Pro.",
    hint: "Click Charts in the selected-airport bar.",
    targets: ['[data-tour="airport-charts-button"]'],
    task: {
      type: "signal",
      signal: "isChartOpen",
      prompt: "Open Charts",
    },
    icon: Plane,
  },
  {
    id: "chart-types",
    eyebrow: "Chart workflow",
    title: "Know what each chart is for",
    description:
      "Ground charts help with taxiing; SIDs cover departures; STARs cover arrivals; Approach charts take you from the terminal area to the runway.",
    details: [
      "US charts: free",
      "Worldwide chart access: Pro",
      "Search, rotate, zoom, and side view are built into the viewer",
    ],
    targets: ['[data-tour="airport-charts-viewer"]'],
    task: { type: "acknowledge", prompt: "I understand the chart types" },
    icon: Layers3,
  },
  {
    id: "toolkit",
    eyebrow: "Control dock",
    title: "Open the control dock",
    description:
      "The dock icon in the bottom-right opens live flight and airport lists, filters, shortcuts, community pages, uploads, and Help.",
    hint: "Click the highlighted dock icon to continue.",
    targets: ['[data-tour="radar-tools"]'],
    task: { type: "event", eventName: "click", prompt: "Open the dock" },
    icon: Wrench,
  },
  {
    id: "aircraft-images",
    eyebrow: "Community images",
    title: "Upload aircraft images correctly",
    description:
      "Open the Aircraft Gallery from Upload, then choose Upload Image. Every submission is reviewed before it appears on flight cards.",
    details: [
      "Use the base aircraft model—not a variant",
      "Show the complete aircraft and a clearly visible livery",
      "Match the ICAO, IATA, and aircraft name exactly",
      "Check for duplicates; use real airlines or the correct air force",
    ],
    hint: "Open the gallery in a new tab after reviewing these rules.",
    targets: ['[data-tour="radar-tool-upload"]'],
    task: { type: "event", eventName: "click", prompt: "Open Upload" },
    icon: ImageUp,
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findTarget(selectors: string[] | undefined) {
  if (!selectors) return null;
  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element && element.getClientRects().length > 0) return element;
  }
  return null;
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (element) =>
      element.getClientRects().length > 0 &&
      element.getAttribute("aria-hidden") !== "true",
  );
}

export function RadarGuide({
  open,
  onFinish,
  signals,
  onOpenAircraftImages,
  onPrepareDock,
}: {
  open: boolean;
  onFinish: () => void | Promise<void>;
  signals: RadarGuideSignals;
  onOpenAircraftImages: () => void;
  onPrepareDock: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [dialogHeight, setDialogHeight] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const step = STEPS[stepIndex]!;
  const isLastStep = stepIndex === STEPS.length - 1;
  const signalComplete =
    step.task?.type === "signal" && signals[step.task.signal];
  const isStepComplete =
    !step.task || completedStepIds.has(step.id) || signalComplete;

  const markStepComplete = useCallback((stepId: string) => {
    setCompletedStepIds((current) => {
      if (current.has(stepId)) return current;
      const next = new Set(current);
      next.add(stepId);
      return next;
    });
  }, []);

  const measureTarget = useCallback(() => {
    setViewportHeight(window.innerHeight);
    const nextDialogHeight = dialogRef.current?.getBoundingClientRect().height;
    if (nextDialogHeight) {
      setDialogHeight((current) =>
        current === nextDialogHeight ? current : nextDialogHeight,
      );
    }
    const target = findTarget(step.targets);
    if (!target) {
      setTargetRect(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    const padding = window.innerWidth < 640 ? 6 : 10;
    const nextRect = {
      top: Math.max(6, rect.top - padding),
      left: Math.max(6, rect.left - padding),
      width: Math.min(window.innerWidth - 12, rect.width + padding * 2),
      height: Math.min(window.innerHeight - 12, rect.height + padding * 2),
    };
    setTargetRect((current) =>
      current?.top === nextRect.top &&
      current.left === nextRect.left &&
      current.width === nextRect.width &&
      current.height === nextRect.height
        ? current
        : nextRect,
    );
  }, [step.targets]);

  useLayoutEffect(() => {
    if (!open) return;
    measureTarget();
    const intervalId = window.setInterval(measureTarget, 500);
    window.addEventListener("resize", measureTarget);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("resize", measureTarget);
    };
  }, [open, measureTarget]);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const animationFrameId = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      const previouslyFocused = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setStepIndex(0);
      setCompletedStepIds(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (!open || step.task?.type !== "event") return;
    const eventName = step.task.eventName;
    const handleTaskEvent = (event: Event) => {
      const target = findTarget(step.targets);
      if (
        !target ||
        !(event.target instanceof Node) ||
        !target.contains(event.target)
      ) {
        return;
      }

      if (
        eventName === "input" &&
        event.target instanceof HTMLInputElement &&
        !event.target.value.trim()
      ) {
        return;
      }

      if (step.id === "pilot") {
        const link =
          event.target instanceof Element
            ? event.target.closest<HTMLAnchorElement>("a[href]")
            : null;
        if (link) {
          event.preventDefault();
          window.open(link.href, "_blank", "noopener,noreferrer");
        }
      }
      if (step.id === "aircraft-images") {
        event.preventDefault();
        event.stopPropagation();
        onOpenAircraftImages();
      }
      markStepComplete(step.id);
    };

    document.addEventListener(eventName, handleTaskEvent, true);
    return () => document.removeEventListener(eventName, handleTaskEvent, true);
  }, [
    markStepComplete,
    onOpenAircraftImages,
    open,
    step.id,
    step.targets,
    step.task,
  ]);

  useEffect(() => {
    if (!open) return;
    if (step.id === "us-airport") {
      document
        .querySelector<HTMLButtonElement>('[data-tour="map-settings-close"]')
        ?.click();
    }
    if (step.id === "toolkit") {
      document
        .querySelector<HTMLElement>('[data-control="reset-map-view"]')
        ?.click();
      onPrepareDock();
    }
  }, [onPrepareDock, open, step.id]);

  useEffect(() => {
    if (signalComplete) markStepComplete(step.id);
  }, [markStepComplete, signalComplete, step.id]);

  const handleGuideNavigationKey = useCallback(
    (key: string) => {
      if (key === "Escape") {
        void onFinish();
        return true;
      }
      if (key === "ArrowRight" && !isLastStep) {
        if (!isStepComplete) return true;
        setStepIndex((current) => current + 1);
        return true;
      }
      if (key === "ArrowLeft" && stepIndex > 0) {
        setStepIndex((current) => current - 1);
        return true;
      }
      return false;
    },
    [isLastStep, isStepComplete, onFinish, stepIndex],
  );

  useEffect(() => {
    if (!open) return;
    const handleOutsideKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (
        dialog &&
        event.target instanceof Node &&
        dialog.contains(event.target)
      ) {
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        event.stopImmediatePropagation();
        dialog?.focus();
        return;
      }

      if (handleGuideNavigationKey(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", handleOutsideKeyDown, true);
    return () =>
      window.removeEventListener("keydown", handleOutsideKeyDown, true);
  }, [handleGuideNavigationKey, open]);

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    event.stopPropagation();

    if (event.key === "Tab") {
      event.preventDefault();
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        dialog.focus();
        return;
      }

      const currentIndex = focusableElements.indexOf(
        document.activeElement as HTMLElement,
      );
      const nextIndex = event.shiftKey
        ? currentIndex <= 0
          ? focusableElements.length - 1
          : currentIndex - 1
        : currentIndex === focusableElements.length - 1
          ? 0
          : currentIndex + 1;
      focusableElements[nextIndex]?.focus();
      return;
    }

    if (handleGuideNavigationKey(event.key)) event.preventDefault();
  };

  if (!open) return null;

  const Icon = step.icon;
  const cardStyle = targetRect
    ? (() => {
        const viewportMargin = 12;
        const maxHeight = Math.max(160, viewportHeight - viewportMargin * 2);

        if (targetRect.height > viewportHeight * 0.55) {
          return { bottom: viewportMargin, maxHeight };
        }

        if (targetRect.top + targetRect.height < viewportHeight * 0.58) {
          const desiredTop = targetRect.top + targetRect.height + 18;
          const latestTop = Math.max(
            viewportMargin,
            viewportHeight - dialogHeight - viewportMargin,
          );
          const top = Math.min(desiredTop, latestTop);
          return {
            top,
            maxHeight: Math.max(160, viewportHeight - top - viewportMargin),
          };
        }

        const bottom = Math.max(
          viewportMargin,
          viewportHeight - targetRect.top + 18,
        );
        return {
          bottom,
          maxHeight: Math.max(
            160,
            viewportHeight - bottom - viewportMargin,
          ),
        };
      })()
    : undefined;
  const taskNeedsExternalAction =
    step.task?.type === "event" || step.task?.type === "signal";
  const primaryLabel = isStepComplete
    ? isLastStep
      ? "Start exploring"
      : stepIndex === 0
        ? "Begin guided tasks"
        : "Next"
    : (step.task?.prompt ?? "Complete the task");

  const handlePrimaryAction = () => {
    if (!isStepComplete) {
      if (step.task?.type === "acknowledge") {
        markStepComplete(step.id);
        setStepIndex((current) => current + 1);
      }
      return;
    }

    if (isLastStep) void onFinish();
    else setStepIndex((current) => current + 1);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[10100]">
      {targetRect ? (
        <>
          <div
            className="pointer-events-auto absolute inset-x-0 top-0 bg-[#02080d]/82"
            style={{ height: targetRect.top }}
          />
          <div
            className="pointer-events-auto absolute left-0 bg-[#02080d]/82"
            style={{
              top: targetRect.top,
              width: targetRect.left,
              height: targetRect.height,
            }}
          />
          <div
            className="pointer-events-auto absolute right-0 bg-[#02080d]/82"
            style={{
              top: targetRect.top,
              left: targetRect.left + targetRect.width,
              height: targetRect.height,
            }}
          />
          <div
            className="pointer-events-auto absolute inset-x-0 bottom-0 bg-[#02080d]/82"
            style={{ top: targetRect.top + targetRect.height }}
          />
          <div
            className="pointer-events-none absolute rounded-xl border-2 border-cyan-300 shadow-[0_0_0_4px_rgba(34,211,238,0.14),0_0_36px_rgba(34,211,238,0.32)] transition-all duration-300"
            style={targetRect}
          />
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0 bg-[#02080d]/86" />
      )}

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="radar-guide-title"
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        className={`pointer-events-auto absolute right-3 left-3 mx-auto max-h-[calc(100dvh-1.5rem)] w-auto max-w-[430px] overflow-y-auto rounded-2xl border border-cyan-300/25 bg-[#07131c]/96 text-white shadow-[0_24px_80px_rgba(0,0,0,0.65),0_0_30px_rgba(34,211,238,0.1)] backdrop-blur-2xl sm:right-auto sm:left-1/2 sm:w-[430px] sm:-translate-x-1/2 ${targetRect ? "" : "top-1/2 -translate-y-1/2"}`}
        style={targetRect ? cardStyle : undefined}
      >
        <div className="h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-300">
                <Icon size={19} strokeWidth={1.8} />
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-[0.22em] text-cyan-300 uppercase">
                  {step.eyebrow}
                </p>
                <p className="mt-1 font-mono text-[10px] text-slate-500">
                  {String(stepIndex + 1).padStart(2, "0")} /{" "}
                  {String(STEPS.length).padStart(2, "0")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void onFinish()}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
              aria-label="Skip tour"
              title="Skip tour"
            >
              <X size={17} />
            </button>
          </div>

          <h2
            id="radar-guide-title"
            className="text-xl font-semibold tracking-tight text-white sm:text-2xl"
          >
            {step.title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {step.description}
          </p>
          {step.details && (
            <ul className="mt-4 space-y-2 rounded-xl border border-white/8 bg-black/25 px-4 py-3 text-xs leading-5 text-slate-300">
              {step.details.map((detail) => (
                <li key={detail} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-300" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          )}
          {step.hint && (
            <div className="mt-4 flex gap-2 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.055] px-3 py-2.5 text-xs leading-5 text-cyan-100/75">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-300" />
              <span>{step.hint}</span>
            </div>
          )}

          {step.task && (
            <div
              className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-[10px] tracking-[0.08em] uppercase ${isStepComplete ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-300" : "border-amber-300/25 bg-amber-300/8 text-amber-200"}`}
              role="status"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${isStepComplete ? "bg-emerald-300" : "animate-pulse bg-amber-300"}`}
              />
              {isStepComplete
                ? "Task complete"
                : `Action required · ${step.task.prompt}`}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="flex gap-1.5" aria-hidden="true">
              {STEPS.map((_, index) => (
                <span
                  key={index}
                  className={`h-1 rounded-full transition-all duration-300 ${index === stepIndex ? "w-6 bg-cyan-300" : index < stepIndex ? "w-2 bg-cyan-300/40" : "w-2 bg-white/12"}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setStepIndex((current) => current - 1)}
                  className="flex h-9 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <ChevronLeft size={14} /> Back
                </button>
              )}
              <button
                type="button"
                onClick={handlePrimaryAction}
                disabled={!isStepComplete && taskNeedsExternalAction}
                className="flex min-h-9 items-center gap-1.5 rounded-lg border border-cyan-200/30 bg-cyan-300 px-4 py-2 text-xs font-semibold text-[#041016] shadow-[0_0_18px_rgba(34,211,238,0.18)] transition-colors hover:bg-cyan-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/8 disabled:text-white/35 disabled:shadow-none"
              >
                {primaryLabel}
                {isStepComplete && !isLastStep && <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
