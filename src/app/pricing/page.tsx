"use client";

import { useRouter } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";
import { createCheckoutSession } from "~/app/actions/create-checkout";
import { createPortalSession } from "~/app/actions/create-portal";
import { useState, useEffect } from "react";
import { useProStatus } from "~/hooks/useProStatus";
import { Check, Zap, ArrowLeft } from "lucide-react";
import Loading from "~/components/loading";
import Image from "next/image";
import { UserAuth } from "~/components/atc/userAuth";
import { Analytics } from "~/lib/analytics";

export default function PricingPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [loading, setLoading] = useState(false);

  const { isProUser, isLoading: checkingStatus } = useProStatus();

  useEffect(() => {
    if (isLoaded && !checkingStatus) {
      Analytics.pricingPageViewed();
    }
  }, [isLoaded, checkingStatus]);

  async function handleUpgrade() {
    Analytics.upgradeButtonClicked({ source: "pricing_page" });
    Analytics.checkoutStarted({ source: "pricing_page" });
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
  }

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

  if (!isLoaded || checkingStatus) {
    return <Loading />;
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header router={router} showAuth={false} />
        <main className="mx-auto max-w-lg px-6 py-24 text-center">
          <h1 className="mb-4 text-3xl font-bold text-white">
            Sign in to continue
          </h1>
          <p className="mb-8 text-slate-400">
            Create an account or sign in to upgrade your plan
          </p>
          <SignInButton mode="modal">
            <button className="cursor-pointer rounded-lg bg-white px-6 py-3 font-medium text-black transition-opacity hover:opacity-90">
              Sign In
            </button>
          </SignInButton>
        </main>
      </div>
    );
  }

  if (isProUser) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header router={router} showAuth={true} />
        <main className="mx-auto max-w-2xl px-6 py-24">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
              <Check className="h-6 w-6 text-emerald-400" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-white">
              You&apos;re on Pro
            </h1>
            <p className="mb-6 text-slate-400">
              You have access to all premium features
            </p>
            <button
              onClick={handleManageSubscription}
              disabled={loading}
              className="cursor-pointer rounded-lg border border-white/20 bg-white/5 px-6 py-2.5 text-sm text-white transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Manage Subscription"}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header router={router} showAuth={true} />

      <main className="mx-auto max-w-4xl px-6 py-16">
        {/* Hero */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1">
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
            <span className="font-mono text-xs text-cyan-400">PRO</span>
          </div>
          <h1 className="mb-4 text-4xl font-bold text-white">
            Upgrade to Pro
          </h1>
          <p className="mx-auto max-w-md text-lg text-slate-400">
            Advanced weather data, comprehensive analytics, and full flight history
          </p>
        </div>

        {/* Pricing Card */}
        <div className="mx-auto mb-16 max-w-sm">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
            <div className="mb-6 text-center">
              <div className="mb-1 text-4xl font-bold text-white">$3</div>
              <div className="text-slate-400">per month</div>
            </div>

            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="mb-4 w-full cursor-pointer rounded-lg bg-white py-3 font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Get Pro"}
            </button>

            <p className="text-center text-xs text-slate-500">
              Cancel anytime · Powered by Stripe
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-12">
          <FeatureSection
            title="Weather Intelligence"
            description="Stay ahead of hazardous conditions with real-time aviation weather data"
            features={[
              "D-ATIS for US airports",
              "International AIRMETs & SIGMETs",
              "Full NOTAM access with decoded information",
              "Global weather coverage",
            ]}
          />

          <FeatureSection
            title="Airport Data"
            description="Professional-grade airport information at your fingertips"
            features={[
              "Interactive airport charts",
              "Detailed airport diagrams",
            ]}
          />

          <FeatureSection
            title="Comprehensive Analytics"
            description="Track your flying career with detailed statistics"
            features={[
              "Complete flight history",
              "Flight time & distance tracking",
              "Top aircraft, routes, and airports",
            ]}
          />
        </div>
      </main>
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <h3 className="mb-1 text-lg font-semibold text-white">{title}</h3>
      <p className="mb-4 text-sm text-slate-400">{description}</p>
      <ul className="space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-3 text-sm text-slate-300">
            <Check className="h-4 w-4 shrink-0 text-cyan-400" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Header({
  router,
  showAuth,
}: {
  router: ReturnType<typeof useRouter>;
  showAuth: boolean;
}) {
  return (
    <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <button onClick={() => router.push("/radar")} className="cursor-pointer">
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
            className="flex cursor-pointer items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {showAuth && <UserAuth />}
        </div>
      </div>
    </header>
  );
}
