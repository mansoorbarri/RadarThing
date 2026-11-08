"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { createCheckoutSession } from "~/app/actions/create-checkout";
import { createPortalSession } from "~/app/actions/create-portal";
import { useState, useEffect, useRef, useCallback } from "react";
import { useProStatus } from "~/hooks/useProStatus";
import { Check, Zap } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { SiteFooter } from "~/components/site/SiteFooter";
import { SiteHeader } from "~/components/site/SiteHeader";
import { GoogleSignInButton } from "~/components/auth/GoogleSignInButton";
import { Analytics } from "~/lib/analytics";
import { FREE_RECENT_FLIGHTS_LIMIT } from "~/lib/flightHistory";
import { NOT_INCLUDED, planRows, proPlanItems } from "~/lib/plans";
import { FREE_DAILY_ALLOWANCE } from "~/lib/freeAllowance";
import { MIN_STRIPE_TRIAL_MS } from "~/lib/proAccess";

export default function PricingPage() {
  const router = useRouter();
  // Read the query after mount: useSearchParams would opt the whole page out
  // of static rendering, leaving crawlers and first paint with an empty shell.
  const [searchParams, setSearchParams] = useState<URLSearchParams | null>(
    null,
  );
  const { isSignedIn, isLoaded } = useUser();
  // Which action is in progress, so each button can say what it's doing.
  const [pendingAction, setPendingAction] = useState<
    "checkout" | "trial" | "billing" | null
  >(null);
  const loading = pendingAction !== null;
  const [mounted, setMounted] = useState(false);
  const autoCheckoutStartedRef = useRef(false);

  const {
    isProUser,
    isTrialUser,
    trialEndsAt,
    canStartTrial,
    isLoading: checkingStatus,
  } = useProStatus();
  const startFreeTrial = useMutation(api.users.startFreeTrial);

  useEffect(() => {
    setMounted(true);
    setSearchParams(new URLSearchParams(window.location.search));
  }, []);

  useEffect(() => {
    if (isLoaded && !checkingStatus) {
      Analytics.pricingPageViewed();
    }
  }, [isLoaded, checkingStatus]);

  const handleUpgrade = useCallback(
    async (source: string) => {
      if (!isSignedIn) return;

      Analytics.upgradeButtonClicked({ source, feature: "pro_plan" });
      Analytics.checkoutStarted({ source });
      try {
        setPendingAction("checkout");
        const url = await createCheckoutSession();
        if (url) window.location.href = url;
      } catch (err) {
        console.error(err);
        toast.error("Couldn't open checkout. Try again in a moment.");
      } finally {
        setPendingAction(null);
      }
    },
    [isSignedIn],
  );

  const handleStartTrial = useCallback(
    async (source: string) => {
      if (!isSignedIn) return;

      Analytics.upgradeButtonClicked({ source, feature: "free_trial" });
      try {
        setPendingAction("trial");
        await startFreeTrial({});
        Analytics.freeTrialStarted({ source });
        router.push("/radar");
      } catch (err) {
        console.error(err);
        toast.error("Couldn't start your free trial. Try again.");
      } finally {
        setPendingAction(null);
      }
    },
    [isSignedIn, startFreeTrial, router],
  );

  useEffect(() => {
    if (!isLoaded || checkingStatus || !isSignedIn || !searchParams) return;
    if (autoCheckoutStartedRef.current) return;

    if (searchParams?.get("trial") === "1") {
      // New sign-ins may not have a user record yet, so wait until the trial
      // is claimable. Accounts that already used it stay on this page.
      if (!canStartTrial) return;
      autoCheckoutStartedRef.current = true;
      void handleStartTrial("pricing_page_post_signin");
      return;
    }

    if (searchParams?.get("checkout") !== "1") return;
    autoCheckoutStartedRef.current = true;
    void handleUpgrade("pricing_page_post_signin");
  }, [
    isLoaded,
    checkingStatus,
    isSignedIn,
    searchParams,
    canStartTrial,
    handleUpgrade,
    handleStartTrial,
  ]);

  async function handleManageSubscription() {
    try {
      setPendingAction("billing");
      const url = await createPortalSession();
      if (url) window.location.href = url;
    } catch (err) {
      console.error(err);
      toast.error("Couldn't open subscription management. Try again.");
    } finally {
      setPendingAction(null);
    }
  }

  // Show the plan details straight away; only the buttons wait for the
  // account status, instead of the whole page sitting behind a loader.
  const isStatusPending =
    !mounted || !isLoaded || (Boolean(isSignedIn) && checkingStatus);

  if (!isStatusPending && isTrialUser && trialEndsAt) {
    // Matches create-checkout: too close to the end, billing starts at once.
    const keepsTrialDays = trialEndsAt - Date.now() > MIN_STRIPE_TRIAL_MS;
    const daysLeft = Math.max(
      1,
      Math.ceil((trialEndsAt - Date.now()) / (24 * 60 * 60 * 1000)),
    );
    return (
      <div className="bg-site relative min-h-screen overflow-hidden text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-20 -left-24 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute -right-28 bottom-10 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        </div>
        <SiteHeader />
        <main
          id="main-content"
          className="relative mx-auto max-w-2xl px-6 py-24"
        >
          <div className="rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/12 via-sky-500/8 to-blue-500/10 p-10 text-center shadow-[0_0_80px_rgba(6,182,212,0.12)] backdrop-blur-xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/15">
              <Zap className="h-7 w-7 text-cyan-300" />
            </div>
            <p className="mb-2 font-mono text-[11px] tracking-[0.18em] text-cyan-300/80 uppercase">
              Free trial active
            </p>
            <h1 className="mb-3 text-3xl font-bold text-white">
              {daysLeft} {daysLeft === 1 ? "day" : "days"} of Pro left
            </h1>
            <p className="mb-8 text-slate-300">
              Subscribe now to keep weather intel, charts, and your full flight
              history.{" "}
              {keepsTrialDays
                ? `You won't be charged until your trial ends on ${new Date(trialEndsAt).toLocaleDateString()}.`
                : "Your subscription starts today."}
            </p>
            <button
              onClick={() => handleUpgrade("pricing_page_trial_active")}
              disabled={loading}
              aria-busy={loading}
              className="cursor-pointer rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_35px_rgba(56,189,248,0.35)] transition-all hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none disabled:opacity-50"
            >
              {pendingAction === "checkout"
                ? "Opening checkout…"
                : "Keep Pro for $3/month"}
            </button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!isStatusPending && isProUser) {
    return (
      <div className="bg-site relative min-h-screen overflow-hidden text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-20 -left-24 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute -right-28 bottom-10 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        </div>
        <SiteHeader />
        <main
          id="main-content"
          className="relative mx-auto max-w-2xl px-6 py-24"
        >
          <div className="rounded-3xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/12 via-cyan-500/8 to-blue-500/10 p-10 text-center shadow-[0_0_80px_rgba(16,185,129,0.12)] backdrop-blur-xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/15">
              <Check className="h-7 w-7 text-emerald-300" />
            </div>
            <p className="mb-2 font-mono text-[11px] tracking-[0.18em] text-emerald-300/80 uppercase">
              Subscription active
            </p>
            <h1 className="mb-3 text-3xl font-bold text-white">
              You&apos;re flying with Pro
            </h1>
            <p className="mb-8 text-slate-300">
              Weather intel, charts, and full analytics are unlocked on your
              account, including your full flight history.
            </p>
            <button
              onClick={handleManageSubscription}
              disabled={loading}
              aria-busy={loading}
              className="cursor-pointer rounded-xl border border-white/20 bg-white/8 px-6 py-3 text-sm font-semibold text-white transition-all hover:border-cyan-300/40 hover:bg-white/14 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none disabled:opacity-50"
            >
              {pendingAction === "billing"
                ? "Opening billing…"
                : "Manage subscription"}
            </button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="bg-site relative min-h-screen overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.25) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="absolute top-[-260px] left-1/2 h-[720px] w-[720px] -translate-x-1/2 rounded-full border border-cyan-400/15" />
        <div className="absolute top-[-220px] left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full border border-cyan-400/10" />
        <div className="absolute top-[-170px] left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full border border-cyan-400/10" />
        <div className="absolute top-28 -left-28 h-80 w-80 rounded-full bg-cyan-500/12 blur-3xl" />
        <div className="absolute right-[-120px] bottom-[-60px] h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <SiteHeader />

      <main
        id="main-content"
        className="relative mx-auto max-w-5xl px-6 py-14 md:py-20"
      >
        {/* Phones read heading, then the plan card, then the details; on
            desktop the card sits in the right column beside both. */}
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-y-0">
          <div className="lg:col-start-1 lg:row-start-1">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-3 py-1.5">
              <Zap className="h-3.5 w-3.5 text-cyan-300" />
              <span className="font-mono text-[11px] tracking-wider text-cyan-200 uppercase">
                Pro flight deck
              </span>
            </div>
            <h1 className="max-w-xl text-4xl leading-tight font-bold text-white md:text-5xl">
              Fly with full situational awareness
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 md:text-lg">
              Upgrade to RadarThing Pro for advanced weather intelligence,
              airport charts, and deep flight analytics built for serious GeoFS
              pilots.
            </p>
          </div>

          <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <div className="relative overflow-hidden rounded-3xl border border-cyan-400/25 bg-[#07101a]/85 p-7 shadow-[0_20px_70px_rgba(6,182,212,0.18)] backdrop-blur-xl">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
              <p className="font-mono text-[11px] tracking-[0.16em] text-cyan-200/80 uppercase">
                Pro subscription
              </p>
              <div className="mt-3 flex items-end gap-2">
                <div className="text-5xl font-bold text-white">$3</div>
                <div className="pb-1 text-slate-300">/ month</div>
              </div>
              <p className="mt-2 text-sm text-cyan-100/85">
                {isStatusPending || !isSignedIn || canStartTrial
                  ? "Try it free for 7 days. No card needed."
                  : "Cancel anytime."}
              </p>

              {isStatusPending && (
                <div
                  role="status"
                  aria-label="Checking your plan"
                  className="mt-6 h-[52px] w-full animate-pulse rounded-xl bg-white/10"
                />
              )}

              {!isStatusPending && !isSignedIn && (
                <GoogleSignInButton redirectTo="/pricing?trial=1">
                  <button
                    onClick={() =>
                      Analytics.upgradeButtonClicked({
                        source: "pricing_page_signed_out",
                        feature: "pro_plan",
                      })
                    }
                    className="mt-6 w-full cursor-pointer rounded-xl bg-cyan-400 py-3.5 font-semibold text-slate-950 shadow-[0_0_35px_rgba(56,189,248,0.35)] transition-all hover:-translate-y-0.5 hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none"
                  >
                    Start free trial with Google
                  </button>
                </GoogleSignInButton>
              )}

              {!isStatusPending && isSignedIn && canStartTrial && (
                <>
                  <button
                    onClick={() => handleStartTrial("pricing_page")}
                    disabled={loading}
                    aria-busy={loading}
                    className="mt-6 w-full cursor-pointer rounded-xl bg-cyan-400 py-3.5 font-semibold text-slate-950 shadow-[0_0_35px_rgba(56,189,248,0.35)] transition-all hover:-translate-y-0.5 hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingAction === "trial"
                      ? "Starting your trial…"
                      : "Start 7-day free trial"}
                  </button>
                  <button
                    onClick={() => handleUpgrade("pricing_page_card_trial")}
                    disabled={loading}
                    aria-busy={loading}
                    className="mt-3 w-full cursor-pointer text-center text-xs text-slate-300 underline-offset-2 hover:text-white hover:underline disabled:opacity-60"
                  >
                    {pendingAction === "checkout"
                      ? "Opening checkout…"
                      : "Or add a card now (still 7 days free)"}
                  </button>
                </>
              )}

              {!isStatusPending && isSignedIn && !canStartTrial && (
                <>
                  <button
                    onClick={() => handleUpgrade("pricing_page")}
                    disabled={loading}
                    aria-busy={loading}
                    className="mt-6 w-full cursor-pointer rounded-xl bg-cyan-400 py-3.5 font-semibold text-slate-950 shadow-[0_0_35px_rgba(56,189,248,0.35)] transition-all hover:-translate-y-0.5 hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingAction === "checkout"
                      ? "Opening checkout…"
                      : "Subscribe to Pro"}
                  </button>
                  <p className="mt-4 text-center text-[11px] text-slate-300/85">
                    Secure checkout by Stripe
                  </p>
                </>
              )}

              <div className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-mono text-[11px] tracking-[0.14em] text-slate-400 uppercase">
                  Included in Pro
                </p>
                <ul className="space-y-2 text-sm text-slate-200">
                  {proPlanItems().map((item) => (
                    <li key={item.label} className="flex items-start gap-2">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300"
                        aria-hidden="true"
                      />
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>

          <section className="lg:col-start-1 lg:row-start-2">
            <div className="grid gap-4 sm:grid-cols-3 lg:mt-8">
              <SignalCard
                title="Aviation weather"
                value="Live"
                subtitle="NOTAMs, AIRMETs, SIGMETs, D-ATIS"
              />
              <SignalCard
                title="Flight history"
                value="Full"
                subtitle={`Free gets ${FREE_RECENT_FLIGHTS_LIMIT} recent flights, Pro gets your full archive`}
              />
              <SignalCard
                title="Charts access"
                value="Global"
                subtitle={`Unlimited airports worldwide. Free gets ${FREE_DAILY_ALLOWANCE.charts} US airports a day`}
              />
            </div>

            <div className="mt-10 space-y-6">
              <FeatureSection
                title="Weather intelligence"
                description="Stay ahead of hazardous conditions with real-time aviation weather feeds."
                features={[
                  "D-ATIS for US airports",
                  "International AIRMETs & SIGMETs",
                  "Full NOTAM access with decoded information",
                  "Global weather coverage",
                ]}
              />

              <FeatureSection
                title="Airport data"
                description="Procedures and charts where you need them while tracking flights."
                features={[
                  "Unlimited interactive airport charts",
                  "Detailed airport diagrams",
                  "Approach, SID, and STAR procedures",
                ]}
              />

              <FeatureSection
                title="Pilot analytics"
                description={`Track your flying activity with meaningful stats. Free includes your last ${FREE_RECENT_FLIGHTS_LIMIT} flights, and Pro unlocks the full archive.`}
                features={[
                  `Last ${FREE_RECENT_FLIGHTS_LIMIT} flights on Free`,
                  "Full flight history on Pro",
                  "Total flight time on Pro",
                  "Top aircraft, routes, and airports on Pro",
                ]}
              />
            </div>
          </section>
        </div>

        <PlanComparison />
        <PricingFaq />
      </main>
      <SiteFooter />
    </div>
  );
}

function PlanComparison() {
  return (
    <section aria-labelledby="compare-plans" className="mt-20">
      <h2
        id="compare-plans"
        className="text-2xl font-semibold tracking-tight text-white"
      >
        Compare plans
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
        Tracking your flights and watching live traffic will always be free. Pro
        adds deeper weather, charts, and controller tools for pilots who want
        more.
      </p>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 font-mono text-[11px] tracking-wider text-slate-400 uppercase">
              <th scope="col" className="px-5 py-3 font-medium">
                Feature
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Free
              </th>
              <th scope="col" className="px-5 py-3 font-medium text-cyan-200">
                Pro
              </th>
            </tr>
          </thead>
          <tbody>
            {planRows.map((row) => (
              <tr
                key={row.feature}
                className="border-b border-white/5 last:border-b-0"
              >
                <th
                  scope="row"
                  className="px-5 py-3 font-normal text-slate-200"
                >
                  {row.feature}
                </th>
                <td className="px-5 py-3 text-slate-400">
                  <PlanCell value={row.free} />
                </td>
                <td className="px-5 py-3 text-cyan-100">
                  <PlanCell value={row.pro} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const faqs: { question: string; answer: string }[] = [
  {
    question: "Do I need Pro to appear on the radar?",
    answer:
      "No. Anyone with the RadarThing userscript can transmit their GeoFS flight and appear on the live radar for free, and anyone can watch traffic without an account.",
  },
  {
    question: "How does the free trial work?",
    answer:
      "Sign in with Google and start a 7-day trial without entering a card. When the trial ends, your account returns to the free plan unless you choose to subscribe. If you prefer, you can add a card when you start; you will not be charged until the 7 days are over.",
  },
  {
    question: "What happens to my flights if I cancel?",
    answer: `Nothing is deleted. Your full history stays recorded, and your profile shows your ${FREE_RECENT_FLIGHTS_LIMIT} most recent flights on the free plan. Subscribe again at any time to see the full archive.`,
  },
  {
    question: "How do I cancel or change my payment details?",
    answer:
      "Open this page while signed in and choose Manage subscription. You will be taken to the secure Stripe customer portal, where you can cancel, update your card, or download invoices.",
  },
  {
    question: "Which airports have charts?",
    answer: `Free accounts can open charts for up to ${FREE_DAILY_ALLOWANCE.charts} US airports per UTC day, and reopening an airport you have already viewed that day does not count again. Pro removes the limit and includes airports worldwide. Not every airport has every procedure yet.`,
  },
  {
    question: "Where does my subscription go?",
    answer:
      "Pro subscriptions pay for the servers, weather and aviation data feeds, and ongoing development that keep RadarThing running for everyone, including free users.",
  },
];

function PricingFaq() {
  return (
    <section aria-labelledby="pricing-faq" className="mt-20">
      <h2
        id="pricing-faq"
        className="text-2xl font-semibold tracking-tight text-white"
      >
        Frequently asked questions
      </h2>
      <dl className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2">
        {faqs.map((faq) => (
          <div key={faq.question}>
            <dt className="font-medium text-white">{faq.question}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-slate-400">
              {faq.answer}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-10 text-sm text-slate-400">
        New to RadarThing? Read{" "}
        <Link
          href="/guides/getting-started"
          className="text-cyan-300 underline-offset-4 hover:underline"
        >
          Getting started
        </Link>{" "}
        or browse all{" "}
        <Link
          href="/guides"
          className="text-cyan-300 underline-offset-4 hover:underline"
        >
          guides
        </Link>
        .
      </p>
    </section>
  );
}

function SignalCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-4 backdrop-blur-xl">
      <p className="font-mono text-[11px] tracking-wider text-slate-400 uppercase">
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{subtitle}</p>
    </div>
  );
}

function FeatureSection({
  title,
  description,
  features,
}: {
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
      <h3 className="mb-1 text-lg font-semibold text-white">{title}</h3>
      <p className="mb-4 text-sm text-slate-300">{description}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {features.map((feature) => (
          <li
            key={feature}
            className="flex items-center gap-2 text-sm text-slate-200"
          >
            <Check className="h-4 w-4 shrink-0 text-cyan-300" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "—" is read as nothing by screen readers, so say "Not included". */
function PlanCell({ value }: { value: string }) {
  if (value !== NOT_INCLUDED) return <>{value}</>;
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">Not included</span>
    </>
  );
}
