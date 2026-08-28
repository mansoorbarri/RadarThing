import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

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

      <header className="relative border-b border-white/7">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" aria-label="RadarThing home">
            <Image
              src="/logo-white.svg"
              alt="RadarThing"
              width={118}
              height={36}
              priority
            />
          </Link>
          <div className="flex items-center gap-4 text-xs text-white/50 sm:gap-6">
            <Link href="/about" className="hover:text-white">
              About
            </Link>
            <Link href="/contact" className="hover:text-white">
              Contact
            </Link>
            <Link
              href="/radar"
              className="border border-cyan-300/25 bg-cyan-300/8 px-3 py-2 font-medium text-cyan-200 hover:bg-cyan-300/15"
            >
              Open radar
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 md:grid-cols-[220px_minmax(0,1fr)] md:py-20">
        <aside>
          <p className="font-mono text-[10px] tracking-[0.24em] text-cyan-300/70 uppercase">
            {eyebrow}
          </p>
          <p className="mt-4 text-xs leading-5 text-white/35">
            Effective 28 August 2026
            <br />
            Last updated 28 August 2026
          </p>
          <nav className="mt-8 hidden space-y-2 text-sm text-white/45 md:block">
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
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/55">
            {summary}
          </p>
          <div className="legal-copy mt-12 space-y-10">{children}</div>
        </article>
      </main>

      <footer className="relative border-t border-white/7">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} RadarThing</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/cookies" className="hover:text-white">
              Cookies
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
            <Link href="/copyright" className="hover:text-white">
              Copyright
            </Link>
            <Link href="/contact" className="hover:text-white">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="block border-l border-white/10 py-1 pl-3 transition-colors hover:border-cyan-300/50 hover:text-cyan-200"
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
      <div className="mt-3 space-y-3 text-sm leading-7 text-white/58">
        {children}
      </div>
    </section>
  );
}
