"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Plane,
  Clock,
  MapPin,
  Navigation,
  ArrowLeft,
  Lock,
  Route,
  Calendar,
} from "lucide-react";
import Loading from "~/components/loading";
import Image from "next/image";
import { useProStatus } from "~/hooks/useProStatus";

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

export default function PilotPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as Id<"users">;

  const stats = useQuery(api.flights.getStatsById, { userId });
  const { isProUser, isLoading: proLoading } = useProStatus();

  if (stats === undefined || proLoading) {
    return <Loading />;
  }

  if (stats === null) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header router={router} />
        <main className="mx-auto max-w-2xl px-6 py-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2">
            <Plane className="h-4 w-4 text-red-400" />
            <span className="font-mono text-sm text-red-400">PILOT NOT FOUND</span>
          </div>
          <h1 className="mb-4 text-3xl font-bold text-white">
            This pilot doesn&apos;t exist
          </h1>
          <p className="mb-8 text-slate-400">
            The pilot you&apos;re looking for may have been deleted or never existed.
          </p>
          <button
            onClick={() => router.push("/")}
            className="cursor-pointer rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40"
          >
            Back to Map
          </button>
        </main>
      </div>
    );
  }

  const isPro = isProUser;

  return (
    <div className="min-h-screen bg-black text-white">
      <Header router={router} />

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Profile Header */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-cyan-500/50 bg-cyan-500/10">
              <Plane className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">
                {stats.pilotCallsign || "Unknown Pilot"}
              </h1>
              <p className="text-slate-400 font-mono text-sm">
                {stats.userRole === "PRO" ? (
                  <span className="text-emerald-400">PRO Member</span>
                ) : (
                  <span className="text-slate-500">Free Tier</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {stats.totalFlights === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Stats Grid */}
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
              {/* Top Aircraft */}
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

              {/* Top Routes */}
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

              {/* Top Airports */}
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
                    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-500/30 bg-slate-500/10 px-4 py-2 font-mono text-xs text-slate-400">
                      <Lock className="h-3 w-3" />
                      {stats.recentFlights.length - 3} more flights (PRO feature)
                    </div>
                  </div>
                )}
              </div>
            </div>
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
        <button
          onClick={() => router.push("/")}
          className="cursor-pointer flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Map
        </button>
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
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <Lock className="mb-2 h-8 w-8 text-slate-600" />
      <p className="text-sm text-slate-500">PRO feature</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
      <Plane className="mx-auto mb-4 h-12 w-12 text-slate-600" />
      <h3 className="mb-2 text-xl font-semibold text-white">No Flights Yet</h3>
      <p className="text-slate-400">
        This pilot hasn&apos;t recorded any flights yet.
      </p>
    </div>
  );
}
