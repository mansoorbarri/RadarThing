import Link from "next/link";
import { Plane } from "lucide-react";
import type { Metadata } from "next";
import { SiteFooter } from "~/components/site/SiteFooter";
import { SiteHeader } from "~/components/site/SiteHeader";

export const metadata: Metadata = {
  title: "Pilot Not Found",
  robots: { index: false, follow: false },
};

export default function PilotNotFound() {
  return (
    <div className="pilot-theme-surface bg-site flex min-h-screen flex-col text-white">
      <SiteHeader tone="themed" />
      <main
        id="main-content"
        className="flex flex-1 items-center justify-center px-4 sm:px-6"
      >
        <section className="w-full max-w-xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2">
            <Plane className="h-4 w-4 text-red-400" aria-hidden="true" />
            <span className="font-mono text-sm text-red-400">
              PILOT NOT FOUND
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            This pilot doesn&apos;t exist
          </h1>
          <p className="mx-auto mt-4 max-w-md text-slate-400">
            This Discord username isn&apos;t linked to a RadarThing pilot
            profile.
          </p>
          <Link
            href="/radar"
            className="mt-8 inline-flex rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-shadow hover:bg-cyan-300 hover:shadow-cyan-500/40"
          >
            Back to the radar
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
