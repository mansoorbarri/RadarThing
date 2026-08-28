"use client";

import { useEffect, useRef } from "react";
import { useProStatus } from "~/hooks/useProStatus";
import { loadAdSenseScript } from "./AdSenseAnchor";

const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT ?? "ca-pub-5174559718233522";
const ADSENSE_SLOT =
  process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT ?? "8811855745";

type AdSenseInContentProps = {
  placement: "telemetry" | "gallery-card";
};

export function AdSenseInContent({ placement }: AdSenseInContentProps) {
  const { isProUser, isLoading } = useProStatus();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      isLoading ||
      isProUser ||
      initializedRef.current
    ) {
      return;
    }

    loadAdSenseScript();
    (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    initializedRef.current = true;
  }, [isLoading, isProUser]);

  if (isLoading || isProUser) return null;

  const isGalleryCard = placement === "gallery-card";

  return (
    <aside
      aria-label="Advertisement"
      className={
        isGalleryCard
          ? "flex min-h-64 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl"
          : "overflow-hidden rounded-2xl border border-white/10 bg-black/30"
      }
    >
      <div className="border-b border-white/10 px-3 py-2 text-center font-mono text-[8px] font-bold tracking-[0.22em] text-slate-500 uppercase">
        Advertisement
      </div>
      {process.env.NODE_ENV === "production" ? (
        <ins
          className={`adsbygoogle block ${
            isGalleryCard ? "min-h-56 flex-1" : "min-h-24"
          }`}
          style={{ display: "block" }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={ADSENSE_SLOT}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : (
        <div
          className={`flex items-center justify-center px-4 text-center font-mono text-[10px] tracking-wider text-slate-600 uppercase ${
            isGalleryCard ? "min-h-56 flex-1" : "min-h-24"
          }`}
        >
          Ad preview · free plan
        </div>
      )}
    </aside>
  );
}
