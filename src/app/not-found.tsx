import Link from "next/link";
import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { SiteFooter } from "~/components/site/SiteFooter";
import { SiteHeader } from "~/components/site/SiteHeader";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[#02090d] text-slate-100">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center px-6 py-20">
        <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 font-mono text-xs tracking-widest text-cyan-200 uppercase">
          <Compass className="h-4 w-4" aria-hidden="true" />
          Error 404
        </p>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          This page is off the map
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-slate-300">
          The link may be old or mistyped. Try the live radar, or look for the
          flight, pilot or airport you wanted from there.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/radar"
            className="rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-black transition-colors hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none"
          >
            Open the radar
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-white/15 px-5 py-3 font-medium text-white transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none"
          >
            Go to the home page
          </Link>
          <Link
            href="/guides"
            className="rounded-lg border border-white/15 px-5 py-3 font-medium text-white transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none"
          >
            Browse guides
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
