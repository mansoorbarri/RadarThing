import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Fraunces,
  IBM_Plex_Mono,
  Manrope,
  Orbitron,
  Rajdhani,
  Syne,
} from "next/font/google";
import { type ReactNode } from "react";

import { LandingCtaLink, LandingTracker } from "./landing-analytics";
import {
  CONSOLE_SNIPPET,
  USERSCRIPT_INSTALL_PATH,
  featuredWorkflows,
  highlightFeatures,
  pricingHighlights,
  setupSteps,
  signalStats,
  variantMeta,
  type VariantId,
} from "./landing-content";
import { cn } from "~/lib/utils";

const orbitron = Orbitron({ subsets: ["latin"] });
const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const fraunces = Fraunces({ subsets: ["latin"] });
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const manrope = Manrope({ subsets: ["latin"] });
const syne = Syne({ subsets: ["latin"] });

function LogoLockup() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <Image
        src="/logo-white.svg"
        alt="RadarThing"
        width={118}
        height={32}
        priority
      />
      <span className="hidden text-[11px] tracking-[0.32em] text-white/38 uppercase sm:block">
        GeoFS radar
      </span>
    </Link>
  );
}

function ConceptNav({ active }: { active?: VariantId }) {
  return (
    <nav className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-white/45 sm:gap-x-4 sm:text-sm">
      <Link href="/" className="transition-colors hover:text-white">
        Concepts
      </Link>
      {variantMeta.map((variant) => (
        <Link
          key={variant.id}
          href={`/${variant.id}`}
          className={cn(
            "transition-colors hover:text-white",
            active === variant.id && "text-white",
          )}
        >
          /{variant.id}
        </Link>
      ))}
    </nav>
  );
}

function HeaderLinks({ variant }: { variant: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/55 sm:gap-x-5 sm:text-sm">
      <LandingCtaLink
        href="/radar"
        source="header_open_radar"
        variant={variant}
        className="transition-colors hover:text-white"
      >
        Open Radar
      </LandingCtaLink>
      <LandingCtaLink
        href={USERSCRIPT_INSTALL_PATH}
        source="header_install"
        variant={variant}
        className="transition-colors hover:text-white"
      >
        Install
      </LandingCtaLink>
      <LandingCtaLink
        href="/pricing"
        source="header_pricing"
        variant={variant}
        className="transition-colors hover:text-white"
      >
        PRO
      </LandingCtaLink>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] tracking-[0.3em] text-white/35 uppercase">
      {children}
    </p>
  );
}

function SectionLine({ className }: { className?: string }) {
  return <div className={cn("h-px bg-white/10", className)} />;
}

function PrimaryLink({
  href,
  source,
  variant,
  children,
}: {
  href: string;
  source: string;
  variant: string;
  children: ReactNode;
}) {
  return (
    <LandingCtaLink
      href={href}
      source={source}
      variant={variant}
      className="inline-flex items-center gap-2 border-b border-white pb-1 text-xs font-medium text-white transition-colors hover:border-cyan-200 hover:text-cyan-200 sm:text-sm"
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </LandingCtaLink>
  );
}

function SecondaryLink({
  href,
  source,
  variant,
  children,
  external = false,
}: {
  href: string;
  source: string;
  variant: string;
  children: ReactNode;
  external?: boolean;
}) {
  return (
    <LandingCtaLink
      href={href}
      source={source}
      variant={variant}
      external={external}
      className="inline-flex items-center gap-2 border-b border-white/25 pb-1 text-xs text-white/62 transition-colors hover:border-white hover:text-white sm:text-sm"
    >
      {children}
    </LandingCtaLink>
  );
}

function MetricRow() {
  return (
    <div className="grid gap-5 border-t border-white/10 pt-6 text-sm sm:grid-cols-2 md:grid-cols-4">
      {signalStats.map((item) => (
        <div key={item.label}>
          <p className="text-[11px] tracking-[0.26em] text-white/32 uppercase">
            {item.label}
          </p>
          <p className="mt-2 text-white/74">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function FeatureColumns({
  items = highlightFeatures.slice(0, 4),
}: {
  items?: typeof highlightFeatures;
}) {
  return (
    <div className="grid gap-x-10 gap-y-7 md:grid-cols-2">
      {items.map((feature, index) => (
        <div key={feature.title} className="border-t border-white/10 pt-4">
          <div className="flex items-start gap-4">
            <span className="w-7 shrink-0 text-[11px] tracking-[0.24em] text-white/28">
              0{index + 1}
            </span>
            <div>
              <h3 className="text-lg text-white sm:text-xl">{feature.title}</h3>
              <p className="mt-2 max-w-xl text-sm leading-7 text-white/62 sm:text-[15px]">
                {feature.description}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkflowList({
  items = featuredWorkflows,
}: {
  items?: typeof featuredWorkflows;
}) {
  return (
    <div className="space-y-7 sm:space-y-8">
      {items.map((item, index) => (
        <div
          key={item.title}
          className="grid gap-4 border-t border-white/10 pt-5 md:grid-cols-[80px_1fr]"
        >
          <div className="text-[11px] tracking-[0.26em] text-white/28 uppercase">
            0{index + 1}
          </div>
          <div>
            <p className="text-[11px] tracking-[0.26em] text-white/35 uppercase">
              {item.eyebrow}
            </p>
            <h3 className="mt-2 text-xl text-white sm:text-2xl">
              {item.title}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/62 sm:text-[15px]">
              {item.detail}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function InstallBlock({ variant }: { variant: string }) {
  return (
    <div>
      <SectionLabel>Install</SectionLabel>
      <SectionLine className="mt-4" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          {setupSteps.map((step) => (
            <div key={step.step}>
              <p className="text-[11px] tracking-[0.24em] text-white/32 uppercase">
                {step.step}
              </p>
              <h3 className="mt-2 text-lg text-white sm:text-xl">
                {step.title}
              </h3>
              <p className="mt-2 max-w-md text-sm leading-7 text-white/62 sm:text-[15px]">
                {step.detail}
              </p>
            </div>
          ))}
        </div>
        <div>
          <p className="max-w-xl text-sm leading-7 text-white/58 sm:text-[15px]">
            Console install uses the same hosted loader as Tampermonkey.
          </p>
          <pre
            className={cn(
              "mt-6 overflow-x-auto text-xs leading-7 text-cyan-100/92",
              ibmPlexMono.className,
            )}
          >
            <code>{CONSOLE_SNIPPET}</code>
          </pre>
          <div className="mt-6 flex flex-wrap gap-6">
            <PrimaryLink
              href={USERSCRIPT_INSTALL_PATH}
              source="install_block"
              variant={variant}
            >
              Install userscript
            </PrimaryLink>
            <SecondaryLink
              href="https://www.geo-fs.com/geofs.php"
              source="open_geofs"
              variant={variant}
              external
            >
              Open GeoFS
            </SecondaryLink>
          </div>
        </div>
      </div>
    </div>
  );
}

function PricingBlock({ variant }: { variant: string }) {
  return (
    <div>
      <SectionLabel>Free and PRO</SectionLabel>
      <SectionLine className="mt-4" />
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <div>
          <p className="text-[11px] tracking-[0.26em] text-white/35 uppercase">
            Free
          </p>
          <h3 className="mt-2 text-2xl text-white sm:text-3xl">
            Core radar stays open.
          </h3>
          <div className="mt-5 space-y-3">
            {pricingHighlights.free.map((item) => (
              <p
                key={item}
                className="text-sm leading-7 text-white/62 sm:text-[15px]"
              >
                {item}
              </p>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] tracking-[0.26em] text-white/35 uppercase">
            PRO
          </p>
          <h3 className="mt-2 text-2xl text-white sm:text-3xl">
            $3/month for the deeper stack.
          </h3>
          <div className="mt-5 space-y-3">
            {pricingHighlights.pro.map((item) => (
              <p
                key={item}
                className="text-sm leading-7 text-white/62 sm:text-[15px]"
              >
                {item}
              </p>
            ))}
          </div>
          <div className="mt-6">
            <PrimaryLink
              href="/pricing"
              source="pricing_block"
              variant={variant}
            >
              Compare plans
            </PrimaryLink>
          </div>
        </div>
      </div>
    </div>
  );
}

function FooterNav({ variant }: { variant: VariantId }) {
  const currentIndex = variantMeta.findIndex((entry) => entry.id === variant);
  const nextVariant = variantMeta[(currentIndex + 1) % variantMeta.length]!;

  return (
    <footer className="mx-auto mt-20 max-w-6xl px-5 pb-10 sm:mt-24 sm:px-6">
      <SectionLine />
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="max-w-2xl text-sm leading-7 text-white/45">
          RadarThing is strongest when the landing page stays focused on live
          radar, operational context, replay, and the pilot community around it.
        </p>
        <PrimaryLink
          href={`/${nextVariant.id}`}
          source="footer_next_variant"
          variant={variant}
        >
          Next concept: {nextVariant.name}
        </PrimaryLink>
      </div>
    </footer>
  );
}

export function LandingGalleryPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05080d] text-white">
      <LandingTracker event="landing_gallery_viewed" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(43,117,171,0.18),transparent_28%),linear-gradient(180deg,#05080d_0%,#05080d_100%)]" />
      <div className="relative z-10">
        <header className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-7 sm:px-6 sm:py-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <LogoLockup />
            <ConceptNav />
          </div>
          <HeaderLinks variant="gallery" />
        </header>

        <main className="mx-auto max-w-6xl px-5 pt-8 pb-16 sm:px-6 sm:pt-10">
          <section className="max-w-4xl">
            <SectionLabel>Landing concepts</SectionLabel>
            <h1
              className={cn(
                "mt-6 text-4xl leading-[0.95] font-semibold tracking-tight text-white sm:mt-8 sm:text-5xl md:text-7xl",
                syne.className,
              )}
            >
              Five dark, quieter directions for RadarThing.
            </h1>
            <p
              className={cn(
                "mt-6 max-w-2xl text-base leading-8 text-white/66 sm:mt-8 sm:text-lg sm:leading-9",
                manrope.className,
              )}
            >
              Each version stays minimal and spacious while still surfacing the
              few things that matter most: live GeoFS radar, controller tools,
              weather and charts, replay, and community.
            </p>
          </section>

          <section className="mt-16 sm:mt-20">
            <SectionLine />
            <div className="mt-4">
              {variantMeta.map((variant) => (
                <Link
                  key={variant.id}
                  href={`/${variant.id}`}
                  className="group grid gap-3 border-b border-white/10 py-6 sm:gap-4 sm:py-8 md:grid-cols-[80px_1fr_0.7fr]"
                >
                  <div className="text-sm text-white/28">/{variant.id}</div>
                  <div>
                    <h2 className="text-2xl text-white transition-colors group-hover:text-cyan-200 sm:text-3xl">
                      {variant.name}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-white/62 sm:mt-3 sm:text-[15px]">
                      {variant.summary}
                    </p>
                  </div>
                  <div className="text-sm leading-7 text-white/42 md:text-right">
                    {variant.tone}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-16 sm:mt-20">
            <MetricRow />
          </section>
        </main>
      </div>
    </div>
  );
}

export function LandingVariantOnePage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#04070b] text-white">
      <LandingTracker event="landing_variant_viewed" variant="1" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(34,211,238,0.14),transparent_24%),linear-gradient(180deg,#04070b_0%,#05080d_100%)]" />
      <div className="relative z-10">
        <header className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-7 sm:px-6 sm:py-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <LogoLockup />
            <ConceptNav active="1" />
          </div>
          <HeaderLinks variant="1" />
        </header>

        <main className="mx-auto max-w-6xl px-5 pt-12 pb-12 sm:px-6 sm:pt-14">
          <section className="max-w-4xl">
            <SectionLabel>Concept 1 · Command radar</SectionLabel>
            <h1
              className={cn(
                "mt-6 text-4xl leading-[0.95] font-semibold tracking-tight text-white sm:mt-8 sm:text-5xl md:text-7xl lg:text-8xl",
                orbitron.className,
              )}
            >
              See GeoFS traffic as a live operating picture.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/64 sm:mt-8 sm:text-lg sm:leading-9">
              This version is the most radar-led: sparse, centered, and built
              around the idea that RadarThing is first a live scope, then a tool
              stack around it.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
              <PrimaryLink href="/radar" source="hero_open_radar" variant="1">
                Open live radar
              </PrimaryLink>
              <SecondaryLink
                href={USERSCRIPT_INSTALL_PATH}
                source="hero_install"
                variant="1"
              >
                Install userscript
              </SecondaryLink>
            </div>
          </section>

          <section className="mt-16 sm:mt-20">
            <MetricRow />
          </section>

          <section className="mt-20 sm:mt-24">
            <SectionLabel>Highlights</SectionLabel>
            <div className="mt-8">
              <FeatureColumns items={highlightFeatures.slice(0, 4)} />
            </div>
          </section>

          <section className="mt-20 sm:mt-24">
            <InstallBlock variant="1" />
          </section>

          <section className="mt-20 sm:mt-24">
            <PricingBlock variant="1" />
          </section>
        </main>

        <FooterNav variant="1" />
      </div>
    </div>
  );
}

export function LandingVariantTwoPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#06080c] text-white">
      <LandingTracker event="landing_variant_viewed" variant="2" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,transparent_24%),radial-gradient(circle_at_70%_8%,rgba(120,120,120,0.08),transparent_20%),linear-gradient(180deg,#06080c_0%,#04070b_100%)]" />
      <div className="relative z-10">
        <header className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-7 sm:px-6 sm:py-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <LogoLockup />
            <ConceptNav active="2" />
          </div>
          <HeaderLinks variant="2" />
        </header>

        <main className="mx-auto max-w-6xl px-5 pt-12 pb-12 sm:px-6 sm:pt-14">
          <section className="grid gap-8 sm:gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <SectionLabel>Concept 2 · Approach brief</SectionLabel>
              <h1
                className={cn(
                  "mt-6 text-4xl leading-[1] font-medium tracking-tight text-white sm:mt-8 sm:text-5xl md:text-7xl",
                  fraunces.className,
                )}
              >
                A quieter pitch for a deep flight radar.
              </h1>
            </div>
            <div className="max-w-xl pt-1 sm:pt-3">
              <p className="text-base leading-8 text-white/66 sm:text-lg sm:leading-9">
                This one reads like a preflight note, not a product wall. It
                keeps the page airy and lets the strongest capabilities speak in
                longer, calmer sections.
              </p>
              <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
                <PrimaryLink href="/radar" source="hero_open_radar" variant="2">
                  Open RadarThing
                </PrimaryLink>
                <SecondaryLink
                  href={USERSCRIPT_INSTALL_PATH}
                  source="hero_install"
                  variant="2"
                >
                  Install userscript
                </SecondaryLink>
              </div>
            </div>
          </section>

          <section className="mt-20 sm:mt-24">
            <SectionLabel>Product story</SectionLabel>
            <div className="mt-8">
              <WorkflowList items={featuredWorkflows.slice(0, 4)} />
            </div>
          </section>

          <section className="mt-20 sm:mt-24">
            <PricingBlock variant="2" />
          </section>
        </main>

        <FooterNav variant="2" />
      </div>
    </div>
  );
}

export function LandingVariantThreePage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#04070b] text-white">
      <LandingTracker event="landing_variant_viewed" variant="3" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(48,152,201,0.14),transparent_22%),linear-gradient(180deg,#04070b_0%,#05080d_100%)]" />
      <div className="relative z-10">
        <header className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-7 sm:px-6 sm:py-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <LogoLockup />
            <ConceptNav active="3" />
          </div>
          <HeaderLinks variant="3" />
        </header>

        <main className="mx-auto max-w-6xl px-5 pt-12 pb-12 sm:px-6 sm:pt-14">
          <section className="grid gap-8 sm:gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <SectionLabel>Concept 3 · Signal deck</SectionLabel>
              <h1
                className={cn(
                  "mt-6 text-4xl leading-[0.98] font-semibold tracking-tight text-white sm:mt-8 sm:text-5xl md:text-7xl",
                  ibmPlexMono.className,
                )}
              >
                A technical layout without the clutter.
              </h1>
            </div>
            <div className="max-w-2xl pt-1 sm:pt-3">
              <p className="text-base leading-8 text-white/66 sm:text-lg sm:leading-9">
                This direction uses a more terminal-like tone, but it stays open
                and minimal. The product feels capable without looking crowded.
              </p>
              <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
                <PrimaryLink href="/radar" source="hero_open_radar" variant="3">
                  Launch live map
                </PrimaryLink>
                <SecondaryLink
                  href="/dashboard"
                  source="hero_dashboard"
                  variant="3"
                >
                  View dashboard
                </SecondaryLink>
              </div>
            </div>
          </section>

          <section className="mt-20 grid gap-8 sm:mt-24 sm:gap-12 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <SectionLabel>Core features</SectionLabel>
            </div>
            <div className="lg:col-span-2">
              <FeatureColumns items={highlightFeatures} />
            </div>
          </section>

          <section className="mt-20 sm:mt-24">
            <InstallBlock variant="3" />
          </section>
        </main>

        <FooterNav variant="3" />
      </div>
    </div>
  );
}

export function LandingVariantFourPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05080d] text-white">
      <LandingTracker event="landing_variant_viewed" variant="4" />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(180deg,#05080d_0%,#04070b_100%)]"
        style={{ backgroundSize: "42px 42px, 42px 42px, auto" }}
      />
      <div className="relative z-10">
        <header className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-7 sm:px-6 sm:py-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <LogoLockup />
            <ConceptNav active="4" />
          </div>
          <HeaderLinks variant="4" />
        </header>

        <main className="mx-auto max-w-6xl px-5 pt-12 pb-12 sm:px-6 sm:pt-14">
          <section className="max-w-4xl">
            <SectionLabel>Concept 4 · Ops board</SectionLabel>
            <h1
              className={cn(
                "mt-6 text-4xl leading-[0.95] font-semibold tracking-tight text-white sm:mt-8 sm:text-5xl md:text-7xl lg:text-8xl",
                rajdhani.className,
              )}
            >
              A stripped operations-board feel for pilots and controllers.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/66 sm:mt-8 sm:text-lg sm:leading-9">
              The design language is harder and more tactical, but still wide
              open. No blocks of UI, just hierarchy, lines, and enough contrast
              to feel deliberate.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
              <PrimaryLink href="/radar" source="hero_open_radar" variant="4">
                Open radar
              </PrimaryLink>
              <SecondaryLink
                href={USERSCRIPT_INSTALL_PATH}
                source="hero_install"
                variant="4"
              >
                Install script
              </SecondaryLink>
            </div>
          </section>

          <section className="mt-20 sm:mt-24">
            <MetricRow />
          </section>

          <section className="mt-20 grid gap-8 sm:mt-24 sm:gap-10 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <SectionLabel>Why this one</SectionLabel>
            </div>
            <div className="space-y-8">
              {[
                "Live radar remains the first promise.",
                "Remote control tools stay visible because they differentiate the app.",
                "Weather, charts, and replay make the upgrade path legible.",
                "Community systems appear late, so they support the story instead of diluting it.",
              ].map((line, index) => (
                <div key={line} className="border-t border-white/10 pt-4">
                  <p className="text-[11px] tracking-[0.26em] text-white/28 uppercase">
                    0{index + 1}
                  </p>
                  <p className="mt-3 max-w-3xl text-lg leading-8 text-white/78 sm:text-xl">
                    {line}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-20 sm:mt-24">
            <PricingBlock variant="4" />
          </section>
        </main>

        <FooterNav variant="4" />
      </div>
    </div>
  );
}

export function LandingVariantFivePage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#04060a] text-white">
      <LandingTracker event="landing_variant_viewed" variant="5" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(252,186,76,0.18),transparent_22%),linear-gradient(180deg,#04060a_0%,#05080d_100%)]" />
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-px bg-white/14" />
      <div className="relative z-10">
        <header className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-7 sm:px-6 sm:py-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <LogoLockup />
            <ConceptNav active="5" />
          </div>
          <HeaderLinks variant="5" />
        </header>

        <main className="mx-auto max-w-6xl px-5 pt-16 pb-12 sm:px-6 sm:pt-20">
          <section className="mx-auto max-w-4xl text-center">
            <SectionLabel>Concept 5 · Night approach</SectionLabel>
            <h1
              className={cn(
                "mt-6 text-4xl leading-[0.95] font-semibold tracking-tight text-white sm:mt-8 sm:text-5xl md:text-7xl lg:text-8xl",
                syne.className,
              )}
            >
              Dark, minimal, and mostly air.
            </h1>
            <p
              className={cn(
                "mx-auto mt-6 max-w-2xl text-base leading-8 text-white/66 sm:mt-8 sm:text-lg sm:leading-9",
                manrope.className,
              )}
            >
              This is the most reduced version. The page relies on scale,
              spacing, and a few lines of copy instead of feature packaging.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
              <PrimaryLink href="/radar" source="hero_open_radar" variant="5">
                Enter the radar
              </PrimaryLink>
              <SecondaryLink
                href="/leaderboard"
                source="hero_leaderboard"
                variant="5"
              >
                View community
              </SecondaryLink>
            </div>
          </section>

          <section className="mt-20 grid gap-10 sm:mt-28 sm:gap-12 lg:grid-cols-2">
            <div>
              <SectionLabel>What matters</SectionLabel>
              <div className="mt-8 space-y-8">
                {highlightFeatures.slice(0, 3).map((feature, index) => (
                  <div
                    key={feature.title}
                    className="border-t border-white/10 pt-4"
                  >
                    <p className="text-[11px] tracking-[0.26em] text-white/28 uppercase">
                      0{index + 1}
                    </p>
                    <h3 className="mt-3 text-xl text-white sm:text-2xl">
                      {feature.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-white/62 sm:text-[15px]">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <SectionLabel>Beyond the map</SectionLabel>
              <div className="mt-8 space-y-8">
                {highlightFeatures.slice(3, 5).map((feature, index) => (
                  <div
                    key={feature.title}
                    className="border-t border-white/10 pt-4"
                  >
                    <p className="text-[11px] tracking-[0.26em] text-white/28 uppercase">
                      0{index + 4}
                    </p>
                    <h3 className="mt-3 text-xl text-white sm:text-2xl">
                      {feature.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-white/62 sm:text-[15px]">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-20 sm:mt-28">
            <InstallBlock variant="5" />
          </section>
        </main>

        <FooterNav variant="5" />
      </div>
    </div>
  );
}

export function LandingVariantSevenPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#04070c] text-white">
      <LandingTracker event="landing_variant_viewed" variant="7" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(34,211,238,0.18),transparent_20%),radial-gradient(circle_at_85%_24%,rgba(34,211,238,0.08),transparent_18%),linear-gradient(180deg,#04070c_0%,#061019_46%,#04070c_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[34rem] h-px bg-cyan-300/12" />
      <div className="pointer-events-none absolute inset-x-0 top-[72rem] h-px bg-white/8" />
      <div className="relative z-10">
        <header className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-7 sm:px-6 sm:py-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <LogoLockup />
            <ConceptNav active="7" />
          </div>
          <HeaderLinks variant="7" />
        </header>

        <main className="mx-auto max-w-6xl px-5 pt-14 pb-12 sm:px-6 sm:pt-16">
          <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div className="max-w-4xl">
              <SectionLabel>Concept 7 · Night radar</SectionLabel>
              <p className="mt-6 text-xs tracking-[0.32em] text-cyan-200/72 uppercase">
                Live traffic for GeoFS, with room to breathe
              </p>
              <h1
                className={cn(
                  "mt-6 text-4xl leading-[0.95] font-semibold tracking-tight text-white sm:text-5xl md:text-7xl lg:text-8xl",
                  syne.className,
                )}
              >
                The darker, calmer version that still feels designed.
              </h1>
              <p
                className={cn(
                  "mt-7 max-w-2xl text-base leading-8 text-white/66 sm:text-lg sm:leading-9",
                  manrope.className,
                )}
              >
                This takes the mood from 5 and the pacing from 6. The page still
                stays dark and restrained, but it now has accent color, smaller
                lead-in text, clearer section breaks, and more visual relief
                between blocks of copy.
              </p>
              <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
                <PrimaryLink href="/radar" source="hero_open_radar" variant="7">
                  Open live radar
                </PrimaryLink>
                <SecondaryLink
                  href={USERSCRIPT_INSTALL_PATH}
                  source="hero_install"
                  variant="7"
                >
                  Install userscript
                </SecondaryLink>
              </div>
            </div>

            <div className="lg:pl-8">
              <div className="border-t border-cyan-300/18 pt-5">
                <p className="text-[11px] tracking-[0.28em] text-cyan-200/74 uppercase">
                  Why this direction reads better
                </p>
                <div className="mt-5 space-y-5 text-sm leading-7 text-white/65">
                  <p>
                    Smaller cyan lead text softens the entry before the main
                    headline.
                  </p>
                  <p>
                    Section surfaces and tinted dividers give the eye places to
                    rest instead of one uninterrupted wall of white text.
                  </p>
                  <p>
                    Feature groups are spaced into distinct moments: radar,
                    overlays, replay, and the community layer.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-16 sm:mt-20">
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {signalStats.map((item) => (
                <div
                  key={item.label}
                  className="border-t border-cyan-300/14 pt-4"
                >
                  <p className="text-[11px] tracking-[0.26em] text-cyan-200/65 uppercase">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm text-white/78">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-20 sm:mt-24">
            <SectionLabel>Highlights</SectionLabel>
            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
              <div className="bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(34,211,238,0.02))] px-5 py-6 sm:px-7">
                <p className="text-[11px] tracking-[0.26em] text-cyan-200/74 uppercase">
                  Live picture
                </p>
                <h2 className="mt-3 text-2xl text-white sm:text-3xl">
                  Radar first, but not radar only.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-white/64 sm:text-[15px]">
                  The strongest first impression is still live GeoFS traffic,
                  but the page immediately shows that RadarThing also has the
                  layers and workflows that make the map useful.
                </p>
              </div>
              <div className="border-t border-white/10 pt-5 lg:pt-0 lg:pl-6">
                <WorkflowList items={featuredWorkflows.slice(0, 2)} />
              </div>
            </div>
          </section>

          <section className="mt-20 sm:mt-24">
            <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr]">
              <div>
                <SectionLabel>Flight loop</SectionLabel>
                <div className="mt-6 border-t border-white/10 pt-5">
                  <h2 className="text-2xl text-white sm:text-3xl">
                    Fly, review, then come back.
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-white/64 sm:text-[15px]">
                    Replay, pilot stats, leaderboard movement, virtual airline
                    activity, and shared community uploads give the product a
                    second life after the flight ends.
                  </p>
                </div>
              </div>
              <div className="grid gap-x-10 gap-y-7 md:grid-cols-2">
                {highlightFeatures.slice(2, 5).map((feature, index) => (
                  <div
                    key={feature.title}
                    className="border-t border-white/10 pt-4"
                  >
                    <p className="text-[11px] tracking-[0.24em] text-cyan-200/60 uppercase">
                      0{index + 3}
                    </p>
                    <h3 className="mt-3 text-lg text-white sm:text-xl">
                      {feature.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-white/62 sm:text-[15px]">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-20 sm:mt-24">
            <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
              <div>
                <InstallBlock variant="7" />
              </div>
              <div className="bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-5 py-6 sm:px-7">
                <SectionLabel>Free and PRO</SectionLabel>
                <div className="mt-5 grid gap-8">
                  <div>
                    <p className="text-[11px] tracking-[0.26em] text-cyan-200/70 uppercase">
                      Free
                    </p>
                    <h3 className="mt-2 text-2xl text-white">
                      Open the radar fast.
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-white/64 sm:text-[15px]">
                      Live tracking, search, multi-select, follow mode, replay,
                      and remote control all stay in the core product.
                    </p>
                  </div>
                  <div className="border-t border-cyan-300/14 pt-5">
                    <p className="text-[11px] tracking-[0.26em] text-cyan-200/70 uppercase">
                      PRO
                    </p>
                    <h3 className="mt-2 text-2xl text-white">
                      Add the deeper operational stack.
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-white/64 sm:text-[15px]">
                      Decoded weather intel, global charts and procedures, and
                      richer history and analytics make the premium layer
                      legible without turning the whole page into a pricing
                      table.
                    </p>
                    <div className="mt-5">
                      <PrimaryLink
                        href="/pricing"
                        source="pricing_block"
                        variant="7"
                      >
                        Compare plans
                      </PrimaryLink>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        <FooterNav variant="7" />
      </div>
    </div>
  );
}
