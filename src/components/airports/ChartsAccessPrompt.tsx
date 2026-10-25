"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { GoogleSignInButton } from "~/components/auth/GoogleSignInButton";
import type { ChartsAccessErrorCode } from "~/hooks/useAirportCharts";
import { useProStatus } from "~/hooks/useProStatus";
import { Analytics } from "~/lib/analytics";

const buttonClassName =
  "cursor-pointer rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:from-cyan-400 hover:to-blue-400";

export function ChartsAccessPrompt({
  code,
  message,
  source,
}: {
  code: ChartsAccessErrorCode;
  message: string | null;
  source: string;
}) {
  const { canStartTrial } = useProStatus();

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 text-center">
      <Lock className="h-6 w-6 text-cyan-400" />
      <p className="max-w-xs text-xs text-slate-300">{message}</p>
      {code === "SIGN_IN_REQUIRED" ? (
        <GoogleSignInButton
          redirectTo={
            typeof window === "undefined"
              ? undefined
              : window.location.pathname + window.location.search
          }
        >
          <button className={buttonClassName}>Continue with Google</button>
        </GoogleSignInButton>
      ) : (
        <Link
          href="/pricing"
          onClick={() =>
            Analytics.upgradeButtonClicked({
              source,
              feature:
                code === "FREE_LIMIT_REACHED" ? "charts_daily_limit" : "charts",
            })
          }
          className={buttonClassName}
        >
          {canStartTrial ? "Try PRO free for 7 days" : "Upgrade to PRO"}
        </Link>
      )}
    </div>
  );
}
