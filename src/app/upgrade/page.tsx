"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { UserAuth } from "~/components/atc/userAuth";

export default function UpgradePage() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black via-black/80 to-black" />

      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <Image
            src="/favicon.ico"
            alt="RadarThing"
            width={32}
            height={32}
            className="select-none"
          />
          <span className="font-mono text-sm tracking-widest text-cyan-400">
            RADARTHING
          </span>
        </div>

        <div className="flex items-center gap-4">
          <UserAuth />
          <button
            onClick={() => router.back()}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10"
          >
            Back
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 py-16">
        <div className="mb-10 text-center">
          <span className="inline-block rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1 text-[10px] tracking-widest text-cyan-400 uppercase">
            Premium Access
          </span>

          <h1 className="mt-6 font-mono text-4xl font-semibold tracking-tight text-white">
            Unlock Taxi Charts & Advanced ATC Tools
          </h1>

          <p className="mt-4 max-w-2xl text-sm text-slate-400">
            RadarThing Premium gives you real‑world airport taxi charts,
            enhanced situational awareness, and upcoming professional ATC
            features — all integrated directly into the radar.
          </p>
        </div>

        <div className="grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          <FeatureCard
            title="Airport Taxi Charts"
            description="Instant access to airport taxi diagrams directly from the radar view."
          />

          <FeatureCard
            title="ATC‑Focused UI Enhancements"
            description="Cleaner radar views, better filtering, and advanced controls designed for realism."
          />

          <FeatureCard
            title="Future Features Included"
            description="Runway layouts, SID/STAR overlays, airport info panels, and more — no extra cost."
          />

          <FeatureCard
            title="Support RadarThing Development"
            description="Your upgrade directly supports continued development and new features."
          />
        </div>

        <div className="mt-14 flex flex-col items-center gap-4">
          <button
            onClick={() => {
              alert("Stripe / payment flow goes here");
            }}
            className="rounded-xl border border-cyan-500/40 bg-cyan-500/20 px-10 py-4 font-mono text-sm tracking-widest text-cyan-300 uppercase transition hover:bg-cyan-500/30"
          >
            Upgrade to Premium
          </button>

          <span className="text-[10px] text-slate-500">
            One subscription · Cancel anytime
          </span>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
      <h3 className="font-mono text-sm tracking-wide text-cyan-300">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        {description}
      </p>
    </div>
  );
}
