"use client";

// The root layout has crashed, so client-side state may be broken. These
// links are plain anchors on purpose: a full page load is the recovery.
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect } from "react";
import "~/styles/globals.css";
import { Analytics } from "~/lib/analytics";
import { getClientDiagnosticsContext } from "~/lib/clientDiagnostics";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Analytics.captureException(error, {
      source: "next_global_error",
      digest: error.digest,
      ...getClientDiagnosticsContext(),
    });
  }, [error]);

  // Replaces the root layout, so it must bring its own <html lang>, styles
  // (the app's providers aren't available here).
  return (
    <html lang="en" className="dark">
      <body className="bg-site">
        <main
          id="main-content"
          role="alert"
          className="flex min-h-screen flex-col items-center justify-center px-6 text-center text-white"
        >
          <h1 className="mb-4 text-2xl font-bold text-red-300">
            RadarThing hit an unexpected error
          </h1>
          <p className="mb-6 max-w-md text-slate-300">
            Try again. If it keeps happening, reload the page or contact us.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition-colors hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none"
            >
              Try again
            </button>
            <a
              href="/"
              className="rounded-lg border border-white/15 px-5 py-3 font-medium text-white hover:bg-white/5"
            >
              Home page
            </a>
            <a
              href="/contact"
              className="rounded-lg px-5 py-3 font-medium text-cyan-200 hover:underline"
            >
              Contact us
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
