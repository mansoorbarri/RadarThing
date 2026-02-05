import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
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

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#010b10]">
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
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
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
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
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
          className="absolute bottom-0 left-0 right-0 h-[400px]"
          style={{
            background:
              "radial-gradient(ellipse 80% 100% at 50% 100%, rgba(34,211,238,0.06) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-4">
            <Image
              src="/logo-white.svg"
              alt="RadarThing"
              width={120}
              height={36}
              priority
            />
            <div className="hidden h-4 w-px bg-white/10 sm:block" />
            <span className="hidden text-xs text-white/30 sm:block">
              for GeoFS
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="font-mono text-[10px] text-emerald-400">
                ONLINE
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-8 md:pb-24 md:pt-12">
          <div className="max-w-2xl">
            <h1 className="mb-6 text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl">
              See every flight.
              <br />
              <span className="text-white/40">In real time.</span>
            </h1>

            <p className="mb-4 max-w-md text-lg text-white/50">
              The flight radar built exclusively for{" "}
              <span className="text-white">GeoFS</span> flight simulator.
            </p>
            <p className="mb-10 max-w-md text-white/40">
              Track aircraft, record routes, access weather data, airport charts, and more.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/radar"
                className="group inline-flex items-center justify-center gap-2 bg-white px-8 py-4 font-semibold text-black transition-all hover:bg-cyan-400"
              >
                Open Radar
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="#install"
                className="inline-flex items-center justify-center gap-2 border border-white/10 px-8 py-4 font-medium text-white transition-all hover:border-white/25 hover:bg-white/5"
              >
                <Download className="h-4 w-4" />
                Install Script
              </Link>
            </div>
          </div>
        </section>

        {/* Quick Install */}
        <section id="install" className="border-t border-white/5 bg-white/[0.02]">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-400">
                <Download className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-semibold text-white">Quick Setup</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <SetupStep
                step={1}
                title="Install Tampermonkey"
                description="Get the browser extension from your browser's extension store"
                link="https://www.tampermonkey.net/"
                linkText="Get Tampermonkey"
              />
              <SetupStep
                step={2}
                title="Add the Userscript"
                description="Click install to add the RadarThing script to Tampermonkey"
                link="https://xyzmani.com/radar"
                linkText="Install Script"
              />
              <SetupStep
                step={3}
                title="Fly in GeoFS"
                description="Open GeoFS and your position will appear on the radar automatically"
                link="https://geo-fs.com/geofs.php"
                linkText="Open GeoFS"
              />
            </div>
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
                title="Live Tracking"
                description="Real-time aircraft positions streamed via SSE with sub-second latency"
              />
              <FeatureCard
                icon={Route}
                title="Flight Paths"
                description="Automatic flight recording with route visualization and replay"
              />
              <FeatureCard
                icon={Plane}
                title="Multi-Select"
                description="Track multiple aircraft simultaneously with Ctrl+click selection"
              />
              <FeatureCard
                icon={Gamepad2}
                title="Remote Control"
                description="Send autopilot commands: speed, altitude, heading, and more"
              />
              <FeatureCard
                icon={Cloud}
                title="Weather Data"
                description="METARs, TAFs, NOTAMs, AIRMETs, SIGMETs, and precipitation overlay"
              />
              <FeatureCard
                icon={Building2}
                title="Airport Info"
                description="Taxi charts, approach procedures, SIDs, STARs, and frequencies"
              />
              <FeatureCard
                icon={Headphones}
                title="Live ATC"
                description="Stream real-world ATC audio for selected airports"
              />
              <FeatureCard
                icon={Clock}
                title="Flight Stats"
                description="Track your flight time, distance, top routes, and airports"
              />
              <FeatureCard
                icon={Camera}
                title="Aircraft Gallery"
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
              <p className="text-white/40">
                Core tracking is completely free. Upgrade for weather and charts.
              </p>
            </div>

            <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
              {/* Free Tier */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white">Free</h3>
                  <p className="text-sm text-white/40">For casual use</p>
                </div>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-white">$0</span>
                  <span className="text-white/40"> / forever</span>
                </div>
                <ul className="mb-6 space-y-3">
                  <PricingFeature included>Live aircraft tracking</PricingFeature>
                  <PricingFeature included>Flight search & filtering</PricingFeature>
                  <PricingFeature included>Multi-aircraft selection</PricingFeature>
                  <PricingFeature included>Follow mode</PricingFeature>
                  <PricingFeature included>Flight recording & replay</PricingFeature>
                  <PricingFeature included>Remote autopilot commands</PricingFeature>
                  <PricingFeature included>Basic flight stats</PricingFeature>
                  <PricingFeature included>Live ATC audio</PricingFeature>
                  <PricingFeature included>Precipitation overlay</PricingFeature>
                  <PricingFeature included>Aircraft image uploads</PricingFeature>
                  <PricingFeature>NOTAMs (decoded)</PricingFeature>
                  <PricingFeature>AIRMETs & SIGMETs</PricingFeature>
                  <PricingFeature>Airport charts</PricingFeature>
                  <PricingFeature>Advanced analytics</PricingFeature>
                </ul>
                <Link
                  href="/radar"
                  className="block w-full rounded-lg border border-white/10 py-3 text-center font-medium text-white transition-colors hover:bg-white/5"
                >
                  Get Started
                </Link>
              </div>

              {/* Pro Tier */}
              <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-6">
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Pro</h3>
                    <p className="text-sm text-white/40">Full access</p>
                  </div>
                  <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-xs font-medium text-cyan-400">
                    POPULAR
                  </span>
                </div>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-white">$3</span>
                  <span className="text-white/40"> / month</span>
                </div>
                <ul className="mb-6 space-y-3">
                  <PricingFeature included>Everything in Free</PricingFeature>
                  <PricingFeature included>NOTAMs with decoded text</PricingFeature>
                  <PricingFeature included>AIRMETs & SIGMETs overlay</PricingFeature>
                  <PricingFeature included>Airport taxi charts</PricingFeature>
                  <PricingFeature included>Approach & departure charts</PricingFeature>
                  <PricingFeature included>SID/STAR procedures</PricingFeature>
                  <PricingFeature included>Full flight history</PricingFeature>
                  <PricingFeature included>Top routes & airports stats</PricingFeature>
                  <PricingFeature included>Total flight time tracking</PricingFeature>
                  <PricingFeature included>Radar mode map layer</PricingFeature>
                </ul>
                <Link
                  href="/pricing"
                  className="block w-full rounded-lg bg-cyan-400 py-3 text-center font-semibold text-black transition-colors hover:bg-cyan-300"
                >
                  Upgrade to Pro
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-t border-white/5">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              <Stat label="Protocol" value="SSE" />
              <Stat label="Latency" value="~3s" />
              <Stat label="Coverage" value="Global" />
              <Stat label="Updates" value="Real-time" />
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
            <p className="mb-8 text-white/40">
              Install the script and start tracking in under a minute.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/radar"
                className="group inline-flex items-center gap-2 bg-cyan-400 px-10 py-4 font-semibold text-black transition-all hover:bg-cyan-300 hover:shadow-[0_0_30px_rgba(34,211,238,0.3)]"
              >
                Launch Radar
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="https://discord.gg/pbQF4txdRC"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-white/10 px-8 py-4 font-medium text-white transition-all hover:border-white/25 hover:bg-white/5"
              >
                <DiscordIcon className="h-4 w-4" />
                Join Discord
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 md:flex-row">
          <span className="text-sm text-white/30">
            © {new Date().getFullYear()} RadarThing
          </span>
          <div className="flex gap-6 text-sm text-white/40">
            <Link href="/pricing" className="hover:text-white">
              Pricing
            </Link>
            <Link
              href="https://discord.gg/pbQF4txdRC"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white"
            >
              Discord
            </Link>
            <Link
              href="https://xyzmani.com/radar"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white"
            >
              Install Script
            </Link>
          </div>
        </div>
      </footer>
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
}: {
  step: number;
  title: string;
  description: string;
  link: string;
  linkText: string;
}) {
  return (
    <div className="relative rounded-lg border border-white/5 bg-white/[0.02] p-5">
      <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400/10 font-mono text-sm font-semibold text-cyan-400">
        {step}
      </div>
      <h3 className="mb-1 font-semibold text-white">{title}</h3>
      <p className="mb-4 text-sm text-white/40">{description}</p>
      <Link
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium text-cyan-400 hover:underline"
      >
        {linkText}
        <ArrowRight className="h-3 w-3" />
      </Link>
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
      <p className="text-sm leading-relaxed text-white/40">{description}</p>
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
        <Check className="h-4 w-4 shrink-0 text-cyan-400" />
      ) : (
        <X className="h-4 w-4 shrink-0 text-white/20" />
      )}
      <span className={included ? "text-white/70" : "text-white/30"}>
        {children}
      </span>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="mb-1 text-sm text-white/40">{label}</p>
      <p className="font-mono text-2xl font-bold text-white">{value}</p>
    </div>
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
