"use client";

import { useEffect, useRef, useState } from "react";
import { useProStatus } from "~/hooks/useProStatus";

const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT ?? "ca-pub-5174559718233522";
const ADSENSE_SLOT =
  process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT ?? "8811855745";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

function loadAdSenseScript() {
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
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(script);
}

export function AdSenseUnit({ className = "" }: { className?: string }) {
  const { isProUser, isLoading } = useProStatus();
  const requested = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (
      !mounted ||
      isLoading ||
      isProUser ||
      process.env.NODE_ENV !== "production" ||
      !ADSENSE_SLOT ||
      requested.current
    ) {
      return;
    }

    loadAdSenseScript();
    requested.current = true;

    const timer = window.setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle ?? []).push({});
      } catch (error) {
        console.warn("AdSense unit could not be requested", error);
      }
    }, 50);

    return () => window.clearTimeout(timer);
  }, [isLoading, isProUser, mounted]);

  if (!mounted || isLoading || isProUser) return null;

  if (process.env.NODE_ENV !== "production") {
    return (
      <aside
        aria-label="Advertisement preview"
        className={`mx-auto flex min-h-24 w-full max-w-5xl items-center justify-center border border-dashed border-cyan-300/15 bg-cyan-300/[0.025] ${className}`}
      >
        <span className="font-mono text-[10px] tracking-[0.2em] text-cyan-200/35 uppercase">
          Free-tier advertisement
        </span>
      </aside>
    );
  }

  if (!ADSENSE_SLOT) return null;

  return (
    <aside aria-label="Advertisement" className={className}>
      <p className="mb-2 text-center font-mono text-[9px] tracking-[0.22em] text-white/25 uppercase">
        Advertisement
      </p>
      <ins
        className="adsbygoogle block min-h-[90px] w-full"
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
