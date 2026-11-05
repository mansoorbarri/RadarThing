import type { ReactNode } from "react";
import { SiteFooter } from "~/components/site/SiteFooter";
import { SiteHeader } from "~/components/site/SiteHeader";

export default function GuidesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#02090d] text-slate-100">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12 md:py-20">{children}</main>
      <SiteFooter />
    </div>
  );
}
