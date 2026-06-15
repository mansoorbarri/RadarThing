"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { createCheckoutSession } from "~/app/actions/create-checkout";
import { createPortalSession } from "~/app/actions/create-portal";
import { useState, useEffect, useRef, useCallback } from "react";
import { useProStatus } from "~/hooks/useProStatus";
import { Check, Zap, ArrowLeft } from "lucide-react";
import Loading from "~/components/loading";
import Image from "next/image";
import { UserAuth } from "~/components/atc/userAuth";
import { GoogleSignInButton } from "~/components/auth/GoogleSignInButton";
import { Analytics } from "~/lib/analytics";
import { FREE_RECENT_FLIGHTS_LIMIT } from "~/lib/flightHistory";

export default function PricingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useUser();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const autoCheckoutStartedRef = useRef(false);

  const { isProUser, isLoading: checkingStatus } = useProStatus();

  useEffect(() => {
    setMounted(true);
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
        setLoading(true);
        const url = await createCheckoutSession();
        if (url) window.location.href = url;
      } catch (err) {
        console.error(err);
        alert("Failed to create checkout session");
      } finally {
        setLoading(false);
      }
    },
    [isSignedIn],
  );

  useEffect(() => {
    if (!isLoaded || checkingStatus || !isSignedIn) return;
    if (searchParams?.get("checkout") !== "1") return;
    if (autoCheckoutStartedRef.current) return;

    autoCheckoutStartedRef.current = true;
    void handleUpgrade("pricing_page_post_signin");
  }, [isLoaded, checkingStatus, isSignedIn, searchParams, handleUpgrade]);

  async function handleManageSubscription() {
    try {
      setLoading(true);
      const url = await createPortalSession();
      if (url) window.location.href = url;
    } catch (err) {
      console.error(err);
      alert("Failed to open customer portal");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted || !isLoaded || checkingStatus) {
    return <Loading />;
  }

  if (isProUser) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#03070d] text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-20 -left-24 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute -right-28 bottom-10 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        </div>
        <Header router={router} />
        <main className="relative mx-auto max-w-2xl px-6 py-24">
          <div className="rounded-3xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/12 via-cyan-500/8 to-blue-500/10 p-10 text-center shadow-[0_0_80px_rgba(16,185,129,0.12)] backdrop-blur-xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/15">
              <Check className="h-7 w-7 text-emerald-300" />
            </div>
            <p className="mb-2 font-mono text-[11px] tracking-[0.18em] text-emerald-300/80 uppercase">
              Subscription Active
            </p>
            <h1 className="mb-3 text-3xl font-bold text-white">
              You&apos;re flying with PRO
            </h1>
            <p className="mb-8 text-slate-300">
              Weather intel, charts, and full analytics are unlocked on your
              account, including your full flight history.
            </p>
            <button
              onClick={handleManageSubscription}
              disabled={loading}
              className="cursor-pointer rounded-xl border border-white/20 bg-white/8 px-6 py-3 text-sm font-semibold text-white transition-all hover:border-cyan-300/40 hover:bg-white/14 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Manage Subscription"}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#03070d] text-white">
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

      <Header router={router} />

      <main className="relative mx-auto max-w-5xl px-6 py-14 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <section>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-3 py-1.5">
              <Zap className="h-3.5 w-3.5 text-cyan-300" />
              <span className="font-mono text-[11px] tracking-wider text-cyan-200 uppercase">
                PRO FLIGHT DECK
              </span>
            </div>
            <h1 className="max-w-xl text-4xl leading-tight font-bold text-white md:text-5xl">
              Fly with full situational awareness
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 md:text-lg">
              Upgrade to RadarThing PRO for advanced weather intelligence,
              airport charts, and deep flight analytics built for serious GeoFS
              pilots.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <SignalCard
                title="Aviation Weather"
                value="Live"
                subtitle="NOTAMs, AIRMETs, SIGMETs, D-ATIS"
              />
              <SignalCard
                title="Flight History"
                value="Full"
                subtitle={`Free gets ${FREE_RECENT_FLIGHTS_LIMIT} recent flights, PRO gets your full archive`}
              />
              <SignalCard
                title="Charts Access"
                value="Global"
                subtitle="Taxi, SID, STAR, approach procedures"
              />
            </div>

            <div className="mt-10 space-y-6">
              <FeatureSection
                title="Weather Intelligence"
                description="Stay ahead of hazardous conditions with real-time aviation weather feeds."
                features={[
                  "D-ATIS for US airports",
                  "International AIRMETs & SIGMETs",
                  "Full NOTAM access with decoded information",
                  "Global weather coverage",
                ]}
              />

              <FeatureSection
                title="Airport Data"
                description="Procedures and charts where you need them while tracking flights."
                features={[
                  "Interactive airport charts",
                  "Detailed airport diagrams",
                  "Approach, SID, and STAR procedures",
                ]}
              />

              <FeatureSection
                title="Comprehensive Analytics"
                description={`Track your flying activity with meaningful stats. Free includes your last ${FREE_RECENT_FLIGHTS_LIMIT} flights, and PRO unlocks the full archive.`}
                features={[
                  `Last ${FREE_RECENT_FLIGHTS_LIMIT} flights on Free`,
                  "Full flight history on PRO",
                  "Flight time & distance tracking",
                  "Top aircraft, routes, and airports",
                ]}
              />
            </div>
          </section>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative overflow-hidden rounded-3xl border border-cyan-400/25 bg-[#07101a]/85 p-7 shadow-[0_20px_70px_rgba(6,182,212,0.18)] backdrop-blur-xl">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
              <p className="font-mono text-[11px] tracking-[0.16em] text-cyan-200/80 uppercase">
                Pro Subscription
              </p>
              <div className="mt-3 flex items-end gap-2">
                <div className="text-5xl font-bold text-white">$3</div>
                <div className="pb-1 text-slate-300">/ month</div>
              </div>
              <p className="mt-2 text-sm text-cyan-100/85">
                Start with a 7-day free trial. Cancel anytime.
              </p>

              {!isSignedIn && (
                <GoogleSignInButton redirectTo="/pricing?checkout=1">
                  <button
                    onClick={() =>
                      Analytics.upgradeButtonClicked({
                        source: "pricing_page_signed_out",
                        feature: "pro_plan",
                      })
                    }
                    className="mt-6 w-full cursor-pointer rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 py-3.5 font-semibold text-white shadow-[0_0_35px_rgba(56,189,248,0.35)] transition-all hover:-translate-y-0.5 hover:from-cyan-300 hover:to-blue-400"
                  >
                    Continue with Google
                  </button>
                </GoogleSignInButton>
              )}

              {isSignedIn && (
                <button
                  onClick={() => handleUpgrade("pricing_page")}
                  disabled={loading}
                  className="mt-6 w-full cursor-pointer rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 py-3.5 font-semibold text-white shadow-[0_0_35px_rgba(56,189,248,0.35)] transition-all hover:-translate-y-0.5 hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Loading..." : "Start 7-day free trial"}
                </button>
              )}

              <p className="mt-4 text-center text-[11px] text-slate-300/85">
                Secure checkout by Stripe
              </p>

              <div className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-mono text-[10px] tracking-[0.14em] text-slate-400 uppercase">
                  Included in PRO
                </p>
                <ul className="space-y-2 text-sm text-slate-200">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-cyan-300" />
                    Full NOTAM/AIRMET/SIGMET access
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-cyan-300" />
                    Airport charts and procedures
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-cyan-300" />
                    Complete pilot analytics
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-cyan-300" />
                    Full flight history beyond the free{" "}
                    {FREE_RECENT_FLIGHTS_LIMIT}
                    -flight view
                  </li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
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
      <p className="font-mono text-[10px] tracking-wider text-slate-400 uppercase">
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

function Header({
  router,
}: {
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <header className="relative z-10 border-b border-white/10 bg-black/35 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <button
          onClick={() => router.push("/radar")}
          className="cursor-pointer"
        >
          <Image
            src="/logo-white.svg"
            alt="RadarThing"
            width={100}
            height={30}
          />
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/radar")}
            className="flex cursor-pointer items-center gap-2 text-sm text-slate-300 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <UserAuth />
        </div>
      </div>
    </header>
  );
}
