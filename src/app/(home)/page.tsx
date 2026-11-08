import Image from "next/image";
import Link from "next/link";
import { CopyCodeSnippet } from "~/components/site/CopyCodeSnippet";
import { SiteFooter } from "~/components/site/SiteFooter";
import { SiteHeader } from "~/components/site/SiteHeader";
import {
  ArrowRight,
  ArrowUpRight,
  Radio,
  Route,
  Cloud,
  Building2,
  Plane,
  Clock,
  Headphones,
  Camera,
  Gamepad2,
  Check,
  X,
  Download,
} from "lucide-react";
import userscriptConfig from "../../../userscript-src/config.json";
import { FREE_DAILY_ALLOWANCE } from "~/lib/freeAllowance";
import { freePlanItems, proPlanItems } from "~/lib/plans";
import { guides } from "~/lib/guides";

const FEATURED_GUIDE_SLUGS = [
  "getting-started",
  "planning-a-realistic-flight",
  "reading-metars",
  "airport-charts",
  "atc-and-phraseology",
  "squawk-codes",
] as const;

const featuredGuides = FEATURED_GUIDE_SLUGS.flatMap((slug) =>
  guides.filter((guide) => guide.slug === slug),
);

const USERSCRIPT_INSTALL_URL = "https://radarthing.com/userscript";
const USERSCRIPT_LOADER_URL = `${userscriptConfig.siteUrl}/loader`;
const CONSOLE_SNIPPET = `(() => {
  const script = document.createElement("script");
  script.src = "${USERSCRIPT_LOADER_URL}?t=" + Date.now();
  document.documentElement.appendChild(script);
})();`;

export default function HomePage() {
  return (
    <div className="bg-site relative min-h-screen overflow-hidden">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0">
        {/* Noise texture */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Radar glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div
            className="h-[900px] w-[900px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(34, 211, 238, 0.04) 0%, transparent 60%)",
            }}
          />
        </div>

        {/* Concentric radar rings */}
        {[300, 500, 700, 900].map((size, i) => (
          <div
            key={size}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div
              className="rounded-full border border-cyan-400"
              style={{
                width: size,
                height: size,
                opacity: 0.08 - i * 0.015,
              }}
            />
          </div>
        ))}

        {/* Aircraft blips */}
        <Blip x={18} y={22} delay={0} />
        <Blip x={75} y={20} delay={300} />
        <Blip x={28} y={68} delay={600} />
        <Blip x={80} y={65} delay={900} />
        <Blip x={65} y={38} delay={1200} />
        <Blip x={10} y={45} delay={1500} />

        {/* Bottom horizon glow */}
        <div
          className="absolute right-0 bottom-0 left-0 h-[400px]"
          style={{
            background:
              "radial-gradient(ellipse 80% 100% at 50% 100%, rgba(34,211,238,0.06) 0%, transparent 70%)",
          }}
        />
      </div>

      <SiteHeader />

      {/* Hero */}
      <main id="main-content" className="relative z-10">
        <section className="mx-auto max-w-6xl px-6 pt-8 pb-16 md:pt-12 md:pb-24">
          <div className="max-w-2xl">
            <h1 className="mb-6 text-4xl leading-[1.1] font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
              See every flight.
              <br />
              <span className="text-white/70">In real time.</span>
            </h1>

            <p className="mb-4 max-w-md text-lg text-white/70">
              The flight radar built exclusively for{" "}
              <span className="text-white">GeoFS</span> flight simulator.
            </p>
            <p className="mb-10 max-w-md text-white/70">
              Track aircraft, record routes, access weather data, airport
              charts, and more.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/radar"
                prefetch={false}
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-white px-8 py-4 font-semibold text-black transition-all hover:bg-cyan-400"
              >
                Open the radar
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="#install"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-8 py-4 font-medium text-white transition-all hover:border-white/25 hover:bg-white/5"
              >
                <Download className="h-4 w-4" />
                Install the script
              </Link>
            </div>
            <p className="mt-5 text-sm text-white/70">
              Free to use. Pro is $3/month with a{" "}
              <Link
                href="/pricing"
                className="text-cyan-300 underline-offset-4 hover:underline"
              >
                7-day free trial
              </Link>
              , no card needed.
            </p>
          </div>

          <figure className="mt-12 overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <Image
              src="/images/radar-preview.png"
              alt="The RadarThing live radar showing GeoFS flights around the world with callsign, altitude and speed labels"
              width={1440}
              height={900}
              sizes="(min-width: 1152px) 1104px, 100vw"
              className="h-auto w-full"
              priority
            />
          </figure>
        </section>

        {/* Quick Install */}
        <section
          id="install"
          className="border-t border-white/5 bg-white/[0.02]"
        >
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-400">
                <Download className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-semibold text-white">Quick setup</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <SetupStep
                step={1}
                title="Install Tampermonkey"
                description="Get it from your browser's extension store. In Chrome or Edge, also turn on Allow User Scripts in Tampermonkey's extension details."
                link="https://www.tampermonkey.net/"
                linkText="Get Tampermonkey"
              />
              <SetupStep
                step={2}
                title="Add the userscript"
                description="Install the hosted loader script so Tampermonkey always pulls the latest runtime"
                link={USERSCRIPT_INSTALL_URL}
                linkText="Install script"
                newTab={false}
              />
              <SetupStep
                step={3}
                title="Start tracking in GeoFS"
                description="Open GeoFS, enter your departure, arrival and callsign in the RadarThing panel, then press Start tracking"
                link="https://geo-fs.com/geofs.php"
                linkText="Open GeoFS"
              />
            </div>

            <p className="mt-5 text-sm leading-6 text-amber-200/85">
              Sign in to your GeoFS account before flying. Flights from
              signed-out sessions are not shown on the radar.
            </p>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Flight not showing up?{" "}
              <Link
                href="/guides/aircraft-not-appearing"
                className="font-medium text-cyan-300 underline underline-offset-4 hover:text-cyan-200"
              >
                Work through the troubleshooting guide
              </Link>
              .
            </p>

            <details className="group mt-8 rounded-2xl border border-white/10 bg-white/[0.02]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-6 py-4 text-sm font-medium text-white/85 hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none">
                Can&apos;t install extensions? Use the console loader instead
                <ArrowRight
                  className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90"
                  aria-hidden="true"
                />
              </summary>
              <div className="grid gap-6 px-6 pb-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
                  <p className="mb-2 text-xs font-semibold tracking-[0.24em] text-cyan-400 uppercase">
                    No Extension
                  </p>
                  <h3 className="mb-3 text-xl font-semibold text-white">
                    Paste the loader in the GeoFS console
                  </h3>
                  <p className="mb-6 max-w-md text-sm leading-6 text-white/70">
                    This uses the same remote loader as Tampermonkey. It is
                    useful for people who do not want to install an extension,
                    but they will need to run it again after each full page
                    reload.
                  </p>
                  <div className="space-y-3 text-sm text-white/75">
                    <div className="rounded-xl border border-white/6 bg-black/20 p-4">
                      <span className="mr-2 font-mono text-cyan-400">1.</span>
                      Open GeoFS, then open DevTools with <code>
                        F12
                      </code> or <code>Cmd/Ctrl+Shift+I</code>.
                    </div>
                    <div className="rounded-xl border border-white/6 bg-black/20 p-4">
                      <span className="mr-2 font-mono text-cyan-400">2.</span>
                      Paste the snippet into the Console and press{" "}
                      <code>Enter</code>.
                    </div>
                    <div className="rounded-xl border border-white/6 bg-black/20 p-4">
                      <span className="mr-2 font-mono text-cyan-400">3.</span>
                      Save it as a DevTools Snippet if you want a repeatable
                      one-click launch without Tampermonkey.
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-cyan-400/15 bg-[#06141b] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.24em] text-cyan-400 uppercase">
                        Console Loader
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-white">
                        Paste this into the GeoFS console
                      </h3>
                    </div>
                    <Link
                      href="https://www.geo-fs.com/geofs.php"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-full border border-white/10 px-4 py-2 text-xs font-medium text-white/80 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white"
                    >
                      Open GeoFS
                    </Link>
                  </div>
                  <CopyCodeSnippet
                    code={CONSOLE_SNIPPET}
                    label="Copy snippet"
                  />
                  <p className="mt-4 text-sm leading-6 text-white/70">
                    The snippet above only loads the stable hosted loader. The
                    loader then resolves the current runtime bundle, so console
                    users and Tampermonkey users stay on the same code path.
                  </p>
                </div>
              </div>
            </details>
          </div>
        </section>

        {/* Features Grid */}
        <section className="border-t border-white/5">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mb-12">
              <p className="mb-2 text-sm font-medium text-cyan-400">Features</p>
              <h2 className="text-2xl font-bold text-white md:text-3xl">
                Everything you need
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={Radio}
                title="Live tracking"
                description="Live aircraft positions from every tracked GeoFS pilot, updated every few seconds"
              />
              <FeatureCard
                icon={Route}
                title="Flight paths"
                description="Automatic flight recording with route visualization and replay"
              />
              <FeatureCard
                icon={Plane}
                title="Multi-Select"
                description="Track multiple aircraft simultaneously with Ctrl+click selection"
              />
              <FeatureCard
                icon={Gamepad2}
                title="Remote control"
                description="Send autopilot commands: speed, altitude, heading, and more"
              />
              <FeatureCard
                icon={Cloud}
                title="Weather data"
                description="METARs and precipitation for everyone. Pro adds NOTAMs, AIRMETs, SIGMETs and D-ATIS"
              />
              <FeatureCard
                icon={Building2}
                title="Airport charts"
                description={`Taxi charts, SIDs, STARs and approaches. ${FREE_DAILY_ALLOWANCE.charts} US airports a day free, unlimited with Pro`}
              />
              <FeatureCard
                icon={Headphones}
                title="Live ATC"
                description="Stream real-world ATC audio for selected airports"
              />
              <FeatureCard
                icon={Clock}
                title="Flight stats"
                description="Track your flight time, distance, top routes, and airports"
              />
              <FeatureCard
                icon={Camera}
                title="Aircraft gallery"
                description="Community-uploaded aircraft photos and livery images"
              />
            </div>
          </div>
        </section>

        {/* Pricing Comparison */}
        <section className="border-t border-white/5 bg-white/[0.02]">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mb-12 text-center">
              <p className="mb-2 text-sm font-medium text-cyan-400">Pricing</p>
              <h2 className="mb-3 text-2xl font-bold text-white md:text-3xl">
                Free to use, Pro to unlock more
              </h2>
              <p className="text-white/70">
                Core tracking is completely free. Upgrade for weather, charts,
                and your full flight archive.
              </p>
            </div>

            <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
              {/* Free Tier */}
              <div className="flex h-full flex-col rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white">Free</h3>
                  <p className="text-sm text-white/70">For casual use</p>
                </div>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-white">$0</span>
                  <span className="text-white/70"> / forever</span>
                </div>
                <ul className="mb-6 flex-1 space-y-3">
                  {freePlanItems().map((item) => (
                    <PricingFeature key={item.label} included={item.included}>
                      {item.label}
                    </PricingFeature>
                  ))}
                </ul>
                <Link
                  href="/radar"
                  className="mt-auto block w-full rounded-lg border border-white/10 py-3 text-center font-medium text-white transition-colors hover:bg-white/5"
                >
                  Open the radar
                </Link>
              </div>

              {/* Pro Tier */}
              <div className="flex h-full flex-col rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-6">
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Pro</h3>
                    <p className="text-sm text-white/70">
                      Full access · 7-day free trial
                    </p>
                  </div>
                </div>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-white">$3</span>
                  <span className="text-white/70"> / month</span>
                </div>
                <ul className="mb-6 flex-1 space-y-3">
                  <li className="text-sm font-medium text-white">
                    Everything in Free, plus:
                  </li>
                  {proPlanItems().map((item) => (
                    <PricingFeature key={item.label} included>
                      {item.label}
                    </PricingFeature>
                  ))}
                </ul>
                <Link
                  href="/pricing"
                  className="mt-auto block w-full rounded-xl bg-cyan-400 py-3 text-center font-semibold text-slate-950 transition-colors hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none"
                >
                  Start 7-day free trial
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Guides */}
        <section className="border-t border-white/5">
          <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-3 text-sm font-medium text-cyan-400">
                  Field manual
                </p>
                <h2 className="text-2xl font-bold text-white md:text-3xl">
                  Learn to fly it like the real thing
                </h2>
                <p className="mt-3 max-w-2xl text-white/60">
                  Practical guides for GeoFS pilots, from your first tracked
                  flight to weather, charts, and radio calls.
                </p>
              </div>
              <Link
                href="/guides"
                className="group inline-flex items-center gap-2 text-sm font-medium text-cyan-300 hover:text-cyan-200"
              >
                All {guides.length} guides
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </div>
            <div className="grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {featuredGuides.map((guide) => (
                <Link
                  key={guide.slug}
                  href={`/guides/${guide.slug}`}
                  className="group bg-site flex flex-col p-6 transition-colors hover:bg-[#04161d]"
                >
                  <h3 className="font-semibold text-white group-hover:text-cyan-200">
                    {guide.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {guide.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-white/5">
          <div className="mx-auto max-w-6xl px-6 py-20 text-center md:py-28">
            <p className="mb-3 text-sm font-medium text-cyan-400">
              No account required
            </p>
            <h2 className="mb-4 text-2xl font-bold text-white md:text-3xl">
              Ready for takeoff?
            </h2>
            <p className="mb-8 text-white/70">
              Install the script and start tracking in under a minute.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/radar"
                className="group inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-10 py-4 font-semibold text-slate-950 transition-all hover:bg-cyan-300 hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none"
              >
                Open the radar
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="https://discord.gg/pbQF4txdRC"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-8 py-4 font-medium text-white transition-all hover:border-white/25 hover:bg-white/5"
              >
                <DiscordIcon className="h-4 w-4" />
                Join the Discord
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function Blip({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <div
      className="absolute h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        animationDelay: `${delay}ms`,
        boxShadow: "0 0 8px rgba(34, 211, 238, 0.6)",
      }}
    />
  );
}

function SetupStep({
  step,
  title,
  description,
  link,
  linkText,
  newTab = true,
}: {
  step: number;
  title: string;
  description: string;
  link: string;
  linkText: string;
  /** The script install link stays in-tab so Tampermonkey can catch it. */
  newTab?: boolean;
}) {
  return (
    <div className="relative rounded-lg border border-white/5 bg-white/[0.02] p-5">
      <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400/10 font-mono text-sm font-semibold text-cyan-400">
        {step}
      </div>
      <h3 className="mb-1 font-semibold text-white">{title}</h3>
      <p className="mb-4 text-sm text-white/70">{description}</p>
      <a
        href={link}
        {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-cyan-400 hover:underline"
      >
        {linkText}
        {newTab ? (
          <>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </>
        ) : (
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        )}
      </a>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-lg border border-white/5 bg-white/[0.02] p-5 transition-all hover:border-white/10 hover:bg-white/[0.04]">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-colors group-hover:border-cyan-400/30 group-hover:bg-cyan-400/10">
        <Icon className="h-5 w-5 text-white/60 transition-colors group-hover:text-cyan-400" />
      </div>
      <h3 className="mb-1 font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-white/70">{description}</p>
    </div>
  );
}

function PricingFeature({
  children,
  included = false,
}: {
  children: React.ReactNode;
  included?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 text-sm">
      {included ? (
        <Check className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden="true" />
      ) : (
        <X className="h-4 w-4 shrink-0 text-white/40" aria-hidden="true" />
      )}
      <span className={included ? "text-white/80" : "text-white/60"}>
        {/* The icon alone doesn't tell a screen reader what's missing. */}
        <span className="sr-only">
          {included ? "Included: " : "Not included: "}
        </span>
        {children}
      </span>
    </li>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}
