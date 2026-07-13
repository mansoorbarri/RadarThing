import Link from "next/link";
import { Plane } from "lucide-react";

export default function PilotNotFound() {
  return (
    <main className="pilot-theme-surface flex min-h-screen items-center justify-center bg-black px-4 text-white sm:px-6">
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
          This Discord username isn&apos;t linked to a RadarThing pilot profile.
        </p>
        <Link
          href="/radar"
          className="mt-8 inline-flex rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-shadow hover:shadow-cyan-500/40"
        >
          Back to Map
        </Link>
      </section>
    </main>
  );
}
