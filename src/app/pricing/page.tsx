"use client";

import { useRouter } from "next/navigation";
import { createCheckoutSession } from "~/app/actions/create-checkout";
import { createPortalSession } from "~/app/actions/create-portal";
import { useState, useEffect } from "react";
import { isPro } from "~/app/actions/is-pro";
import { Check, Zap } from "lucide-react";

export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isProUser, setIsProUser] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    isPro()
      .then(setIsProUser)
      .finally(() => setCheckingStatus(false));
  }, []);

  async function handleUpgrade() {
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

  const features = [
    { name: "Radar Mode", description: "Advanced radar visualization" },
    {
      name: "International AIRMETs/SIGMETs",
      description: "Global weather alerts",
    },
    {
      name: "Historic Flights",
      description: "Access your complete flight history",
    },
    {
      name: "Taxiway Charts",
      description: "Interactive airport taxi diagrams",
    },
  ];

  if (checkingStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="font-mono text-cyan-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <button
            onClick={() => router.push("/")}
            className="font-mono text-xl text-cyan-400"
          >
            RadarThing
          </button>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-slate-400 transition-colors hover:text-white"
          >
            Back to Map
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-6 py-20">
        {isProUser ? (
          // Pro User View
          <div className="text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              <span className="font-mono text-sm text-emerald-400">
                PRO MEMBER
              </span>
            </div>

            <h1 className="mb-4 bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-5xl font-bold text-transparent">
              {"You're All Set"}
            </h1>
            <p className="mb-12 text-xl text-slate-400">
              Enjoying all premium features
            </p>

            <div className="mx-auto mb-12 grid max-w-2xl gap-4 md:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature.name}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-emerald-500/20 p-1">
                      <Check className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {feature.name}
                      </div>
                      <div className="text-sm text-slate-400">
                        {feature.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleManageSubscription}
              disabled={loading}
              className="rounded-xl border border-white/10 bg-white/5 px-8 py-3 text-white backdrop-blur-xl transition-all hover:bg-white/10 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Manage Subscription"}
            </button>
          </div>
        ) : (
          // Free User View
          <div className="text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
              <Zap className="h-4 w-4 text-cyan-400" />
              <span className="font-mono text-sm text-cyan-400">
                UPGRADE TO PRO
              </span>
            </div>

            <h1 className="mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-5xl font-bold text-transparent">
              Unlock Premium Features
            </h1>
            <p className="mb-12 text-xl text-slate-400">
              Get access to advanced tools and data
            </p>

            {/* Pricing Card */}
            <div className="mx-auto mb-12 max-w-md">
              <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-cyan-500/10 to-transparent p-8 backdrop-blur-xl">
                <div className="mb-6">
                  <div className="mb-2 text-5xl font-bold text-white">
                    $9.99
                    <span className="text-xl text-slate-400">/month</span>
                  </div>
                  <div className="font-mono text-sm text-cyan-400">
                    CANCEL ANYTIME
                  </div>
                </div>

                <button
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-8 py-4 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40 disabled:opacity-50"
                >
                  {loading ? "Loading..." : "Upgrade Now"}
                </button>

                <div className="mt-4 text-xs text-slate-500">
                  Secure payment powered by Stripe
                </div>
              </div>
            </div>

            {/* Features List */}
            <div className="mx-auto grid max-w-2xl gap-4 md:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature.name}
                  className="rounded-xl border border-white/10 bg-black/40 p-6 text-left backdrop-blur-xl"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-cyan-500/20 p-1.5">
                      <Check className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div>
                      <div className="mb-1 font-semibold text-white">
                        {feature.name}
                      </div>
                      <div className="text-sm text-slate-400">
                        {feature.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
