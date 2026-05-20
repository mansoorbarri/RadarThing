"use client";

import { AlertTriangle, ArrowUpRight } from "lucide-react";

import { Analytics } from "~/lib/analytics";

const RAILWAY_STATUS_URL = "https://status.railway.com";

export function SiteOutageBanner() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[10040] flex justify-center px-3 pt-3">
      <div className="pointer-events-auto w-full max-w-5xl rounded-2xl border border-red-500/30 bg-[linear-gradient(135deg,rgba(127,29,29,0.96),rgba(24,24,27,0.97))] shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 rounded-full border border-red-300/20 bg-red-200/10 p-2 text-red-200">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-[0.24em] text-red-100/75 uppercase">
                Service Outage
              </div>
              <p className="mt-1 text-sm font-semibold text-white">
                Aircraft positions are currently unavailable.
              </p>
              <p className="mt-1 text-xs leading-5 text-red-50/75 sm:text-sm">
                Railway is having issues upstream, so the live traffic feed may
                be empty or delayed until their service recovers.
              </p>
            </div>
          </div>

          <a
            href={RAILWAY_STATUS_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              Analytics.track("service_outage_status_clicked", {
                provider: "railway",
                url: RAILWAY_STATUS_URL,
              });
            }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-black/40"
          >
            Check Railway Status
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
