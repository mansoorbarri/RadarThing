"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useProStatus } from "~/hooks/useProStatus";
import { Analytics } from "~/lib/analytics";

const DAY_MS = 24 * 60 * 60 * 1000;
const SHOW_BEFORE_END_MS = 2 * DAY_MS;
const SHOW_AFTER_END_MS = 7 * DAY_MS;
const DISMISS_KEY = "radarthing-trial-banner-dismissed";

export function TrialStatusBanner({ hidden = false }: { hidden?: boolean }) {
  const { isProUser, isTrialUser, trialEndsAt, isLoading } = useProStatus();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  useEffect(() => {
    setDismissedFor(localStorage.getItem(DISMISS_KEY));
  }, []);

  if (hidden || isLoading || !trialEndsAt) return null;

  const now = Date.now();
  const ended = !isTrialUser && !isProUser && trialEndsAt <= now;
  const endingSoon = isTrialUser && trialEndsAt - now <= SHOW_BEFORE_END_MS;
  if (!ended && !endingSoon) return null;
  if (ended && now - trialEndsAt > SHOW_AFTER_END_MS) return null;

  // Dismissing hides the current phase only, so the "ended" notice still shows.
  const phaseKey = `${ended ? "ended" : "ending"}:${trialEndsAt}`;
  if (dismissedFor === phaseKey) return null;

  const daysLeft = Math.max(1, Math.ceil((trialEndsAt - now) / DAY_MS));
  const message = ended
    ? "Your PRO trial has ended."
    : `Your PRO trial ends in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}.`;

  return (
    <div className="absolute top-24 left-1/2 z-[10005] flex w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-cyan-400/30 bg-[#07101a]/90 px-4 py-2 font-mono text-xs text-slate-200 shadow-[0_0_30px_rgba(6,182,212,0.2)] backdrop-blur-xl">
      <span>{message}</span>
      <Link
        href="/pricing"
        onClick={() =>
          Analytics.upgradeButtonClicked({
            source: ended ? "trial_ended_banner" : "trial_ending_banner",
            feature: "pro_plan",
          })
        }
        className="rounded-md bg-gradient-to-r from-cyan-500 to-blue-500 px-2.5 py-1 font-semibold text-white hover:from-cyan-400 hover:to-blue-400"
      >
        Keep PRO for $3/mo
      </Link>
      <button
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, phaseKey);
          setDismissedFor(phaseKey);
        }}
        className="cursor-pointer text-slate-400 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
