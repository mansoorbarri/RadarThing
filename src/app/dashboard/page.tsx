"use client";

import { copyText } from "~/lib/clipboard";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useProStatus } from "~/hooks/useProStatus";
import { GoogleSignInButton } from "~/components/auth/GoogleSignInButton";
import { Analytics } from "~/lib/analytics";
import { createPortalSession } from "~/app/actions/create-portal";
import { getCurrentUserDataExport } from "~/app/actions/export-user-data";
import {
  ChevronDown,
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
  Download,
  Loader2,
  Camera,
  FileText,
  Link,
  Trash2,
  Mail,
  Shield,
  AlertTriangle,
  CreditCard,
  Flame,
  User,
  Pencil,
  EyeOff,
} from "lucide-react";
import Image from "next/image";
import { UserAuth } from "~/components/atc/userAuth";
import { SystemThemeLogo } from "~/components/ui/SystemThemeLogo";
import { SiteFooter } from "~/components/site/SiteFooter";
import { SiteHeader } from "~/components/site/SiteHeader";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { ActiveChallengesPanel } from "~/components/challenges/ActiveChallengesPanel";
import { FlightCardDialog } from "~/components/flight-card/FlightCardDialog";
import type { FlightCardData } from "~/components/flight-card/FlightCard";
import {
  FlightHistoryPanel,
  type FlightHistoryPanelFlight,
} from "~/components/flights/FlightHistoryPanel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { downloadAccountDataExport } from "~/lib/account-data-export";
import { usePrivacyPreferences } from "~/hooks/usePrivacyPreferences";

function formatFlightTime(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function getDisplayName(
  user: ReturnType<typeof useUser>["user"],
): string | null {
  if (!user) return null;
  return (
    user.fullName ??
    user.username ??
    user.primaryEmailAddress?.emailAddress?.split("@")[0] ??
    null
  );
}

const personalInfoTransitionClass =
  "transition-[filter] duration-300 ease-out will-change-[filter]";
const personalInfoBlurClass = "blur-[5px] select-none";

export default function DashboardPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded, user } = useUser();
  const clerkId = user?.id;
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [profileCopied, setProfileCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [showNameEditor, setShowNameEditor] = useState(false);
  const [firstNameDraft, setFirstNameDraft] = useState("");
  const [lastNameDraft, setLastNameDraft] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [flightsExpanded, setFlightsExpanded] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [cardFlight, setCardFlight] = useState<FlightCardData | null>(null);
  const [flightPendingDelete, setFlightPendingDelete] =
    useState<FlightHistoryPanelFlight | null>(null);
  const [deletingFlightId, setDeletingFlightId] = useState<string | null>(null);
  const updateDiscordUsername = useMutation(api.users.updateDiscordUsername);
  const deleteFlight = useMutation(api.flights.deleteFlight);
  const { hidePersonalInfo, setHidePersonalInfo } = usePrivacyPreferences();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Real-time queries
  const { isProUser: isPro, isLoading: proLoading } = useProStatus();
  // Remembered for the session, so coming back to the dashboard keeps it.
  // Read straight away (the stats only render client-side, after the user
  // loads), so a remembered "open" doesn't flash closed first.
  const [showBreakdowns, setShowBreakdowns] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem("radarthing-dashboard-breakdowns") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(
        "radarthing-dashboard-breakdowns",
        showBreakdowns ? "1" : "0",
      );
    } catch {
      // Ignore storage errors.
    }
  }, [showBreakdowns]);
  const [confirmDiscordDisconnect, setConfirmDiscordDisconnect] =
    useState(false);
  // While the plan is still loading, show placeholders rather than flashing
  // Free-plan locks and upgrade prompts at Pro users.
  const showProLocks = !isPro && !proLoading;
  const statsQuery = useQuery(
    api.flights.getStatsByClerkId,
    clerkId ? { clerkId } : "skip",
  );
  const dbUser = useQuery(
    api.users.getByClerkId,
    clerkId ? { clerkId } : "skip",
  );
  const approvedAircraftImages = useQuery(
    api.aircraftImages.getApprovedCountByUser,
    clerkId ? { uploadedBy: clerkId } : "skip",
  );
  const approvedAirportCharts = useQuery(
    api.airportCharts.getApprovedCountByUser,
    clerkId ? { uploadedBy: clerkId } : "skip",
  );

  const stats = useMemo(() => statsQuery ?? null, [statsQuery]);
  const supportId = useMemo(() => dbUser?._id ?? null, [dbUser]);
  const displayName = useMemo(() => getDisplayName(user), [user]);
  const loading = !mounted || !isLoaded;
  const statsLoading = clerkId && statsQuery === undefined;

  // Track page view and stats (only once per page load)
  const hasTracked = useRef(false);
  const hasReloadedDiscordOAuth = useRef(false);
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
    (a) => a.provider === "discord",
  );
  const discordUsername = discordAccount?.username?.trim() || null;
  const discordUserId = discordAccount?.providerUserId?.trim() || null;
  const discordConnected = Boolean(discordAccount);

  useEffect(() => {
    if (!user || hasReloadedDiscordOAuth.current) return;
    if (sessionStorage.getItem("radarthing:discord-oauth-pending") !== "1") {
      return;
    }

    hasReloadedDiscordOAuth.current = true;
    sessionStorage.removeItem("radarthing:discord-oauth-pending");
    void user.reload();
  }, [user]);

  // Auto-sync Discord username to Convex
  useEffect(() => {
    if (!clerkId || dbUser === undefined) return;
    const convexDiscord = dbUser?.discordUsername ?? null;
    if (
      discordConnected &&
      discordUsername &&
      (convexDiscord !== discordUsername ||
        dbUser?.discordUserId !== discordUserId)
    ) {
      void updateDiscordUsername({
        clerkId,
        discordUsername: discordUsername ?? undefined,
        discordUserId: discordUserId ?? undefined,
      });
    } else if (!discordConnected && (convexDiscord || dbUser?.discordUserId)) {
      void updateDiscordUsername({
        clerkId,
        discordUsername: undefined,
        discordUserId: undefined,
      });
    }
  }, [
    clerkId,
    discordConnected,
    discordUsername,
    discordUserId,
    dbUser,
    updateDiscordUsername,
  ]);

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
        sessionStorage.setItem("radarthing:discord-oauth-pending", "1");
        window.location.href = url.toString();
      }
    } catch {
      toast.error(
        "We couldn't open Discord. Allow pop-ups and redirects for this site, then try again.",
      );
      setDiscordLoading(false);
    }
  };

  const [discordError, setDiscordError] = useState<string | null>(null);
  // Returns whether it worked, so the confirm dialog can stay open on error.
  const disconnectDiscord = async () => {
    if (!discordAccount || !clerkId) return false;
    setDiscordLoading(true);
    setDiscordError(null);
    try {
      await discordAccount.destroy();
      await updateDiscordUsername({ clerkId, discordUsername: undefined });
      toast.success("Discord disconnected");
      return true;
    } catch {
      setDiscordError(
        "Couldn't disconnect Discord. Check your connection and try again.",
      );
      return false;
    } finally {
      setDiscordLoading(false);
    }
  };

  const copySupportId = () => {
    if (supportId) {
      copyText(supportId)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => toast.error("Couldn't copy. Select the ID and copy it."));
    }
  };

  const copyProfileLink = () => {
    if (supportId) {
      const url = `${window.location.origin}/pilot/${supportId}`;
      copyText(url)
        .then(() => {
          setProfileCopied(true);
          toast.success("Profile link copied to clipboard");
          setTimeout(() => setProfileCopied(false), 2000);
        })
        .catch(() =>
          toast.error("Couldn't copy the link. Open your profile to share it."),
        );
    }
  };

  const downloadAccountData = async () => {
    setIsExportingData(true);
    Analytics.accountDataExportClicked({ source: "dashboard_account" });

    try {
      const exportData = await getCurrentUserDataExport();
      downloadAccountDataExport(exportData);
      Analytics.accountDataExportDownloaded({
        source: "dashboard_account",
        flightCount: exportData.flights.length,
      });
      toast.success("Account data downloaded");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to export account data",
      );
    } finally {
      setIsExportingData(false);
    }
  };

  const openNameEditor = () => {
    Analytics.accountNameEditOpened({ source: "dashboard_account" });
    setFirstNameDraft(user?.firstName ?? "");
    setLastNameDraft(user?.lastName ?? "");
    setShowNameEditor(true);
  };

  const saveName = async () => {
    if (!user) return;

    const nextFirstName = firstNameDraft.trim() || null;
    const nextLastName = lastNameDraft.trim() || null;

    setIsSavingName(true);
    try {
      await user.update({
        firstName: nextFirstName,
        lastName: nextLastName,
      });
      await user.reload();
      Analytics.accountNameUpdated({
        source: "dashboard_account",
        hasFirstName: Boolean(nextFirstName),
        hasLastName: Boolean(nextLastName),
      });
      toast.success("Name updated");
      setShowNameEditor(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update your name";
      toast.error(message);
    } finally {
      setIsSavingName(false);
    }
  };

  const confirmDeleteFlight = async () => {
    if (!flightPendingDelete || !dbUser) return;

    setDeletingFlightId(flightPendingDelete.id);
    try {
      await deleteFlight({ flightId: flightPendingDelete.id });
      toast.success("Flight deleted");
      Analytics.flightDeleted({
        source: "dashboard",
        targetUserId: dbUser._id,
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

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!isSignedIn) {
    return (
      <div className="dashboard-theme-surface bg-site min-h-screen text-white">
        <Header hidePersonalInfo={hidePersonalInfo} />
        <main
          id="main-content"
          className="mx-auto max-w-2xl px-6 py-20 text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
            <Plane className="h-4 w-4 text-cyan-400" />
            <span className="font-mono text-sm text-cyan-400">
              Sign in required
            </span>
          </div>
          <h1 className="mb-4 text-4xl font-bold text-white sm:text-5xl">
            Your account
          </h1>
          <p className="mb-12 text-xl text-slate-400">
            Sign in to view your account, flight statistics, and history
          </p>
          <GoogleSignInButton>
            <button className="cursor-pointer rounded-xl bg-cyan-400 px-8 py-4 font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-300 hover:shadow-cyan-500/40 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none">
              Sign in or sign up
            </button>
          </GoogleSignInButton>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="dashboard-theme-surface bg-site min-h-screen text-white">
      <Header hidePersonalInfo={hidePersonalInfo} />

      <main id="main-content" className="mx-auto max-w-6xl px-6 py-12">
        {/* Profile Header */}
        <div className="mb-10">
          <div className="mb-2 flex items-center gap-4">
            {user?.imageUrl ? (
              <button
                onClick={copyProfileLink}
                className="group/icon relative h-14 w-14 cursor-pointer overflow-hidden rounded-full border-2 border-cyan-500/50 transition-all hover:border-cyan-400"
                title="Copy profile link"
                aria-label={
                  profileCopied ? "Profile link copied" : "Copy profile link"
                }
              >
                <Image
                  src={user.imageUrl}
                  alt=""
                  width={56}
                  height={56}
                  className={`rounded-full transition-all duration-300 ease-out will-change-[filter,opacity] group-hover/icon:opacity-20 ${
                    hidePersonalInfo ? personalInfoBlurClass : ""
                  }`}
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
                aria-label={
                  profileCopied ? "Profile link copied" : "Copy profile link"
                }
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
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-white">
                  {displayName && !hidePersonalInfo
                    ? `${displayName}'s account`
                    : "Your account"}
                </h1>
                <button
                  onClick={openNameEditor}
                  className="cursor-pointer rounded-full border border-white/8 bg-white/[0.03] p-2 text-slate-400 transition-all hover:border-emerald-400/30 hover:bg-emerald-500/10 hover:text-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:outline-none"
                  title="Change name"
                  aria-label="Change name"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              {supportId && (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={copySupportId}
                    className="flex min-h-10 cursor-pointer items-center gap-1.5 font-mono text-xs text-slate-400 transition-colors hover:text-white"
                    title="Copy your support ID to share with support when reporting a problem"
                    aria-label={
                      copied
                        ? "Support ID copied"
                        : "Copy your support ID for support requests"
                    }
                  >
                    <span>Support ID: {supportId.slice(0, 8)}…</span>
                    {copied ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              )}
              <div className="mt-1.5 flex items-center gap-3">
                {discordConnected ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 font-mono text-xs text-indigo-400">
                      <DiscordIcon className="h-3.5 w-3.5" />
                      <span>{discordUsername ?? "Discord connected"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDiscordError(null);
                        setConfirmDiscordDisconnect(true);
                      }}
                      disabled={discordLoading}
                      className="inline-flex min-h-10 cursor-pointer items-center font-mono text-xs text-slate-400 transition-colors hover:text-red-400 disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={connectDiscord}
                    disabled={discordLoading}
                    className="flex min-h-10 cursor-pointer items-center gap-1.5 font-mono text-xs text-slate-400 transition-colors hover:text-indigo-400 disabled:opacity-50"
                  >
                    <DiscordIcon className="h-3.5 w-3.5" />
                    <span>
                      {discordLoading ? "Connecting…" : "Connect Discord"}
                    </span>
                  </button>
                )}
                {stats && stats.currentStreak > 0 && (
                  <div className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5">
                    <Flame className="h-3 w-3 text-amber-400" />
                    <span className="font-mono text-xs font-bold text-amber-400">
                      {stats.currentStreak}d
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <ActiveChallengesPanel highlightedUserId={supportId} />

        {statsLoading ? (
          <StatsSkeleton />
        ) : !stats || stats.totalFlights === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Stats Grid - Free Tier */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<Plane className="h-5 w-5" />}
                label="Total flights"
                value={stats.totalFlights.toString()}
                color="cyan"
              />
              <StatCard
                icon={<Navigation className="h-5 w-5" />}
                label="Distance flown"
                value={`${stats.totalDistanceNm.toLocaleString()} nm`}
                color="blue"
              />
              <StatCard
                icon={<Clock className="h-5 w-5" />}
                label="Flight time"
                value={formatFlightTime(stats.totalFlightTimeMs)}
                color="purple"
                locked={showProLocks}
                loading={proLoading}
              />
              <StatCard
                icon={<MapPin className="h-5 w-5" />}
                label="Airports visited"
                value={stats.uniqueAirports.toString()}
                color="emerald"
                locked={showProLocks}
                loading={proLoading}
              />
            </div>

            {/* Contributions Section */}
            {(approvedAircraftImages !== undefined &&
              approvedAircraftImages > 0) ||
            (approvedAirportCharts !== undefined &&
              approvedAirportCharts > 0) ? (
              <div className="mb-8">
                <h2 className="mb-4 font-mono text-xs font-bold tracking-widest text-slate-300 uppercase">
                  Your contributions
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {approvedAircraftImages !== undefined &&
                    approvedAircraftImages > 0 && (
                      <StatCard
                        icon={<Camera className="h-5 w-5" />}
                        label="Aircraft images"
                        value={approvedAircraftImages.toString()}
                        color="purple"
                      />
                    )}
                  {approvedAirportCharts !== undefined &&
                    approvedAirportCharts > 0 && (
                      <StatCard
                        icon={<FileText className="h-5 w-5" />}
                        label="Airport charts"
                        value={approvedAirportCharts.toString()}
                        color="emerald"
                      />
                    )}
                </div>
              </div>
            ) : null}

            {/* Phones: the three breakdown cards fold away so recent flights
                are reachable without a long scroll. */}
            <button
              type="button"
              onClick={() => setShowBreakdowns((current) => !current)}
              aria-expanded={showBreakdowns}
              aria-controls="dashboard-breakdowns"
              className="mb-4 flex min-h-11 w-full cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 text-sm font-medium text-slate-200 sm:hidden"
            >
              {showBreakdowns
                ? "Hide top aircraft, routes and airports"
                : "Show top aircraft, routes and airports"}
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 transition-transform ${showBreakdowns ? "rotate-180" : ""}`}
              />
            </button>
            <div
              id="dashboard-breakdowns"
              className={`mb-8 grid gap-6 lg:grid-cols-3 ${showBreakdowns ? "" : "max-sm:hidden"}`}
            >
              {/* Top Aircraft - Pro */}
              <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-mono text-xs font-bold tracking-widest text-slate-300 uppercase">
                    Top aircraft
                  </h2>
                  {showProLocks && (
                    <Lock
                      className="h-4 w-4 text-slate-400"
                      aria-hidden="true"
                    />
                  )}
                </div>
                {proLoading ? (
                  <div
                    aria-hidden="true"
                    className="h-24 animate-pulse rounded-xl bg-white/[0.04] motion-reduce:animate-none"
                  />
                ) : isPro ? (
                  <div className="space-y-3">
                    {stats.topAircraft.length === 0 ? (
                      <p className="text-sm text-slate-400">No data yet</p>
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

              {/* Top Routes - Pro */}
              <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-mono text-xs font-bold tracking-widest text-slate-300 uppercase">
                    Top routes
                  </h2>
                  {showProLocks && (
                    <Lock
                      className="h-4 w-4 text-slate-400"
                      aria-hidden="true"
                    />
                  )}
                </div>
                {proLoading ? (
                  <div
                    aria-hidden="true"
                    className="h-24 animate-pulse rounded-xl bg-white/[0.04] motion-reduce:animate-none"
                  />
                ) : isPro ? (
                  <div className="space-y-3">
                    {stats.topRoutes.length === 0 ? (
                      <p className="text-sm text-slate-400">No data yet</p>
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

              {/* Top Airports - Pro */}
              <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-mono text-xs font-bold tracking-widest text-slate-300 uppercase">
                    Top airports
                  </h2>
                  {showProLocks && (
                    <Lock
                      className="h-4 w-4 text-slate-400"
                      aria-hidden="true"
                    />
                  )}
                </div>
                {proLoading ? (
                  <div
                    aria-hidden="true"
                    className="h-24 animate-pulse rounded-xl bg-white/[0.04] motion-reduce:animate-none"
                  />
                ) : isPro ? (
                  <div className="space-y-3">
                    {stats.topAirports.length === 0 ? (
                      <p className="text-sm text-slate-400">No data yet</p>
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
            {dbUser && (
              <FlightHistoryPanel
                userId={dbUser._id as Id<"users">}
                variant="collapsible"
                expanded={flightsExpanded}
                onExpandedChange={setFlightsExpanded}
                canGenerateFlightCard={isPro}
                canSubmitChallengeFlights
                canDeleteFlights
                deletingFlightId={deletingFlightId}
                onShareFlight={(flight) => {
                  const url = `${window.location.origin}/radar?replay=${flight.id}`;
                  copyText(url)
                    .then(() => {
                      toast.success("Flight replay link copied to clipboard");
                      Analytics.flightReplayShared({
                        callsign: flight.callsign,
                        aircraftType: flight.aircraftType,
                        depICAO: flight.depICAO,
                        arrICAO: flight.arrICAO,
                        flightId: flight.id as string,
                      });
                    })
                    .catch(() => toast.error("Couldn't copy the replay link."));
                }}
                onGenerateFlightCard={(flight: FlightHistoryPanelFlight) => {
                  if (!isPro) {
                    Analytics.proFeatureBlocked({
                      feature: "flight_card",
                    });
                    router.push("/pricing");
                    return;
                  }
                  setCardFlight({
                    callsign: flight.callsign,
                    discordUsername: dbUser.discordUsername ?? undefined,
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
                onReplayFlight={(flight) =>
                  router.push(`/radar?replay=${flight.id}`)
                }
                onDeleteFlight={(flight) => {
                  setFlightPendingDelete(flight);
                }}
                onUpgrade={() => {
                  Analytics.upgradeButtonClicked({
                    source: "dashboard_recent_flights_lock",
                    feature: "full_flight_history",
                  });
                  router.push("/pricing");
                }}
              />
            )}

            {/* Upgrade CTA for Free Users */}
            {showProLocks && (
              <div className="mt-8 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-8 text-center backdrop-blur-xl">
                <TrendingUp className="mx-auto mb-4 h-10 w-10 text-cyan-400" />
                <h2 className="mb-2 text-xl font-bold text-white">
                  Unlock full analytics
                </h2>
                <p className="mb-6 text-slate-400">
                  Get every recorded flight plus detailed insights for flight
                  time, top airports, and routes
                </p>
                <NextLink
                  href="/pricing"
                  onClick={() => {
                    Analytics.upgradeButtonClicked({
                      source: "dashboard_main_upgrade_cta",
                      feature: "advanced_analytics",
                    });
                  }}
                  className="inline-block cursor-pointer rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-300 hover:shadow-cyan-500/40 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none"
                >
                  Start 7-day Pro trial
                </NextLink>
              </div>
            )}
          </>
        )}

        {/* Account Section */}
        <div className="mt-12">
          <h2 className="mb-4 font-mono text-xs font-bold tracking-widest text-slate-300 uppercase">
            Account
          </h2>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="p-6">
                <h3 className="mb-5 text-sm font-semibold text-white">
                  Account Info
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2 font-mono text-[11px] tracking-widest text-slate-400 uppercase">
                      <User className="h-3.5 w-3.5" />
                      Name
                    </div>
                    <div
                      className={`truncate text-sm text-slate-300 ${personalInfoTransitionClass} ${
                        hidePersonalInfo ? personalInfoBlurClass : ""
                      }`}
                    >
                      {displayName ?? "Not set"}
                    </div>
                  </div>
                  <div className="min-w-0 xl:col-span-2">
                    <div className="mb-1 flex items-center gap-2 font-mono text-[11px] tracking-widest text-slate-400 uppercase">
                      <Mail className="h-3.5 w-3.5" />
                      Email
                    </div>
                    <div
                      title={
                        hidePersonalInfo
                          ? undefined
                          : user?.primaryEmailAddress?.emailAddress
                      }
                      className={`truncate text-sm text-slate-300 ${personalInfoTransitionClass} ${
                        hidePersonalInfo ? personalInfoBlurClass : ""
                      }`}
                    >
                      {user?.primaryEmailAddress?.emailAddress ?? "No email"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-2 font-mono text-[11px] tracking-widest text-slate-400 uppercase">
                      <Calendar className="h-3.5 w-3.5" />
                      Joined
                    </div>
                    <div className="text-sm text-slate-300">
                      {user?.createdAt
                        ? new Date(user.createdAt).toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          })
                        : "Unknown"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-2 font-mono text-[11px] tracking-widest text-slate-400 uppercase">
                      <Shield className="h-3.5 w-3.5" />
                      Plan
                    </div>
                    <div className="text-sm">
                      {proLoading ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="inline-block h-4 w-12 animate-pulse rounded bg-white/10 align-middle motion-reduce:animate-none"
                          />
                          <span className="sr-only">Loading plan…</span>
                        </>
                      ) : isPro ? (
                        <span className="text-emerald-400">Pro</span>
                      ) : (
                        <span className="text-slate-400">Free</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 bg-white/[0.02] p-4 lg:border-t-0 lg:border-l">
                <h3 className="mb-3 px-2 font-mono text-xs font-bold tracking-widest text-slate-400 uppercase">
                  Settings
                </h3>
                <div className="mb-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                        <EyeOff className="h-4 w-4 text-cyan-300" />
                        Hide personal information
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        Mask your name, email, and avatar on this dashboard.
                      </p>
                    </div>
                    <Switch
                      checked={hidePersonalInfo}
                      onCheckedChange={setHidePersonalInfo}
                      aria-label="Hide personal information"
                      className="data-[state=checked]:bg-cyan-500"
                    />
                  </div>
                </div>
                <h3 className="mb-3 px-2 font-mono text-xs font-bold tracking-widest text-slate-400 uppercase">
                  Account actions
                </h3>
                <div className="flex flex-col gap-2 md:h-14 md:flex-row">
                  <AccountActionButton
                    icon={
                      isExportingData ? (
                        <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                      ) : (
                        <Download className="h-5 w-5 shrink-0" />
                      )
                    }
                    label="Download data"
                    title="Download data"
                    onClick={downloadAccountData}
                    disabled={isExportingData}
                    tone="cyan"
                  />

                  {isPro && (
                    <AccountActionButton
                      icon={<CreditCard className="h-5 w-5 shrink-0" />}
                      label="Manage subscription"
                      title="Manage subscription"
                      onClick={async () => {
                        try {
                          const url = await createPortalSession();
                          if (url) window.location.href = url;
                          else
                            toast.error(
                              "Couldn't open subscription management. Please try again.",
                            );
                        } catch {
                          toast.error(
                            "Couldn't open subscription management. Please try again.",
                          );
                        }
                      }}
                      tone="slate"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-6 backdrop-blur-xl">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <h3 className="text-sm font-semibold text-red-400">
                Danger Zone
              </h3>
            </div>
            <p className="mb-4 text-xs text-slate-300">
              Permanently delete your account, flight history and stats. This
              can&apos;t be undone. Deleting your account doesn&apos;t cancel a
              Pro subscription, so cancel it first under Manage subscription.
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400 transition-all hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4" />
                Delete account
              </button>
            ) : (
              <form
                className="rounded-xl border border-red-500/30 bg-red-500/10 p-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (deleteConfirmText.trim().toUpperCase() !== "DELETE")
                    return;
                  setIsDeleting(true);
                  try {
                    await user?.delete();
                  } catch {
                    setIsDeleting(false);
                    toast.error(
                      "Couldn't delete your account. Please try again or contact support.",
                    );
                  }
                }}
              >
                <label
                  htmlFor="delete-account-confirm"
                  className="mb-3 block text-sm font-medium text-red-200"
                >
                  Type <strong className="font-mono">DELETE</strong> to confirm
                  you want to permanently delete your account.
                </label>
                <input
                  id="delete-account-confirm"
                  value={deleteConfirmText}
                  onChange={(event) => setDeleteConfirmText(event.target.value)}
                  autoComplete="off"
                  autoFocus
                  disabled={isDeleting}
                  className="mb-3 w-full max-w-xs rounded-lg border border-red-500/40 bg-black/40 px-3 py-2 font-mono text-sm text-white focus:border-red-400 focus:ring-2 focus:ring-red-400/30 focus:outline-none"
                />
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={
                      isDeleting ||
                      deleteConfirmText.trim().toUpperCase() !== "DELETE"
                    }
                    className="flex cursor-pointer items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting…" : "Delete my account"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText("");
                    }}
                    className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition-all hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />

      <AlertDialog
        open={showNameEditor}
        onOpenChange={(open) => {
          if (!isSavingName) {
            setShowNameEditor(open);
          }
        }}
      >
        <AlertDialogContent className="overflow-hidden border-cyan-500/20 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_34%),linear-gradient(180deg,rgba(9,9,11,0.98),rgba(2,6,23,0.96))] p-0">
          <div className="border-b border-white/10 bg-white/[0.03] px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/10 shadow-[0_0_30px_rgba(34,211,238,0.14)]">
                <User className="h-5 w-5 text-cyan-300" />
              </div>
              <AlertDialogHeader className="justify-center gap-0 text-left">
                <AlertDialogTitle className="text-xl text-white">
                  Change your name
                </AlertDialogTitle>
              </AlertDialogHeader>
            </div>
          </div>

          <form
            className="space-y-5 px-6 py-5"
            onSubmit={(event) => {
              event.preventDefault();
              void saveName();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block font-mono text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                  First name
                </span>
                <input
                  value={firstNameDraft}
                  onChange={(event) => setFirstNameDraft(event.target.value)}
                  maxLength={64}
                  autoComplete="given-name"
                  disabled={isSavingName}
                  className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white shadow-inner shadow-black/10 transition outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="First name"
                />
              </label>

              <label className="block">
                <span className="mb-2 block font-mono text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                  Last name
                </span>
                <input
                  value={lastNameDraft}
                  onChange={(event) => setLastNameDraft(event.target.value)}
                  maxLength={64}
                  autoComplete="family-name"
                  disabled={isSavingName}
                  className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white shadow-inner shadow-black/10 transition outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Last name"
                />
              </label>
            </div>

            <AlertDialogFooter className="gap-2 pt-0">
              <AlertDialogCancel
                type="button"
                disabled={isSavingName}
                className="border-white/12 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white"
              >
                Cancel
              </AlertDialogCancel>
              <Button
                type="submit"
                disabled={isSavingName}
                className="rounded-xl bg-cyan-500 text-black hover:bg-cyan-400"
              >
                {isSavingName ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save name"
                )}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={flightPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingFlightId) {
            setFlightPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent className="overflow-hidden border-red-500/20 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.14),_transparent_32%),linear-gradient(180deg,rgba(9,9,11,0.98),rgba(2,6,23,0.96))] p-0">
          <div className="border-b border-white/10 bg-white/[0.03] px-6 py-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.16)]">
                <Trash2 className="h-5 w-5 text-red-300" />
              </div>
              <AlertDialogHeader className="gap-1 text-left">
                <AlertDialogTitle className="text-xl text-white">
                  Delete flight from your history?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-6 text-slate-300">
                  This can&apos;t be undone. Are you sure?
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
          </div>

          <div className="space-y-4 px-6 py-4">
            <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono font-bold text-white">
                  {flightPendingDelete?.depICAO || "???"}
                </span>
                <Route className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-mono font-bold text-white">
                  {flightPendingDelete?.arrICAO || "???"}
                </span>
                {flightPendingDelete?.callsign && (
                  <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] text-cyan-300">
                    {flightPendingDelete.callsign}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-400">
                {flightPendingDelete?.aircraftType || "Unknown aircraft"}
              </p>
            </div>

            <AlertDialogFooter className="gap-2 pt-0">
              <AlertDialogCancel
                disabled={deletingFlightId !== null}
                className="border-white/12 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white"
              >
                Keep flight
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void confirmDeleteFlight();
                }}
                disabled={deletingFlightId !== null}
                className="border border-red-500/30 bg-red-500/85 text-white shadow-lg shadow-red-950/30 hover:bg-red-500"
              >
                {deletingFlightId === flightPendingDelete?.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting flight…
                  </>
                ) : (
                  "Delete flight"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDiscordDisconnect}
        onOpenChange={(open) => {
          if (!discordLoading) setConfirmDiscordDisconnect(open);
        }}
      >
        <AlertDialogContent className="bg-site border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Disconnect Discord?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              Your Discord username will no longer show on your profile or the
              leaderboard. Your flights and stats stay as they are, and you can
              connect again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {discordError && (
            <p role="alert" className="text-sm text-red-300">
              {discordError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={discordLoading}
              className="border-white/12 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white"
            >
              Keep connected
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Stay open until the request finishes, so the result is clear.
                event.preventDefault();
                void disconnectDiscord().then((ok) => {
                  if (ok) setConfirmDiscordDisconnect(false);
                });
              }}
              disabled={discordLoading}
              aria-busy={discordLoading}
              className="border border-red-500/30 bg-red-500/85 text-white hover:bg-red-500"
            >
              {discordLoading ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Disconnecting…
                </>
              ) : (
                "Disconnect"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {cardFlight && (
        <FlightCardDialog
          data={cardFlight}
          onClose={() => setCardFlight(null)}
        />
      )}
    </div>
  );
}

function Header({ hidePersonalInfo = false }: { hidePersonalInfo?: boolean }) {
  return <SiteHeader tone="themed" hidePersonalInfo={hidePersonalInfo} />;
}

function StatCard({
  icon,
  label,
  value,
  color,
  locked = false,
  loading = false,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "cyan" | "blue" | "purple" | "emerald" | "amber";
  locked?: boolean;
  /** Plan still loading: show a placeholder, not a value that may lock. */
  loading?: boolean;
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
      <div className="mb-1 font-mono text-xs tracking-wider text-slate-400 uppercase">
        {label}
      </div>
      {loading ? (
        <>
          <div
            aria-hidden="true"
            className="h-8 w-20 animate-pulse rounded bg-white/10 motion-reduce:animate-none"
          />
          <span className="sr-only">Loading…</span>
        </>
      ) : locked ? (
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <span className="font-mono text-sm text-slate-400">Pro</span>
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold text-white">{value}</div>
          {subtitle && (
            <div className="mt-0.5 font-mono text-xs text-slate-400">
              {subtitle}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AccountActionButton({
  icon,
  label,
  onClick,
  title,
  disabled = false,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void | Promise<void>;
  title: string;
  disabled?: boolean;
  tone: "cyan" | "emerald" | "slate";
}) {
  const toneClasses = {
    cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 focus-visible:ring-cyan-400/60",
    emerald:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 focus-visible:ring-emerald-400/60",
    slate:
      "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.09] hover:text-white focus-visible:ring-white/30",
  };

  return (
    <button
      onClick={() => {
        void onClick();
      }}
      disabled={disabled}
      className={`group flex h-14 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border px-4 transition-all duration-300 ease-out focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 md:min-w-0 md:flex-1 md:hover:flex-[6] md:focus-visible:flex-[6] ${toneClasses[tone]}`}
      title={title}
    >
      {icon}
      <span className="ml-3 max-w-40 overflow-hidden font-mono text-xs font-bold tracking-widest whitespace-nowrap uppercase opacity-100 transition-all duration-300 ease-out md:ml-0 md:max-w-0 md:opacity-0 md:group-hover:ml-3 md:group-hover:max-w-56 md:group-hover:opacity-100 md:group-focus-visible:ml-3 md:group-focus-visible:max-w-56 md:group-focus-visible:opacity-100">
        {label}
      </span>
    </button>
  );
}

function ProLockedContent() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <Lock className="mb-2 h-8 w-8 text-slate-400" />
      <p className="mb-3 text-sm text-slate-400">Available with Pro</p>
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
  const steps = [
    {
      title: "Install the GeoFS script",
      body: "Add the RadarThing userscript with Tampermonkey.",
      href: "/userscript",
      native: true,
      cta: "Install script",
    },
    {
      title: "Sign in to GeoFS",
      body: "Use the same Google account you use here, so flights land on this dashboard.",
      href: "https://www.geo-fs.com/geofs.php",
      native: true,
      cta: "Open GeoFS",
    },
    {
      title: "Press Start tracking",
      body: "Enter your route and callsign in the RadarThing panel inside GeoFS.",
      href: "/guides/getting-started",
      native: false,
      cta: "Read the guide",
    },
  ];
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-8 backdrop-blur-xl sm:p-10">
      <Plane className="mb-4 h-10 w-10 text-cyan-300" aria-hidden="true" />
      <h2 className="mb-2 text-xl font-semibold text-white">
        No flights yet. Here&apos;s how to log your first one
      </h2>
      <ol className="mt-6 grid gap-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
          >
            <span className="font-mono text-xs text-cyan-300">
              Step {index + 1}
            </span>
            <p className="mt-1 font-semibold text-white">{step.title}</p>
            <p className="mt-1 text-sm text-slate-300">{step.body}</p>
            {step.native ? (
              <a
                href={step.href}
                className="mt-3 inline-block text-sm font-medium text-cyan-300 underline-offset-4 hover:underline"
              >
                {step.cta}
              </a>
            ) : (
              <NextLink
                href={step.href}
                className="mt-3 inline-block text-sm font-medium text-cyan-300 underline-offset-4 hover:underline"
              >
                {step.cta}
              </NextLink>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <>
      {/* Stats Grid */}
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

      {/* Three Column Grid */}
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

      {/* Recent Flights */}
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
    </>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}
