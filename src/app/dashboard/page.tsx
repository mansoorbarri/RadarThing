"use client";

import { useRouter } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { useProStatus } from "~/hooks/useProStatus";
import { Analytics } from "~/lib/analytics";
import { createPortalSession } from "~/app/actions/create-portal";
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
  Camera,
  FileText,
  Play,
  Share2,
  Link,
  Trash2,
  Mail,
  Shield,
  AlertTriangle,
  ChevronDown,
  CreditCard,
  Flame,
} from "lucide-react";
import Image from "next/image";
import { UserAuth } from "~/components/atc/userAuth";
import { ChallengesSection } from "./_components/ChallengesSection";

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
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [profileCopied, setProfileCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [flightsExpanded, setFlightsExpanded] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const updateDiscordUsername = useMutation(api.users.updateDiscordUsername);

  useEffect(() => {
    setMounted(true);
  }, []);

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
  const approvedAircraftImages = useQuery(
    api.aircraftImages.getApprovedCountByUser,
    clerkId ? { uploadedBy: clerkId } : "skip"
  );
  const approvedAirportCharts = useQuery(
    api.airportCharts.getApprovedCountByUser,
    clerkId ? { uploadedBy: clerkId } : "skip"
  );

  const stats = useMemo(() => statsQuery ?? null, [statsQuery]);
  const supportId = useMemo(() => dbUser?._id ?? null, [dbUser]);
  const loading = !mounted || !isLoaded;
  const statsLoading = clerkId && statsQuery === undefined;

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

  // Discord account from Clerk
  const discordAccount = user?.externalAccounts?.find(
    (a) => a.provider === "discord"
  );
  const discordUsername = discordAccount?.username ?? null;

  // Auto-sync Discord username to Convex
  useEffect(() => {
    if (!clerkId || dbUser === undefined) return;
    const convexDiscord = dbUser?.discordUsername ?? null;
    if (discordUsername && convexDiscord !== discordUsername) {
      void updateDiscordUsername({ clerkId, discordUsername });
    } else if (!discordUsername && convexDiscord) {
      void updateDiscordUsername({ clerkId, discordUsername: undefined });
    }
  }, [clerkId, discordUsername, dbUser, updateDiscordUsername]);

  const connectDiscord = async () => {
    if (!user) return;
    setDiscordLoading(true);
    try {
      const res = await user.createExternalAccount({
        strategy: "oauth_discord",
        redirectUrl: window.location.origin + "/dashboard",
      });
      const url = res.verification?.externalVerificationRedirectURL;
      if (url) {
        window.location.href = url.toString();
      }
    } catch {
      toast.error("Failed to connect Discord");
      setDiscordLoading(false);
    }
  };

  const disconnectDiscord = async () => {
    if (!discordAccount || !clerkId) return;
    setDiscordLoading(true);
    try {
      await discordAccount.destroy();
      await updateDiscordUsername({ clerkId, discordUsername: undefined });
      toast.success("Discord disconnected");
    } catch {
      toast.error("Failed to disconnect Discord");
    } finally {
      setDiscordLoading(false);
    }
  };

  const copySupportId = () => {
    if (supportId) {
      navigator.clipboard.writeText(supportId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyProfileLink = () => {
    if (supportId) {
      const url = `${window.location.origin}/pilot/${supportId}`;
      navigator.clipboard.writeText(url);
      setProfileCopied(true);
      toast.success("Profile link copied to clipboard");
      setTimeout(() => setProfileCopied(false), 2000);
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
            Your Account
          </h1>
          <p className="mb-12 text-xl text-slate-400">
            Sign in to view your account, flight statistics, and history
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
            {user?.imageUrl ? (
              <button
                onClick={copyProfileLink}
                className="group/icon relative h-14 w-14 cursor-pointer overflow-hidden rounded-full border-2 border-cyan-500/50 transition-all hover:border-cyan-400"
                title="Copy profile link"
              >
                <Image
                  src={user.imageUrl}
                  alt="Profile"
                  width={56}
                  height={56}
                  className="rounded-full transition-opacity group-hover/icon:opacity-20"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover/icon:opacity-100">
                  {profileCopied ? (
                    <Check className="h-6 w-6 text-emerald-400" />
                  ) : (
                    <Link className="h-6 w-6 text-cyan-300" />
                  )}
                </div>
              </button>
            ) : (
              <button
                onClick={copyProfileLink}
                className="group/icon flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border-2 border-cyan-500/50 bg-cyan-500/10 transition-all hover:border-cyan-400 hover:bg-cyan-500/20"
                title="Copy profile link"
              >
                <Plane className="h-6 w-6 text-cyan-400 transition-all group-hover/icon:hidden" />
                {profileCopied ? (
                  <Check className="hidden h-6 w-6 text-emerald-400 group-hover/icon:block" />
                ) : (
                  <Link className="hidden h-6 w-6 text-cyan-300 group-hover/icon:block" />
                )}
              </button>
            )}
            <div>
              <h1 className="text-3xl font-bold text-white">
                {user?.firstName ? `${user.firstName}'s Account` : "Your Account"}
              </h1>
              {supportId && (
                <div className="mt-1">
                  <button
                    onClick={copySupportId}
                    className="flex items-center gap-1.5 text-slate-600 font-mono text-xs hover:text-slate-400 transition-colors cursor-pointer"
                    title="Click to copy - share this with support when reporting issues"
                  >
                    <span>ID: {supportId.slice(0, 8)}...</span>
                    {copied ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              )}
              <div className="mt-1.5 flex items-center gap-3">
                {discordUsername ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-indigo-400 font-mono text-xs">
                      <DiscordIcon className="h-3.5 w-3.5" />
                      <span>{discordUsername}</span>
                    </div>
                    <button
                      onClick={disconnectDiscord}
                      disabled={discordLoading}
                      className="text-slate-600 font-mono text-[10px] hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={connectDiscord}
                    disabled={discordLoading}
                    className="flex items-center gap-1.5 text-slate-600 font-mono text-xs hover:text-indigo-400 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <DiscordIcon className="h-3.5 w-3.5" />
                    <span>{discordLoading ? "Connecting..." : "Connect Discord"}</span>
                  </button>
                )}
                {stats && stats.currentStreak > 0 && (
                  <div className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5">
                    <Flame className="h-3 w-3 text-amber-400" />
                    <span className="font-mono text-xs font-bold text-amber-400">{stats.currentStreak}d</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {statsLoading ? (
          <StatsSkeleton />
        ) : !stats || stats.totalFlights === 0 ? (
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

            {/* Contributions Section */}
            {(approvedAircraftImages !== undefined && approvedAircraftImages > 0) ||
            (approvedAirportCharts !== undefined && approvedAirportCharts > 0) ? (
              <div className="mb-8">
                <h3 className="font-mono text-sm font-bold text-slate-400 tracking-wider mb-4">
                  YOUR CONTRIBUTIONS
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {approvedAircraftImages !== undefined && approvedAircraftImages > 0 && (
                    <StatCard
                      icon={<Camera className="h-5 w-5" />}
                      label="Aircraft Images"
                      value={approvedAircraftImages.toString()}
                      color="purple"
                    />
                  )}
                  {approvedAirportCharts !== undefined && approvedAirportCharts > 0 && (
                    <StatCard
                      icon={<FileText className="h-5 w-5" />}
                      label="Airport Charts"
                      value={approvedAirportCharts.toString()}
                      color="emerald"
                    />
                  )}
                </div>
              </div>
            ) : null}

            {/* Active Challenges */}
            {dbUser && <ChallengesSection userId={dbUser._id} />}

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
                            <span className="text-white font-medium">{aircraft.name.replace(/\s*\([^)]*\)/g, "").trim()}</span>
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
            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl">
              <button
                onClick={() => setFlightsExpanded(!flightsExpanded)}
                className="flex w-full cursor-pointer items-center justify-between p-6"
              >
                <h3 className="font-mono text-sm font-bold text-slate-400 tracking-wider">
                  RECENT FLIGHTS
                </h3>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-slate-600">
                    {isPro ? "Last 10 flights" : "Last 3 flights"}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${flightsExpanded ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {flightsExpanded && (
                <div className="space-y-3 px-6 pb-6">
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
                            {flight.aircraftType.replace(/\s*\([^)]*\)/g, "").trim()}
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
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-600">{flight.callsign}</span>
                        {flight.routeData && flight.routeData.length > 1 && (
                          <>
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}/radar?replay=${flight.id}`;
                                navigator.clipboard.writeText(url).then(() => {
                                  toast.success("Flight replay link copied to clipboard");
                                  Analytics.flightReplayShared({
                                    callsign: flight.callsign,
                                    aircraftType: flight.aircraftType,
                                    depICAO: flight.depICAO,
                                    arrICAO: flight.arrICAO,
                                    flightId: flight.id as string,
                                  });
                                });
                              }}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/40 opacity-0 transition-all hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400 group-hover:opacity-100"
                              title="Copy share link"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => router.push(`/radar?replay=${flight.id}`)}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 opacity-0 transition-all hover:bg-amber-500/20 group-hover:opacity-100"
                              title="Replay this flight"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {!isPro && stats.recentFlights.length > 3 && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => {
                          Analytics.upgradeButtonClicked({
                            source: "dashboard_recent_flights_lock",
                            feature: "full_flight_history",
                          });
                          router.push("/pricing");
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 font-mono text-xs text-amber-400 transition-all hover:bg-amber-500/20"
                      >
                        <Lock className="h-3 w-3" />
                        Start 7-day trial to see {stats.recentFlights.length - 3} more flights
                      </button>
                    </div>
                  )}
                </div>
              )}
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
                  onClick={() => {
                    Analytics.upgradeButtonClicked({
                      source: "dashboard_main_upgrade_cta",
                      feature: "advanced_analytics",
                    });
                    router.push("/pricing");
                  }}
                  className="cursor-pointer rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40"
                >
                  Start 7-day PRO trial
                </button>
              </div>
            )}
          </>
        )}

        {/* Account Section */}
        <div className="mt-12">
          <h3 className="font-mono text-sm font-bold text-slate-400 tracking-wider mb-4">
            ACCOUNT
          </h3>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
            <h4 className="mb-4 text-sm font-semibold text-white">Account Info</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-300">
                  {user?.primaryEmailAddress?.emailAddress ?? "No email"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-300">
                  Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "Unknown"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-300">
                  {isPro ? (
                    <span className="text-emerald-400">PRO</span>
                  ) : (
                    <span className="text-slate-500">Free Tier</span>
                  )}
                </span>
              </div>
            </div>
            {isPro && (
              <button
                onClick={async () => {
                  try {
                    const url = await createPortalSession();
                    if (url) window.location.href = url;
                  } catch {
                    // silently fail
                  }
                }}
                className="mt-4 flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 transition-all hover:bg-white/10 hover:text-white"
              >
                <CreditCard className="h-4 w-4" />
                Manage Subscription
              </button>
            )}
          </div>

          {/* Danger Zone */}
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-6 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <h4 className="text-sm font-semibold text-red-400">Danger Zone</h4>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400 transition-all hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4" />
                Delete Account
              </button>
            ) : (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <p className="mb-3 text-sm font-medium text-red-300">
                  Are you sure? This will permanently delete your account.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      setIsDeleting(true);
                      try {
                        await user?.delete();
                      } catch {
                        setIsDeleting(false);
                        setShowDeleteConfirm(false);
                      }
                    }}
                    disabled={isDeleting}
                    className="flex cursor-pointer items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting..." : "Yes, delete my account"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition-all hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
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
          <Image src="/logo-white.svg" alt="RadarThing" width={100} height={30} />
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/radar")}
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
        <>
          <div className="text-2xl font-bold text-white">{value}</div>
          {subtitle && (
            <div className="font-mono text-xs text-slate-600 mt-0.5">{subtitle}</div>
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
      <p className="mb-3 text-sm text-slate-500">Available with PRO</p>
      <button
        onClick={() => {
          Analytics.upgradeButtonClicked({
            source: "dashboard_pro_locked_card",
            feature: "advanced_analytics",
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
        Start flying in GeoFS to see your stats here.
        <br />
        Make sure you&apos;re signed in with the same Google account.
      </p>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <>
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
    </>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
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
