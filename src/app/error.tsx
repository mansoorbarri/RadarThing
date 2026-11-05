"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Analytics } from "~/lib/analytics";
import { getClientDiagnosticsContext } from "~/lib/clientDiagnostics";

/**
 * Route-level error page. Unlike global-error it keeps the root layout (fonts,
 * providers, styles), so a crash in one page doesn't blank the whole site.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Analytics.captureException(error, {
      source: "next_route_error",
      digest: error.digest,
      ...getClientDiagnosticsContext(),
    });
  }, [error]);

  return (
    <main
      role="alert"
      className="flex min-h-screen items-center justify-center bg-[#02090d] px-6 text-slate-100"
    >
      <div className="w-full max-w-lg rounded-2xl border border-red-400/25 bg-[#08151c] p-8">
        <AlertTriangle className="h-8 w-8 text-red-300" aria-hidden="true" />
        <h1 className="mt-5 text-2xl font-semibold text-white">
          Something went wrong on this page
        </h1>
        <p className="mt-3 leading-7 text-slate-300">
          It wasn&apos;t anything you did. Try again, and if it keeps happening
          let us know what you were doing.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-slate-400">
            Reference: {error.digest}
          </p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-black transition-colors hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none"
          >
            Try again
          </button>
          <Link
            href="/radar"
            className="rounded-lg border border-white/15 px-5 py-3 font-medium text-white transition-colors hover:bg-white/5"
          >
            Back to the radar
          </Link>
          <Link
            href="/contact"
            className="rounded-lg px-5 py-3 font-medium text-cyan-200 underline-offset-4 hover:underline"
          >
            Report the problem
          </Link>
        </div>
      </div>
    </main>
  );
}
