"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useProStatus } from "~/hooks/useProStatus";

const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT ?? "ca-pub-5174559718233522";

const MONETIZED_ROUTES = [
  "/radar",
  "/aircraft-images",
  "/airport-charts",
  "/leaderboard",
  "/pilot",
] as const;

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

function isMonetizedRoute(pathname: string) {
  return MONETIZED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function loadAdSenseScript() {
  if (document.querySelector('script[data-radarthing-adsense="true"]')) {
    return;
  }

  window.googlefc = window.googlefc ?? { callbackQueue: [] };
  if (new URLSearchParams(window.location.search).get("privacy") === "ads") {
    window.googlefc.callbackQueue.push(() => {
      window.googlefc?.showRevocationMessage?.();
      const url = new URL(window.location.href);
      url.searchParams.delete("privacy");
      window.history.replaceState({}, "", url);
    });
  }

  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.dataset.radarthingAdsense = "true";
  // This Google-supported option forces dynamic/collapsible anchors to the
  // bottom edge instead of allowing a top placement.
  script.dataset.overlays = "bottom";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(script);
}

export function AdSenseAnchor() {
  const pathname = usePathname();
  const { isProUser, isLoading } = useProStatus();

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      isLoading ||
      isProUser ||
      !pathname ||
      !isMonetizedRoute(pathname)
    ) {
      return;
    }

    loadAdSenseScript();
  }, [isLoading, isProUser, pathname]);

  return null;
}
