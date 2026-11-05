"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { syncAfterCheckout } from "~/app/actions/sync-stripe";
import { Check, Clock, Loader2 } from "lucide-react";
import { Analytics } from "~/lib/analytics";
import { SiteFooter } from "~/components/site/SiteFooter";
import { SiteHeader } from "~/components/site/SiteHeader";

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"syncing" | "success" | "pending">(
    "syncing",
  );

  const sync = useCallback(() => {
    setStatus("syncing");
    syncAfterCheckout()
      .then((result) => {
        if (result.success) {
          setStatus("success");
          Analytics.checkoutCompleted();
          // Redirect after showing success briefly
          setTimeout(() => {
            router.push("/radar?upgraded=true");
          }, 1500);
        } else {
          console.error("Sync failed:", result.error);
          // Stripe's webhook will still upgrade the account; tell the user
          // honestly and let them choose what to do instead of redirecting.
          setStatus("pending");
        }
      })
      .catch((err) => {
        console.error("Sync error:", err);
        setStatus("pending");
      });
  }, [router]);

  useEffect(() => {
    sync();
  }, [sync]);

  return (
    <div className="flex min-h-screen flex-col bg-[#02090d]">
      <SiteHeader />
      <main
        id="main-content"
        className="flex flex-1 items-center justify-center px-6 py-16"
      >
        <div className="max-w-md text-center" role="status" aria-live="polite">
          {status === "syncing" && (
            <>
              <Loader2
                className="mx-auto mb-4 h-12 w-12 animate-spin text-cyan-400"
                aria-hidden="true"
              />
              <h1 className="mb-2 text-2xl font-bold text-white">
                Setting up your Pro account…
              </h1>
              <p className="text-slate-300">This only takes a moment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                <Check
                  className="h-8 w-8 text-emerald-400"
                  aria-hidden="true"
                />
              </div>
              <h1 className="mb-2 text-2xl font-bold text-white">
                Welcome to Pro!
              </h1>
              <p className="text-slate-300">Taking you to the radar…</p>
            </>
          )}

          {status === "pending" && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
                <Clock className="h-8 w-8 text-amber-300" aria-hidden="true" />
              </div>
              <h1 className="mb-2 text-2xl font-bold text-white">
                Payment received. Finishing your upgrade
              </h1>
              <p className="text-slate-300">
                We couldn&apos;t confirm Pro on your account yet. It usually
                appears within a minute or two. If it still hasn&apos;t after 10
                minutes, contact us and we&apos;ll sort it out.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={sync}
                  className="rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-black transition-colors hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none"
                >
                  Check again
                </button>
                <Link
                  href="/radar"
                  className="rounded-lg border border-white/15 px-5 py-3 font-medium text-white hover:bg-white/5"
                >
                  Go to the radar
                </Link>
                <Link
                  href="/contact"
                  className="rounded-lg px-5 py-3 font-medium text-cyan-200 underline-offset-4 hover:underline"
                >
                  Contact support
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
