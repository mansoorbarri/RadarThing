import type { Metadata } from "next";
import Link from "next/link";
import { guides } from "~/lib/guides";

export const metadata: Metadata = {
  title: "Help & Guides",
  description:
    "Practical guides to tracking GeoFS flights, troubleshooting RadarThing, and replaying your flight history.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <>
      <p className="mb-5 font-mono text-xs tracking-[0.22em] text-cyan-300 uppercase">
        RadarThing / Field manual
      </p>
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-6xl">
        A clearer view of your next flight.
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
        Set up your tracker, learn the radar, and revisit your routes. Start
        here or jump straight to the problem you need to solve.
      </p>
      <div className="mt-14 border-t border-white/15">
        {guides.map((guide, index) => (
          <Link
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            className="group grid gap-4 border-b border-white/15 py-8 transition-colors hover:bg-cyan-300/5 sm:grid-cols-[4rem_1fr_auto] sm:px-4"
          >
            <span className="font-mono text-sm text-cyan-300/70">
              0{index + 1}
            </span>
            <div>
              <h2 className="text-xl font-medium text-white group-hover:text-cyan-200">
                {guide.title}
              </h2>
              <p className="mt-2 leading-7 text-slate-400">
                {guide.description}
              </p>
            </div>
            <span aria-hidden="true" className="text-2xl text-cyan-300">
              ↗
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-10 text-slate-400">
        Still stuck?{" "}
        <Link
          href="/contact"
          className="text-cyan-200 underline underline-offset-4"
        >
          Contact support
        </Link>{" "}
        with the step you reached and what happened.
      </p>
    </>
  );
}
