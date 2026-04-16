"use client";

import { useEffect } from "react";
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

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
          <h2 className="mb-4 text-2xl font-bold text-red-400">
            Something went wrong
          </h2>
          <p className="mb-6 text-slate-400">An unexpected error occurred.</p>
          <button
            onClick={reset}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-black transition-colors hover:bg-cyan-400"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
