import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "~/components/site/SiteFooter";
import { SiteHeader } from "~/components/site/SiteHeader";

export function LegalPage({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#02090d] text-slate-100">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.035) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "linear-gradient(to bottom, black, transparent 70%)",
        }}
      />

      <SiteHeader />

      <main
        id="main-content"
        className="relative mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 md:grid-cols-[220px_minmax(0,1fr)] md:py-20"
      >
        <aside>
          <p className="font-mono text-[10px] tracking-[0.24em] text-cyan-300/70 uppercase">
            {eyebrow}
          </p>
          <p className="mt-4 text-xs leading-5 text-white/60">
            Effective 28 August 2026
            <br />
            Last updated 28 August 2026
          </p>
          <nav
            aria-label="Legal pages"
            className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/70 md:mt-8 md:block md:space-y-2"
          >
            <LegalLink href="/privacy">Privacy</LegalLink>
            <LegalLink href="/cookies">Cookies</LegalLink>
            <LegalLink href="/terms">Terms</LegalLink>
            <LegalLink href="/copyright">Copyright</LegalLink>
            <LegalLink href="/contact">Contact</LegalLink>
          </nav>
        </aside>

        <article className="max-w-3xl min-w-0">
          <h1 className="text-4xl leading-tight font-semibold tracking-[-0.035em] text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/75">
            {summary}
          </p>
          <div className="legal-copy mt-12 space-y-10">{children}</div>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}

function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="block border-l border-white/20 py-1 pl-3 transition-colors hover:border-cyan-300/50 hover:text-cyan-200"
    >
      {children}
    </Link>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight text-white">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-white/75">
        {children}
      </div>
    </section>
  );
}
