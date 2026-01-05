import Image from "next/image";
import { PricingTable } from "@clerk/nextjs";
import { UserAuth } from "~/components/atc/userAuth";
import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="relative min-h-screen w-screen bg-black text-white">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black via-black/80 to-black" />

      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/favicon.ico" alt="RadarThing" width={32} height={32} />
          <span className="font-mono text-sm tracking-widest text-cyan-400">
            RADARTHING
          </span>
        </Link>

        <UserAuth />
      </header>

      <main className="relative mx-auto max-w-5xl px-6 py-20">
        <div className="mb-12 text-center">
          <span className="inline-block rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1 text-[10px] tracking-widest text-cyan-400 uppercase">
            Pricing
          </span>

          <h1 className="mt-6 font-mono text-4xl font-semibold tracking-tight">
            Upgrade your Radar
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm text-slate-400">
            RadarThing PRO unlocks real‑world airport taxi charts, advanced
            ATC‑focused tools, and upcoming professional features — all directly
            inside the radar.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <PricingTable />
        </div>

        <p className="mt-6 text-center text-[10px] text-slate-500">
          Cancel anytime · Secure checkout · No hidden fees
        </p>
      </main>
    </div>
  );
}
