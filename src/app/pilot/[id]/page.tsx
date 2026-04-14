"use client";

import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";
import { Analytics } from "~/lib/analytics";
import {
  Plane,
  Clock,
  MapPin,
  Navigation,
  ArrowLeft,
  Lock,
  Route,
  Calendar,
  Play,
  Share2,
  Check,
  Link,
  Camera,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useProStatus } from "~/hooks/useProStatus";
import { Suspense } from "react";
import { FlightCardDialog } from "~/components/flight-card/FlightCardDialog";
import type { FlightCardData } from "~/components/flight-card/FlightCard";
import { useCurrentUserProfile } from "~/hooks/useCurrentUserProfile";
import { isFlightModeratorGoogleId } from "~/lib/flight-moderation";
import { ConfirmModal } from "~/app/admin/_components/ConfirmModal";

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
  return (
    <Suspense fallback={<PilotPageSkeleton callsign={null} />}>
      <PilotPageContent />
    </Suspense>
  );
}

function PilotPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const userId = params.id as Id<"users">;

  // Get callsign from URL query param (from SSE), fall back to DB
  const callsignFromUrl = searchParams.get("callsign");

  const [linkCopied, setLinkCopied] = useState(false);
  const [cardFlight, setCardFlight] = useState<FlightCardData | null>(null);
  const [deletingFlightId, setDeletingFlightId] = useState<string | null>(null);
  const [flightPendingDelete, setFlightPendingDelete] = useState<{
    id: Id<"flights">;
    callsign?: string;
    aircraftType: string;
    depICAO?: string;
    arrICAO?: string;
  } | null>(null);
  const stats = useQuery(api.flights.getStatsById, { userId });
  const deleteFlight = useMutation(api.flights.deleteFlight);
  const { isProUser, isAdminUser, isLoading: proLoading } = useProStatus();
  const { googleId: currentUserGoogleId, isLoaded: currentUserLoaded } =
    useCurrentUserProfile();

  const canDeleteFlights =
    currentUserLoaded &&
    (isAdminUser || isFlightModeratorGoogleId(currentUserGoogleId));

  const confirmDeleteFlight = async () => {
    if (!flightPendingDelete) return;

    setDeletingFlightId(flightPendingDelete.id);
    try {
      await deleteFlight({ flightId: flightPendingDelete.id });
      toast.success("Flight deleted");
      Analytics.track("flight_deleted", {
        source: "pilot_profile",
        targetUserId: userId,
        flightId: flightPendingDelete.id,
        callsign: flightPendingDelete.callsign,
        aircraftType: flightPendingDelete.aircraftType,
        depICAO: flightPendingDelete.depICAO,
        arrICAO: flightPendingDelete.arrICAO,
      });
      setFlightPendingDelete(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete flight",
      );
    } finally {
      setDeletingFlightId(null);
    }
  };

  const copyProfileLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    toast.success("Profile link copied to clipboard");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (stats === undefined || proLoading || !currentUserLoaded) {
    return <PilotPageSkeleton callsign={callsignFromUrl} />;
  }

  if (stats === null) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header router={router} />
        <main className="mx-auto max-w-2xl px-6 py-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2">
            <Plane className="h-4 w-4 text-red-400" />
            <span className="font-mono text-sm text-red-400">
              PILOT NOT FOUND
            </span>
          </div>
          <h1 className="mb-4 text-3xl font-bold text-white">
            This pilot doesn&apos;t exist
          </h1>
          <p className="mb-8 text-slate-400">
            The pilot you&apos;re looking for may have been deleted or never
            existed.
          </p>
          <button
            onClick={() => router.push("/radar")}
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
          <div className="mb-2 flex items-center gap-4">
            <button
              onClick={copyProfileLink}
              className="group/icon flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border-2 border-cyan-500/50 bg-cyan-500/10 transition-all hover:border-cyan-400 hover:bg-cyan-500/20"
              title="Copy profile link"
            >
              <Plane className="h-6 w-6 text-cyan-400 transition-all group-hover/icon:hidden" />
              {linkCopied ? (
                <Check className="hidden h-6 w-6 text-emerald-400 group-hover/icon:block" />
              ) : (
                <Link className="hidden h-6 w-6 text-cyan-300 group-hover/icon:block" />
              )}
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">
                {stats.discordUsername ??
                  callsignFromUrl ??
                  stats.pilotCallsign ??
                  "Unknown Pilot"}
              </h1>
              {stats.discordUsername &&
                (callsignFromUrl || stats.pilotCallsign) && (
                  <p className="font-mono text-xs text-slate-500">
                    {callsignFromUrl ?? stats.pilotCallsign}
                  </p>
                )}
              <p className="font-mono text-sm text-slate-400">
                {stats.userRole === "PRO" || stats.userRole === "ADMIN" ? (
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
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

            <div className="mb-8 grid gap-6 lg:grid-cols-3">
              {/* Top Aircraft */}
              <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-mono text-sm font-bold tracking-wider text-slate-400">
                    TOP AIRCRAFT
                  </h3>
                  {!isPro && <Lock className="h-4 w-4 text-slate-600" />}
                </div>
                {isPro ? (
                  <div className="space-y-3">
                    {stats.topAircraft.length === 0 ? (
                      <p className="text-sm text-slate-500">No data yet</p>
                    ) : (
                      stats.topAircraft.map((aircraft, i) => (
                        <div
                          key={aircraft.name}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-4 font-mono text-xs text-cyan-400">
                              {i + 1}
                            </span>
                            <span className="font-medium text-white">
                              {aircraft.name
                                .replace(/\s*\([^)]*\)/g, "")
                                .trim()}
                            </span>
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
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-mono text-sm font-bold tracking-wider text-slate-400">
                    TOP ROUTES
                  </h3>
                  {!isPro && <Lock className="h-4 w-4 text-slate-600" />}
                </div>
                {isPro ? (
                  <div className="space-y-3">
                    {stats.topRoutes.length === 0 ? (
                      <p className="text-sm text-slate-500">No data yet</p>
                    ) : (
                      stats.topRoutes.map((route, i) => (
                        <div
                          key={route.route}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-4 font-mono text-xs text-cyan-400">
                              {i + 1}
                            </span>
                            <span className="font-mono font-medium text-white">
                              {route.route}
                            </span>
                          </div>
                          <span className="font-mono text-sm text-slate-400">
                            {route.count}x
                          </span>
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
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-mono text-sm font-bold tracking-wider text-slate-400">
                    TOP AIRPORTS
                  </h3>
                  {!isPro && <Lock className="h-4 w-4 text-slate-600" />}
                </div>
                {isPro ? (
                  <div className="space-y-3">
                    {stats.topAirports.length === 0 ? (
                      <p className="text-sm text-slate-500">No data yet</p>
                    ) : (
                      stats.topAirports.map((airport, i) => (
                        <div
                          key={airport.code}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-4 font-mono text-xs text-cyan-400">
                              {i + 1}
                            </span>
                            <span className="font-mono font-medium text-white">
                              {airport.code}
                            </span>
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
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-mono text-sm font-bold tracking-wider text-slate-400">
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
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-white">
                          {flight.depICAO || "???"}
                        </span>
                        <Route className="h-3 w-3 text-slate-500" />
                        <span className="font-mono text-sm font-bold text-white">
                          {flight.arrICAO || "???"}
                        </span>
                        <span className="ml-2 rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                          {flight.aircraftType
                            .replace(/\s*\([^)]*\)/g, "")
                            .trim()}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {flight.callsign && (
                          <span className="rounded bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-300/80">
                            {flight.callsign}
                          </span>
                        )}
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
                    <div className="flex items-center gap-2">
                      {flight.routeData && flight.routeData.length > 1 && (
                        <>
                          <button
                            onClick={() => {
                              const url = `${window.location.origin}/radar?replay=${flight.id}`;
                              navigator.clipboard.writeText(url).then(() => {
                                toast.success(
                                  "Flight replay link copied to clipboard",
                                );
                                Analytics.flightReplayShared({
                                  callsign: flight.callsign,
                                  aircraftType: flight.aircraftType,
                                  depICAO: flight.depICAO,
                                  arrICAO: flight.arrICAO,
                                  flightId: flight.id as string,
                                });
                              });
                            }}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/40 opacity-0 transition-all group-hover:opacity-100 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400"
                            title="Copy share link"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (!isPro) {
                                Analytics.proFeatureBlocked({
                                  feature: "flight_card",
                                });
                                router.push("/pricing");
                                return;
                              }
                              setCardFlight({
                                callsign: flight.callsign,
                                discordUsername:
                                  stats.discordUsername ?? undefined,
                                aircraftType: flight.aircraftType,
                                depICAO: flight.depICAO,
                                arrICAO: flight.arrICAO,
                                startTime: flight.startTime,
                                endTime: flight.endTime,
                                maxAltitude: flight.maxAltitude,
                                maxSpeed: flight.maxSpeed,
                                routeData: flight.routeData,
                              });
                            }}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/40 opacity-0 transition-all group-hover:opacity-100 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-400"
                            title="Generate flight card"
                          >
                            <Camera className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              router.push(`/radar?replay=${flight.id}`)
                            }
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-amber-500/20"
                            title="Replay this flight"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {canDeleteFlights && (
                        <button
                          onClick={() => {
                            setFlightPendingDelete({
                              id: flight.id,
                              callsign: flight.callsign,
                              aircraftType: flight.aircraftType,
                              depICAO: flight.depICAO,
                              arrICAO: flight.arrICAO,
                            });
                          }}
                          disabled={deletingFlightId === flight.id}
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-100 disabled:hover:bg-red-500/10"
                          title={
                            deletingFlightId === flight.id
                              ? "Deleting flight..."
                              : "Delete this flight"
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {!isPro && stats.recentFlights.length > 3 && (
                  <div className="mt-4 text-center">
                    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-500/30 bg-slate-500/10 px-4 py-2 font-mono text-xs text-slate-400">
                      <Lock className="h-3 w-3" />
                      {stats.recentFlights.length - 3} more flights (PRO
                      feature)
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {cardFlight && (
        <FlightCardDialog
          data={cardFlight}
          onClose={() => setCardFlight(null)}
        />
      )}

      <ConfirmModal
        isOpen={flightPendingDelete !== null}
        title="Delete Flight"
        message={`Remove ${flightPendingDelete?.callsign || "this flight"} from this pilot profile? This immediately recalculates the pilot's stats.`}
        confirmLabel="Delete Flight"
        isLoading={deletingFlightId === flightPendingDelete?.id}
        onConfirm={() => {
          void confirmDeleteFlight();
        }}
        onCancel={() => {
          if (deletingFlightId) return;
          setFlightPendingDelete(null);
        }}
      />
    </div>
  );
}

function Header({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <button
          onClick={() => router.push("/radar")}
          className="cursor-pointer"
        >
          <Image
            src="/logo-white.svg"
            alt="RadarThing"
            width={100}
            height={30}
          />
        </button>
        <button
          onClick={() => router.push("/radar")}
          className="flex cursor-pointer items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
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
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "cyan" | "blue" | "purple" | "emerald" | "amber";
  locked?: boolean;
  subtitle?: string;
}) {
  const colorClasses = {
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-400",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl">
      <div
        className={`mb-3 inline-flex rounded-lg border p-2 ${colorClasses[color]}`}
      >
        {icon}
      </div>
      <div className="mb-1 font-mono text-xs tracking-wider text-slate-500 uppercase">
        {label}
      </div>
      {locked ? (
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-slate-600" />
          <span className="font-mono text-sm text-slate-600">PRO</span>
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold text-white">{value}</div>
          {subtitle && (
            <div className="mt-0.5 font-mono text-xs text-slate-600">
              {subtitle}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProLockedContent() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <Lock className="mb-2 h-8 w-8 text-slate-600" />
      <p className="mb-3 text-sm text-slate-500">
        Unlock full pilot stats with PRO
      </p>
      <button
        onClick={() => {
          Analytics.upgradeButtonClicked({
            source: "pilot_page_pro_locked_card",
            feature: "pilot_stats",
          });
          router.push("/pricing");
        }}
        className="rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 px-3 py-1.5 font-mono text-xs text-cyan-400 transition-all hover:from-cyan-500/30 hover:to-blue-500/30"
      >
        Start 7-day trial
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
        This pilot hasn&apos;t recorded any flights yet.
      </p>
    </div>
  );
}

function PilotPageSkeleton({ callsign }: { callsign: string | null }) {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="h-[30px] w-[100px] animate-pulse rounded bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-20 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Profile Header */}
        <div className="mb-10">
          <div className="mb-2 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-cyan-500/50 bg-cyan-500/10">
              <Plane className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              {callsign ? (
                <h1 className="text-3xl font-bold text-white">{callsign}</h1>
              ) : (
                <div className="h-9 w-48 animate-pulse rounded bg-white/10" />
              )}
              <div className="mt-1 h-4 w-24 animate-pulse rounded bg-white/10" />
            </div>
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl"
            >
              <div className="mb-3 h-9 w-9 animate-pulse rounded-lg bg-white/10" />
              <div className="mb-2 h-3 w-20 animate-pulse rounded bg-white/10" />
              <div className="h-8 w-24 animate-pulse rounded bg-white/10" />
            </div>
          ))}
        </div>

        {/* Three Column Grid Skeleton */}
        <div className="mb-8 grid gap-6 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl"
            >
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

        {/* Recent Flights Skeleton */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
          <div className="mb-6 flex items-center justify-between">
            <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/5 p-4"
              >
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
