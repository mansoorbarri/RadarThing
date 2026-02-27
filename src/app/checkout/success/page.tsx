"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { syncAfterCheckout } from "~/app/actions/sync-stripe";
import { Check, Loader2 } from "lucide-react";
import { Analytics } from "~/lib/analytics";

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"syncing" | "success" | "error">(
    "syncing",
  );

  useEffect(() => {
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
          setStatus("error");
          // Still redirect, webhook will handle it
          setTimeout(() => {
            router.push("/radar");
          }, 2000);
        }
      })
      .catch((err) => {
        console.error("Sync error:", err);
        setStatus("error");
        setTimeout(() => {
          router.push("/radar");
        }, 2000);
      });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="text-center">
        {status === "syncing" && (
          <>
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-cyan-400" />
            <h1 className="mb-2 text-2xl font-bold text-white">
              Setting up your account...
            </h1>
            <p className="text-slate-400">This will only take a moment</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
              <Check className="h-8 w-8 text-emerald-400" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-white">
              Welcome to PRO!
            </h1>
            <p className="text-slate-400">Redirecting you now...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
              <Check className="h-8 w-8 text-amber-400" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-white">
              Payment received!
            </h1>
            <p className="text-slate-400">
              Your account will be upgraded shortly...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
