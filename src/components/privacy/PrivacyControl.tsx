"use client";

import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { usePrivacyConsent } from "./PrivacyConsentProvider";

export function PrivacyControl() {
  const pathname = usePathname();
  const { openPrivacySettings } = usePrivacyConsent();

  if (pathname === "/radar") return null;

  return (
    <button
      type="button"
      onClick={openPrivacySettings}
      className="fixed bottom-3 left-3 z-[10010] inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#041017]/90 px-3 py-2 font-mono text-[10px] tracking-[0.12em] text-white/60 uppercase shadow-lg backdrop-blur-md transition-colors hover:border-cyan-300/30 hover:text-cyan-200"
      aria-label="Open privacy settings"
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      Privacy
    </button>
  );
}
