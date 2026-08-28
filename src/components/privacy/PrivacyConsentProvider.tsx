"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ShieldCheck, SlidersHorizontal, X } from "lucide-react";

const STORAGE_KEY = "radarthing_privacy_preferences_v1";
const OPEN_EVENT = "radarthing:open-privacy-settings";

interface PrivacyPreferences {
  analytics: boolean;
  updatedAt: string;
}

interface PrivacyConsentContextValue {
  analyticsAllowed: boolean;
  isResolved: boolean;
  openPrivacySettings: () => void;
}

const PrivacyConsentContext = createContext<PrivacyConsentContextValue>({
  analyticsAllowed: false,
  isResolved: false,
  openPrivacySettings: () => undefined,
});

declare global {
  interface Window {
    googlefc?: {
      callbackQueue: (() => void)[];
      showRevocationMessage?: () => void;
    };
  }
}

function readPreferences(): PrivacyPreferences | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<PrivacyPreferences>;
    if (typeof parsed.analytics !== "boolean") return null;
    return {
      analytics: parsed.analytics,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function savePreferences(analytics: boolean): PrivacyPreferences {
  const next = { analytics, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("radarthing:privacy-changed"));
  return next;
}

export function requestGooglePrivacyOptions() {
  if (typeof window === "undefined") return;

  if (window.googlefc?.showRevocationMessage) {
    window.googlefc.showRevocationMessage();
    return;
  }

  if (window.googlefc?.callbackQueue) {
    window.googlefc.callbackQueue.push(() => {
      window.googlefc?.showRevocationMessage?.();
    });
    return;
  }

  window.location.assign("/?privacy=ads");
}

export function PrivacyConsentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [preferences, setPreferences] = useState<PrivacyPreferences | null>(
    null,
  );
  const [isResolved, setIsResolved] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const stored = readPreferences();
    setPreferences(stored);
    setIsResolved(true);
    setIsOpen(!stored);
  }, []);

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  const choose = useCallback((analytics: boolean) => {
    setPreferences(savePreferences(analytics));
    setIsOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      analyticsAllowed: preferences?.analytics ?? false,
      isResolved,
      openPrivacySettings: () => setIsOpen(true),
    }),
    [isResolved, preferences?.analytics],
  );

  return (
    <PrivacyConsentContext.Provider value={value}>
      {children}
      {isResolved && isOpen && (
        <div className="fixed inset-0 z-[20000] flex items-end bg-black/55 p-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-title"
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#041017] text-white shadow-[0_28px_90px_rgba(0,0,0,0.7)]"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
            <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.24em] text-cyan-300/70 uppercase">
                      Privacy clearance
                    </p>
                    <h2
                      id="privacy-title"
                      className="mt-2 text-xl font-semibold tracking-tight"
                    >
                      Choose how RadarThing measures visits
                    </h2>
                  </div>
                  {preferences && (
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      aria-label="Close privacy settings"
                      className="rounded-lg p-2 text-white/45 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <p className="mt-3 text-sm leading-6 text-white/60">
                  Essential storage keeps the radar, sign-in, security, and your
                  saved preferences working. With your permission, PostHog also
                  measures product usage and errors so we can improve the site.
                  Advertising choices are handled separately by Google&apos;s
                  certified consent panel on pages that carry ads.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => choose(false)}
                    className="rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:border-white/25 hover:bg-white/[0.06]"
                  >
                    Essential only
                  </button>
                  <button
                    type="button"
                    onClick={() => choose(true)}
                    className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-[#021016] transition-colors hover:bg-cyan-200"
                  >
                    Allow analytics
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/45">
                  <Link href="/privacy" className="hover:text-cyan-200">
                    Privacy policy
                  </Link>
                  <Link href="/cookies" className="hover:text-cyan-200">
                    Cookie details
                  </Link>
                  <button
                    type="button"
                    onClick={requestGooglePrivacyOptions}
                    className="inline-flex items-center gap-1.5 hover:text-cyan-200"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    Google ad choices
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </PrivacyConsentContext.Provider>
  );
}

export function usePrivacyConsent() {
  return useContext(PrivacyConsentContext);
}

export function openPrivacySettings() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_EVENT));
  }
}
