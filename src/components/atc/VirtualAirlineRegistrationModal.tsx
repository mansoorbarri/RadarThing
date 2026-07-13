"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import {
  Check,
  Clock3,
  ExternalLink,
  Plane,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { registerVirtualAirline } from "~/app/actions/virtual-airlines";

const REVIEW_DELAY_SECONDS = 10;

const RULES = [
  "Make sure your Discord is connected with RadarThing.",
  "Only upload real aircraft with a Photoshopped livery for your VA — not simulator screenshots.",
  "Only accept pilots into your VA when their Discord is connected to RadarThing.",
  "Make sure you are the VA admin or owner.",
];

export function VirtualAirlineRegistrationModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, isLoaded } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const dbUser = useQuery(
    api.users.getByClerkId,
    user?.id && isAuthenticated ? { clerkId: user.id } : "skip",
  );
  const [secondsRemaining, setSecondsRemaining] =
    useState(REVIEW_DELAY_SECONDS);
  const [hasAcknowledgedRules, setHasAcknowledgedRules] = useState(false);
  const [name, setName] = useState("");
  const [callsignPrefix, setCallsignPrefix] = useState("");
  const [website, setWebsite] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;

    setSecondsRemaining(REVIEW_DELAY_SECONDS);
    setHasAcknowledgedRules(false);
    setSubmitted(false);
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      setSecondsRemaining(Math.max(0, REVIEW_DELAY_SECONDS - elapsedSeconds));
    }, 250);

    return () => window.clearInterval(interval);
  }, [open]);

  if (!open) return null;

  const isDiscordConnected = Boolean(dbUser?.discordUsername);
  const canAcknowledge = secondsRemaining === 0;

  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isDiscordConnected) {
      toast.error("Connect Discord in your dashboard before registering a VA");
      return;
    }

    setIsSubmitting(true);
    const result = await registerVirtualAirline({
      name,
      callsignPrefix,
      website,
    });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? "Could not submit VA registration");
      return;
    }

    setSubmitted(true);
  };

  return (
    <div
      className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/45 p-4 backdrop-blur-md dark:bg-black/75"
      role="dialog"
      aria-modal="true"
      aria-labelledby="va-registration-title"
    >
      <div className="border-border bg-card text-card-foreground relative w-full max-w-xl overflow-hidden rounded-3xl border shadow-[0_0_50px_rgba(34,211,238,0.16)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          aria-label="Close VA registration"
          className="border-border text-muted-foreground hover:text-foreground absolute top-4 right-4 rounded-full border p-2 transition hover:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        {!isLoaded || dbUser === undefined ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
              <Clock3 className="h-7 w-7" />
            </div>
            <h2
              id="va-registration-title"
              className="text-foreground mt-5 text-2xl font-semibold"
            >
              Checking your account
            </h2>
            <p className="text-muted-foreground mt-3 text-sm">
              Verifying your RadarThing Discord connection…
            </p>
          </div>
        ) : !isDiscordConnected ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/10 text-amber-100">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h2
              id="va-registration-title"
              className="text-foreground mt-5 text-2xl font-semibold"
            >
              Connect Discord first
            </h2>
            <p className="text-muted-foreground mt-3 text-sm leading-6">
              A connected Discord account is required before you can review VA
              registration rules or submit a request.
            </p>
            <a
              href="/dashboard"
              className="mt-7 inline-flex rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-[#06202a] transition hover:bg-cyan-200"
            >
              Connect Discord in dashboard
            </a>
          </div>
        ) : !hasAcknowledgedRules ? (
          <div className="p-7 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-3 text-cyan-200">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-[0.2em] text-cyan-300 uppercase">
                  VA registration
                </p>
                <h2
                  id="va-registration-title"
                  className="text-foreground mt-1 text-2xl font-semibold"
                >
                  Before you register
                </h2>
              </div>
            </div>

            <p className="text-muted-foreground mb-5 text-sm leading-6">
              Please take a moment to read and agree to the VA community rules.
            </p>
            <ol className="space-y-3">
              {RULES.map((rule, index) => (
                <li
                  key={rule}
                  className="border-border bg-muted/35 text-foreground flex gap-3 rounded-xl border p-3 text-sm leading-5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 font-mono text-xs text-cyan-200">
                    {index + 1}
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
              <li className="text-foreground flex gap-3 rounded-xl border border-dashed border-cyan-300/25 bg-cyan-300/5 p-3 text-sm leading-5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-200">
                  <ExternalLink className="h-3.5 w-3.5" />
                </span>
                <span>
                  Join{" "}
                  <a
                    className="hover:text-foreground text-cyan-700 underline decoration-cyan-500/40 underline-offset-4 dark:text-cyan-200"
                    href="https://discord.gg/pbQF4txdRC"
                    target="_blank"
                    rel="noreferrer"
                  >
                    ATCThing
                  </a>{" "}
                  for support and easier access to the community{" "}
                  <span className="text-muted-foreground">(optional)</span>.
                </span>
              </li>
            </ol>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <span className="text-muted-foreground inline-flex items-center gap-2 font-mono text-xs">
                <Clock3 className="h-4 w-4 text-cyan-300" />
                {canAcknowledge
                  ? "Rules review complete"
                  : `Review available in ${secondsRemaining}s`}
              </span>
              <button
                type="button"
                disabled={!canAcknowledge}
                onClick={() => setHasAcknowledgedRules(true)}
                className="disabled:border-border disabled:bg-muted disabled:text-muted-foreground inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-2.5 text-sm font-medium text-cyan-800 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed dark:text-cyan-100"
              >
                <Check className="h-4 w-4" /> I understand
              </button>
            </div>
          </div>
        ) : submitted ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-emerald-200">
              <Check className="h-7 w-7" />
            </div>
            <h2
              id="va-registration-title"
              className="text-foreground mt-5 text-2xl font-semibold"
            >
              Registration submitted
            </h2>
            <p className="text-muted-foreground mt-3 text-sm leading-6">
              Your VA is awaiting administrator approval. You’ll be able to
              manage it once it has been approved.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-7 rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-[#06202a] transition hover:bg-cyan-200"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-7 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-3 text-cyan-200">
                <Plane className="h-6 w-6" />
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-[0.2em] text-cyan-300 uppercase">
                  New virtual airline
                </p>
                <h2
                  id="va-registration-title"
                  className="text-foreground mt-1 text-2xl font-semibold"
                >
                  Registration details
                </h2>
              </div>
            </div>

            {!isLoaded || dbUser === undefined ? (
              <p className="border-border bg-muted/35 text-muted-foreground rounded-xl border p-3 text-sm">
                Checking your RadarThing account…
              </p>
            ) : !isDiscordConnected ? (
              <p className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm leading-5 text-amber-100">
                Discord must be connected before you can submit.{" "}
                <a
                  href="/dashboard"
                  className="font-medium underline underline-offset-4"
                >
                  Connect it in your dashboard
                </a>
                .
              </p>
            ) : (
              <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/8 p-3 text-sm text-emerald-100">
                Discord connected as{" "}
                <span className="font-medium">{dbUser.discordUsername}</span>.
              </p>
            )}

            <div className="mt-5 space-y-4">
              <label className="text-muted-foreground block text-xs font-medium tracking-wide uppercase">
                VA name
                <input
                  required
                  minLength={2}
                  maxLength={60}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Example Virtual Airlines"
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground mt-2 w-full rounded-xl border px-3.5 py-3 text-sm transition outline-none focus:border-cyan-500/50"
                />
              </label>
              <label className="text-muted-foreground block text-xs font-medium tracking-wide uppercase">
                Callsign prefix
                <input
                  required
                  minLength={2}
                  maxLength={8}
                  value={callsignPrefix}
                  onChange={(event) =>
                    setCallsignPrefix(
                      event.target.value.toUpperCase().replace(/\s/g, ""),
                    )
                  }
                  placeholder="EVA"
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground mt-2 w-full rounded-xl border px-3.5 py-3 font-mono text-sm transition outline-none focus:border-cyan-500/50"
                />
              </label>
              <label className="text-muted-foreground block text-xs font-medium tracking-wide uppercase">
                Website{" "}
                <span className="text-muted-foreground">(optional)</span>
                <input
                  type="url"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  placeholder="https://yourva.example"
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground mt-2 w-full rounded-xl border px-3.5 py-3 text-sm transition outline-none focus:border-cyan-500/50"
                />
              </label>
            </div>
            <p className="text-muted-foreground mt-4 text-xs leading-5">
              You are registered as the VA owner. New registrations remain
              inactive until an administrator approves them.
            </p>
            <div className="mt-6 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setHasAcknowledgedRules(false)}
                className="border-border text-muted-foreground hover:bg-muted rounded-xl border px-4 py-2.5 text-sm transition"
              >
                Back to rules
              </button>
              <button
                type="submit"
                disabled={
                  isSubmitting || !isDiscordConnected || dbUser === undefined
                }
                className="disabled:bg-muted disabled:text-muted-foreground rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Submitting…" : "Submit for approval"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
