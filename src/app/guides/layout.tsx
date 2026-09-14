import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export default function GuidesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#02090d] text-slate-100">
      <header className="border-b border-white/10">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-6"
        >
          <Link href="/" aria-label="RadarThing home">
            <Image
              src="/logo-white.svg"
              alt="RadarThing"
              width={118}
              height={36}
            />
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/guides" className="text-cyan-300 hover:underline">
              Guides
            </Link>
            <Link
              href="/radar"
              className="border border-cyan-300/30 px-4 py-2 text-cyan-200 hover:bg-cyan-300/10"
            >
              Open radar ↗
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-12 md:py-20">{children}</main>
      <footer className="mx-auto flex max-w-6xl flex-wrap gap-6 border-t border-white/10 px-6 py-8 text-sm text-slate-400">
        <Link href="/about" className="hover:text-white">
          About
        </Link>
        <Link href="/privacy" className="hover:text-white">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-white">
          Terms
        </Link>
        <Link href="/contact" className="hover:text-white">
          Contact
        </Link>
      </footer>
    </div>
  );
}
