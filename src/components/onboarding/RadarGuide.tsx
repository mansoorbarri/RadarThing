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
  ChevronLeft,
  ChevronRight,
  MousePointer2,
  Plane,
  Radar,
  Search,
  UserRound,
  Wrench,
  X,
} from "lucide-react";

interface GuideStep {
  eyebrow: string;
  title: string;
  description: string;
  hint?: string;
  targets?: string[];
  icon: typeof Radar;
}

const STEPS: GuideStep[] = [
  {
    eyebrow: "Welcome aboard",
    title: "Your live radar, at a glance",
    description:
      "RadarThing shows live GeoFS traffic around the world. This quick tour follows the same path you’ll use to find a flight, inspect it, and learn more about its pilot.",
    hint: "You can replay this tour anytime from Help in the bottom-left menu.",
    icon: Radar,
  },
  {
    eyebrow: "Find anything",
    title: "Start with search",
    description:
      "Search by flight number, callsign, pilot name, or airport ICAO. Choose a flight to locate it on the map, a pilot to open their profile, or an airport to jump there.",
    hint: "Try a callsign you recognize, or an ICAO code such as EGLL.",
    targets: [
      '[data-tour="radar-search"]',
      '[data-tour="radar-mobile-search"]',
    ],
    icon: Search,
  },
  {
    eyebrow: "Live traffic",
    title: "Pick a flight on the radar",
    description:
      "Each aircraft marker is a live flight. Click one to draw its route and open the flight panel. You can pan and zoom the map just as you normally would while this step is open.",
    hint: "Go ahead—select any aircraft, then continue.",
    targets: ['[data-tour="radar-map"]'],
    icon: MousePointer2,
  },
  {
    eyebrow: "Flight details",
    title: "Read the whole flight",
    description:
      "The flight panel brings together the aircraft, route, altitude, speed, progress, and live flight plan. Airport codes in the panel are shortcuts back to the map.",
    hint: "If no panel is open yet, click an aircraft marker first.",
    targets: ['[data-tour="flight-details"]', '[data-tour="radar-map"]'],
    icon: Plane,
  },
  {
    eyebrow: "Meet the pilot",
    title: "Open pilot profiles",
    description:
      "Pilot names link to their public profile, where you can see their callsign and free public stats. You can also find a pilot directly from the search box.",
    hint: "Look for the pilot name in an open flight panel.",
    targets: [
      '[data-tour="flight-details"]',
      '[data-tour="radar-search"]',
      '[data-tour="radar-mobile-search"]',
    ],
    icon: UserRound,
  },
  {
    eyebrow: "Explore more",
    title: "Your radar toolkit",
    description:
      "Open the bottom menu for the live flights list, airport activity, callsign filters, keyboard shortcuts, the leaderboard, uploads, and Help—all available to free users.",
    hint: "That’s it. You’re ready to explore the skies.",
    targets: ['[data-tour="radar-tools"]'],
    icon: Wrench,
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
}: {
  open: boolean;
  onFinish: () => void | Promise<void>;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const step = STEPS[stepIndex]!;
  const isLastStep = stepIndex === STEPS.length - 1;

  const measureTarget = useCallback(() => {
    setViewportHeight(window.innerHeight);
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
    if (!open) setStepIndex(0);
  }, [open]);

  const handleGuideNavigationKey = useCallback(
    (key: string) => {
      if (key === "Escape") {
        void onFinish();
        return true;
      }
      if (key === "ArrowRight" && !isLastStep) {
        setStepIndex((current) => current + 1);
        return true;
      }
      if (key === "ArrowLeft" && stepIndex > 0) {
        setStepIndex((current) => current - 1);
        return true;
      }
      return false;
    },
    [isLastStep, onFinish, stepIndex],
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
    ? targetRect.height > viewportHeight * 0.55
      ? { bottom: 24 }
      : targetRect.top + targetRect.height < viewportHeight * 0.58
        ? {
            top: Math.min(
              targetRect.top + targetRect.height + 18,
              viewportHeight - 360,
            ),
          }
        : { bottom: Math.max(18, viewportHeight - targetRect.top + 18) }
    : undefined;

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
        className={`pointer-events-auto absolute right-3 left-3 mx-auto w-auto max-w-[430px] overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#07131c]/96 text-white shadow-[0_24px_80px_rgba(0,0,0,0.65),0_0_30px_rgba(34,211,238,0.1)] backdrop-blur-2xl sm:right-auto sm:left-1/2 sm:w-[430px] sm:-translate-x-1/2 ${targetRect ? "" : "top-1/2 -translate-y-1/2"}`}
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
          {step.hint && (
            <div className="mt-4 flex gap-2 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.055] px-3 py-2.5 text-xs leading-5 text-cyan-100/75">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-300" />
              <span>{step.hint}</span>
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
                onClick={() => {
                  if (isLastStep) void onFinish();
                  else setStepIndex((current) => current + 1);
                }}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-cyan-200/30 bg-cyan-300 px-4 text-xs font-semibold text-[#041016] shadow-[0_0_18px_rgba(34,211,238,0.18)] transition-colors hover:bg-cyan-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              >
                {isLastStep ? "Start exploring" : "Next"}
                {!isLastStep && <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
