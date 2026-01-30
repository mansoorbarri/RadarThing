"use client";

import { useRouter } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useProStatus } from "~/hooks/useProStatus";
import { Analytics } from "~/lib/analytics";
import {
  Plane,
  Clock,
  MapPin,
  Route,
  Lock,
  TrendingUp,
  Calendar,
  Navigation,
  Copy,
  Check,
} from "lucide-react";
import Image from "next/image";
import { UserAuth } from "~/components/atc/userAuth";

function formatFlightTime(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(start: number, end?: number): string {
  if (!end) return "In Progress";
  const ms = end - start;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded, user } = useUser();
  const clerkId = user?.id;
  const [copied, setCopied] = useState(false);

  // Real-time queries
  const { isProUser: isPro, isLoading: proLoading } = useProStatus();
  const statsQuery = useQuery(
    api.flights.getStatsByClerkId,
    clerkId ? { clerkId } : "skip"
  );
  const dbUser = useQuery(
    api.users.getByClerkId,
    clerkId ? { clerkId } : "skip"
  );

  const stats = useMemo(() => statsQuery ?? null, [statsQuery]);
  const supportId = useMemo(() => dbUser?._id ?? null, [dbUser]);
  const loading = !isLoaded || proLoading || (clerkId && statsQuery === undefined);

  // Track page view and stats (only once per page load)
  const hasTracked = useRef(false);
  useEffect(() => {
    if (!loading && isSignedIn && !hasTracked.current) {
      hasTracked.current = true;
      Analytics.dashboardViewed();
      Analytics.flightHistoryViewed();
      if (stats) {
        Analytics.statsCalculated({
          totalFlights: stats.totalFlights,
          totalDistance: stats.totalDistanceNm,
          totalTime: stats.totalFlightTimeMs,
        });
      }
    }
  }, [loading, isSignedIn, stats]);

  const copySupportId = () => {
    if (supportId) {
      navigator.clipboard.writeText(supportId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header router={router} />
        <main className="mx-auto max-w-2xl px-6 py-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
            <Plane className="h-4 w-4 text-cyan-400" />
            <span className="font-mono text-sm text-cyan-400">SIGN IN REQUIRED</span>
          </div>
          <h1 className="mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-5xl font-bold text-transparent">
            Your Flight Dashboard
          </h1>
          <p className="mb-12 text-xl text-slate-400">
            Sign in to view your flight statistics and history
          </p>
          <SignInButton mode="modal">
            <button className="cursor-pointer rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-8 py-4 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40">
              Sign In / Sign Up
            </button>
          </SignInButton>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header router={router} />

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Profile Header */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-2">
            {user?.imageUrl && (
              <Image
                src={user.imageUrl}
                alt="Profile"
                width={56}
                height={56}
                className="rounded-full border-2 border-cyan-500/50"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold text-white">
                {user?.firstName ? `${user.firstName}'s Dashboard` : "Your Dashboard"}
              </h1>
              <p className="text-slate-400 font-mono text-sm">
                {isPro ? (
                  <span className="text-emerald-400">PRO Member</span>
                ) : (
                  <span className="text-slate-500">Free Tier</span>
                )}
              </p>
              {supportId && (
                <button
                  onClick={copySupportId}
                  className="mt-1 flex items-center gap-1.5 text-slate-600 font-mono text-xs hover:text-slate-400 transition-colors cursor-pointer"
                  title="Click to copy - share this with support when reporting issues"
                >
                  <span>ID: {supportId.slice(0, 8)}...</span>
                  {copied ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {!stats || stats.totalFlights === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Stats Grid - Free Tier */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              <StatCard
                icon={<Plane className="h-5 w-5" />}
                label="Total Flights"
                value={stats.totalFlights.toString()}
                color="cyan"
              />
              <StatCard
                icon={<Navigation className="h-5 w-5" />}
                label="Distance Flown"
                value={`${stats.totalDistanceNm.toLocaleString()} nm`}
                color="blue"
              />
              <StatCard
                icon={<Clock className="h-5 w-5" />}
                label="Flight Time"
                value={formatFlightTime(stats.totalFlightTimeMs)}
                color="purple"
                locked={!isPro}
              />
              <StatCard
                icon={<MapPin className="h-5 w-5" />}
                label="Airports Visited"
                value={stats.uniqueAirports.toString()}
                color="emerald"
                locked={!isPro}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-3 mb-8">
              {/* Top Aircraft - PRO */}
              <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-mono text-sm font-bold text-slate-400 tracking-wider">
                    TOP AIRCRAFT
                  </h3>
                  {!isPro && <Lock className="h-4 w-4 text-slate-600" />}
                </div>
                {isPro ? (
                  <div className="space-y-3">
                    {stats.topAircraft.length === 0 ? (
                      <p className="text-slate-500 text-sm">No data yet</p>
                    ) : (
                      stats.topAircraft.map((aircraft, i) => (
                        <div key={aircraft.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs text-cyan-400 w-4">{i + 1}</span>
                            <span className="text-white font-medium">{aircraft.name}</span>
                          </div>
                          <span className="font-mono text-sm text-slate-400">
                            {aircraft.count} flights
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <ProLockedContent />
                )}
              </div>

              {/* Top Routes - PRO */}
              <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-mono text-sm font-bold text-slate-400 tracking-wider">
                    TOP ROUTES
                  </h3>
                  {!isPro && <Lock className="h-4 w-4 text-slate-600" />}
                </div>
                {isPro ? (
                  <div className="space-y-3">
                    {stats.topRoutes.length === 0 ? (
                      <p className="text-slate-500 text-sm">No data yet</p>
                    ) : (
                      stats.topRoutes.map((route, i) => (
                        <div key={route.route} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs text-cyan-400 w-4">{i + 1}</span>
                            <span className="text-white font-medium font-mono">{route.route}</span>
                          </div>
                          <span className="font-mono text-sm text-slate-400">{route.count}x</span>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <ProLockedContent />
                )}
              </div>

              {/* Top Airports - PRO */}
              <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-mono text-sm font-bold text-slate-400 tracking-wider">
                    TOP AIRPORTS
                  </h3>
                  {!isPro && <Lock className="h-4 w-4 text-slate-600" />}
                </div>
                {isPro ? (
                  <div className="space-y-3">
                    {stats.topAirports.length === 0 ? (
                      <p className="text-slate-500 text-sm">No data yet</p>
                    ) : (
                      stats.topAirports.map((airport, i) => (
                        <div key={airport.code} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs text-cyan-400 w-4">{i + 1}</span>
                            <span className="text-white font-medium font-mono">{airport.code}</span>
                          </div>
                          <span className="font-mono text-sm text-slate-400">
                            {airport.count} visits
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <ProLockedContent />
                )}
              </div>
            </div>

            {/* Recent Flights */}
            <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-mono text-sm font-bold text-slate-400 tracking-wider">
                  RECENT FLIGHTS
                </h3>
                <span className="font-mono text-xs text-slate-600">
                  {isPro ? "Last 10 flights" : "Last 3 flights"}
                </span>
              </div>

              <div className="space-y-3">
                {stats.recentFlights.slice(0, isPro ? 10 : 3).map((flight) => (
                  <div
                    key={flight.id}
                    className="group flex items-center gap-4 rounded-xl border border-white/5 bg-white/5 p-4 transition-all hover:border-cyan-500/30 hover:bg-white/10"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
                      <Plane className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-bold text-white">
                          {flight.depICAO || "???"}
                        </span>
                        <Route className="h-3 w-3 text-slate-500" />
                        <span className="font-mono text-sm font-bold text-white">
                          {flight.arrICAO || "???"}
                        </span>
                        <span className="ml-2 rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                          {flight.aircraftType}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(flight.startTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(flight.startTime, flight.endTime)}
                        </span>
                      </div>
                    </div>
                    <div className="font-mono text-xs text-slate-600">{flight.callsign}</div>
                  </div>
                ))}

                {!isPro && stats.recentFlights.length > 3 && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => router.push("/pricing")}
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 font-mono text-xs text-amber-400 transition-all hover:bg-amber-500/20"
                    >
                      <Lock className="h-3 w-3" />
                      Upgrade to see {stats.recentFlights.length - 3} more flights
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Upgrade CTA for Free Users */}
            {!isPro && (
              <div className="mt-8 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-8 text-center backdrop-blur-xl">
                <TrendingUp className="mx-auto mb-4 h-10 w-10 text-cyan-400" />
                <h3 className="mb-2 text-xl font-bold text-white">Unlock Full Analytics</h3>
                <p className="mb-6 text-slate-400">
                  Get detailed insights with flight time, top airports, routes, and complete history
                </p>
                <button
                  onClick={() => router.push("/pricing")}
                  className="cursor-pointer rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40"
                >
                  Upgrade to PRO - $3/month
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Header({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <button
          onClick={() => router.push("/")}
          className="cursor-pointer"
        >
          <Image src="/logo-white.svg" alt="RadarThing" width={100} height={30} />
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="cursor-pointer text-sm text-slate-400 transition-colors hover:text-white"
          >
            Back to Map
          </button>
          <UserAuth />
        </div>
      </div>
    </header>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  locked = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "cyan" | "blue" | "purple" | "emerald";
  locked?: boolean;
}) {
  const colorClasses = {
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-400",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl">
      <div className={`mb-3 inline-flex rounded-lg border p-2 ${colorClasses[color]}`}>
        {icon}
      </div>
      <div className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      {locked ? (
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-slate-600" />
          <span className="text-slate-600 font-mono text-sm">PRO</span>
        </div>
      ) : (
        <div className="text-2xl font-bold text-white">{value}</div>
      )}
    </div>
  );
}

function ProLockedContent() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <Lock className="mb-2 h-8 w-8 text-slate-600" />
      <p className="mb-3 text-sm text-slate-500">Available with PRO</p>
      <button
        onClick={() => router.push("/pricing")}
        className="rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 px-3 py-1.5 font-mono text-xs text-cyan-400 transition-all hover:from-cyan-500/30 hover:to-blue-500/30"
      >
        Upgrade
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
      <Plane className="mx-auto mb-4 h-12 w-12 text-slate-600" />
      <h3 className="mb-2 text-xl font-semibold text-white">No Flights Yet</h3>
      <p className="text-slate-400">
        Start flying in GeoFS to see your stats here.
        <br />
        Make sure you&apos;re signed in with the same Google account.
      </p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="h-[30px] w-[100px] animate-pulse rounded bg-white/10" />
          <div className="flex items-center gap-4">
            <div className="h-4 w-20 animate-pulse rounded bg-white/10" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Profile Header */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-14 w-14 animate-pulse rounded-full bg-white/10" />
            <div>
              <div className="h-8 w-48 animate-pulse rounded bg-white/10 mb-2" />
              <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl">
              <div className="mb-3 h-9 w-9 animate-pulse rounded-lg bg-white/10" />
              <div className="mb-2 h-3 w-20 animate-pulse rounded bg-white/10" />
              <div className="h-8 w-24 animate-pulse rounded bg-white/10" />
            </div>
          ))}
        </div>

        {/* Three Column Grid */}
        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
              <div className="mb-4 h-4 w-28 animate-pulse rounded bg-white/10" />
              <div className="space-y-3">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="flex items-center justify-between">
                    <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
                    <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Recent Flights */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/5 p-4">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-white/10" />
                <div className="flex-1">
                  <div className="mb-2 h-4 w-40 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-32 animate-pulse rounded bg-white/10" />
                </div>
                <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
