"use client";

import { SignInButton, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  Copy,
  Gift,
  Radar,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { UserAuth } from "~/components/atc/userAuth";
import Loading from "~/components/loading";
import { Button } from "~/components/ui/button";
import { Analytics } from "~/lib/analytics";
import {
  REFERRAL_PRO_REWARD_DURATION_DAYS,
  isReferralCode,
  normalizeReferralCode,
} from "~/lib/referrals";
import { cn } from "~/lib/utils";

function formatDate(timestamp: number | null) {
  if (!timestamp) return "Not yet";
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCountdown(timeRemainingMs: number) {
  if (timeRemainingMs <= 0) return "Age check complete";

  const days = Math.ceil(timeRemainingMs / (24 * 60 * 60 * 1000));
  if (days >= 2) return `${days} days remaining`;
  if (days === 1) return "1 day remaining";

  const hours = Math.ceil(timeRemainingMs / (60 * 60 * 1000));
  return `${hours} hours remaining`;
}

function statusLabel(status: "pending" | "qualified" | "rejected") {
  if (status === "qualified") return "Qualified";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

function statusTone(status: "pending" | "qualified" | "rejected") {
  if (status === "qualified") {
    return "border-emerald-400 text-emerald-200";
  }

  if (status === "rejected") {
    return "border-red-400 text-red-200";
  }

  return "border-cyan-400 text-cyan-100";
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Radar;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="border border-white/12 bg-black/20 p-5">
      <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-4">
        <p className="text-[11px] tracking-[0.2em] text-slate-400 uppercase">
          {label}
        </p>
        <Icon className="h-4 w-4 text-cyan-200" />
      </div>
      <div className="mt-4 text-3xl font-semibold text-white">{value}</div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{hint}</p>
    </div>
  );
}

function ReferralClaimCard({
  claim,
}: {
  claim: {
    id: string;
    displayName: string;
    createdAt: number;
    status: "pending" | "qualified" | "rejected";
    qualifiedAt: number | null;
    totalFlights: number;
    flightsRemaining: number;
    timeRemainingMs: number;
  };
}) {
  return (
    <div className="border border-white/10 bg-black/15 p-5">
      <div className="flex flex-col gap-4 border-b border-white/8 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-lg font-semibold text-white">{claim.displayName}</p>
          <p className="mt-1 text-sm text-slate-400">
            Joined {formatDate(claim.createdAt)}
          </p>
        </div>

        <div
          className={cn(
            "w-fit border-l-2 pl-3 text-xs font-medium tracking-[0.18em] uppercase",
            statusTone(claim.status),
          )}
        >
          {statusLabel(claim.status)}
        </div>
      </div>

      <div className="mt-5 grid gap-0 border border-white/8 md:grid-cols-3">
        <div className="border-b border-white/8 p-4 md:border-r md:border-b-0">
          <p className="text-[11px] tracking-[0.16em] text-slate-500 uppercase">
            Flights Logged
          </p>
          <p className="mt-2 text-xl font-semibold text-white">
            {claim.totalFlights}
          </p>
        </div>

        <div className="border-b border-white/8 p-4 md:border-r md:border-b-0">
          <p className="text-[11px] tracking-[0.16em] text-slate-500 uppercase">
            Flights Needed
          </p>
          <p className="mt-2 text-xl font-semibold text-white">
            {claim.status === "qualified" ? "0" : claim.flightsRemaining}
          </p>
        </div>

        <div className="p-4">
          <p className="text-[11px] tracking-[0.16em] text-slate-500 uppercase">
            Timing
          </p>
          <p className="mt-2 text-sm font-medium text-white">
            {claim.status === "qualified"
              ? `Qualified ${formatDate(claim.qualifiedAt)}`
              : formatCountdown(claim.timeRemainingMs)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ReferralPageContent() {
  const { isSignedIn, isLoaded, user } = useUser();
  const searchParams = useSearchParams();
  const ensureReferralCode = useMutation(api.referrals.getOrCreateMyCode);
  const [copiedState, setCopiedState] = useState<"code" | "link" | null>(null);
  const [origin, setOrigin] = useState("");
  const ensureRequestedRef = useRef(false);
  const trackedViewRef = useRef<string | null>(null);

  const rawRefParam = searchParams.get("ref");
  const shareCode = normalizeReferralCode(rawRefParam);
  const hasRefParam = rawRefParam !== null;
  const hasValidShareCode = isReferralCode(shareCode);

  const overview = useQuery(api.referrals.getMyOverview, isSignedIn ? {} : "skip");
  const publicSummary = useQuery(
    api.referrals.getPublicCodeSummary,
    hasValidShareCode ? { code: shareCode } : "skip",
  );

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    const mode = isSignedIn ? "dashboard" : hasRefParam ? "landing" : "generic";
    const status =
      hasRefParam && !isSignedIn
        ? hasValidShareCode && publicSummary
          ? "valid"
          : "invalid"
        : undefined;
    const trackingKey = `${mode}:${status ?? "none"}`;

    if (trackedViewRef.current === trackingKey) return;
    if (hasRefParam && hasValidShareCode && !isSignedIn && publicSummary === undefined) {
      return;
    }

    trackedViewRef.current = trackingKey;
    Analytics.referralPageViewed({ mode, status });
  }, [hasRefParam, hasValidShareCode, isLoaded, isSignedIn, publicSummary]);

  useEffect(() => {
    if (!isSignedIn || overview === undefined || overview?.code || ensureRequestedRef.current) {
      return;
    }

    ensureRequestedRef.current = true;
    void ensureReferralCode({})
      .catch(() => {
        ensureRequestedRef.current = false;
        toast.error("Could not generate your referral code");
      });
  }, [ensureReferralCode, isSignedIn, overview]);

  if (
    !isLoaded ||
    (isSignedIn && (overview === undefined || overview === null)) ||
    (!isSignedIn && hasValidShareCode && publicSummary === undefined)
  ) {
    return <Loading />;
  }

  const referralCode = overview?.code ?? null;
  const shareLink =
    referralCode && origin ? `${origin}/referral?ref=${referralCode}` : "";
  const progressPercent = overview
    ? Math.min(100, (overview.qualifiedCount / overview.rewardThreshold) * 100)
    : 0;

  const copyValue = async (type: "code" | "link", value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedState(type);
    Analytics.referralShareCopied({ type });
    toast.success(type === "code" ? "Referral code copied" : "Referral link copied");
    window.setTimeout(() => setCopiedState(null), 2000);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030912] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.22) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />
        <div className="absolute top-[-220px] left-1/2 h-[560px] w-[560px] -translate-x-1/2 rotate-45 border border-cyan-400/10" />
        <div className="absolute top-20 -left-28 h-72 w-72 bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-140px] bottom-[-40px] h-80 w-80 bg-sky-500/10 blur-3xl" />
        <div className="absolute inset-x-0 top-24 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      </div>

      <header className="relative z-10 border-b border-white/6">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-4">
            <Image
              src="/logo-white.svg"
              alt="RadarThing"
              width={130}
              height={36}
              priority
            />
            <div className="hidden h-6 w-px bg-white/10 md:block" />
            <span className="hidden font-mono text-[11px] tracking-[0.18em] text-slate-400 uppercase md:block">
              Referral Program
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/radar"
              className="hidden border border-white/10 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white md:inline-flex"
            >
              Open Radar
            </Link>
            <UserAuth />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-12 md:py-16">
        {!isSignedIn && (
          <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="border border-cyan-400/20 bg-[#07131d]/85 p-8 shadow-[0_24px_80px_rgba(8,145,178,0.18)] backdrop-blur-xl md:p-10">
              <p className="text-[11px] tracking-[0.24em] text-cyan-200 uppercase">
                RadarThing Growth Deck
              </p>
              <h1 className="mt-5 max-w-xl text-4xl leading-tight font-semibold text-white md:text-5xl">
                {publicSummary
                  ? `Join ${publicSummary.referrerName} on RadarThing`
                  : "Invite pilots. Unlock PRO through the network you build."}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                {publicSummary
                  ? `This referral code is live. Create your account, stay active for ${publicSummary.minAccountAgeDays} days, and log ${publicSummary.minFlights} flights to count as a qualified referral.`
                  : "Every signed-in pilot can generate a five-letter referral code and track who joins from it. Once a code reaches 20 qualified pilots, that referrer gets one month of PRO access."}
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <MetricCard
                  icon={Ticket}
                  label="Referral Code"
                  value={publicSummary?.code ?? "5 LETTERS"}
                  hint="Random uppercase code, unique to each pilot"
                />
                <MetricCard
                  icon={ShieldCheck}
                  label="Qualification"
                  value={`${publicSummary?.minAccountAgeDays ?? 30}d + ${publicSummary?.minFlights ?? 3} flights`}
                  hint="Built to resist throwaway signups and farming"
                />
                <MetricCard
                  icon={Gift}
                  label="Reward"
                  value={`${REFERRAL_PRO_REWARD_DURATION_DAYS} days PRO`}
                  hint="Triggered once at 20 qualified pilots"
                />
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <SignInButton mode="modal">
                  <Button className="h-12 cursor-pointer rounded-none bg-cyan-400 px-6 text-sm font-semibold text-black transition-colors hover:bg-cyan-300">
                    {publicSummary ? "Join with Google" : "Sign in to get your code"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </SignInButton>
                <Link
                  href="/pricing"
                  className="inline-flex h-12 items-center justify-center border border-white/12 px-6 text-sm font-medium text-white transition-colors hover:border-white/20 hover:bg-white/5"
                >
                  See PRO benefits
                </Link>
              </div>

              {hasRefParam && !publicSummary && (
                <div className="mt-6 border-l-2 border-amber-400 bg-amber-400/10 p-4 text-sm text-amber-100">
                  This referral code is invalid or unavailable. You can still
                  sign in and generate your own referral code.
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div className="border border-white/10 bg-black/20 p-7">
                <p className="text-[11px] tracking-[0.22em] text-slate-500 uppercase">
                  How This Works
                </p>
                <div className="mt-5 divide-y divide-white/8 border-y border-white/8">
                  <div className="py-4">
                    <p className="text-sm font-semibold text-white">
                      1. A pilot shares their five-letter code
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Share links point here, so the referral code is stored
                      before sign-up and attached to the first RadarThing
                      account creation.
                    </p>
                  </div>
                  <div className="py-4">
                    <p className="text-sm font-semibold text-white">
                      2. New signups appear instantly as pending referrals
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      The referrer sees each signup right away, even before it
                      has matured into a qualified referral.
                    </p>
                  </div>
                  <div className="py-4">
                    <p className="text-sm font-semibold text-white">
                      3. Qualification requires real usage
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      A signup counts only after the account is at least 30 days
                      old and has logged at least 3 flights.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-cyan-400/15 bg-[#07131d]/80 p-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center border border-cyan-400/20 bg-cyan-400/10">
                    <Users className="h-5 w-5 text-cyan-200" />
                  </div>
                  <div>
                    <p className="text-[11px] tracking-[0.22em] text-cyan-200 uppercase">
                      Milestone
                    </p>
                    <p className="mt-1 text-xl font-semibold text-white">
                      20 qualified referrals unlock one month of PRO
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  This is intentionally one-time. The program is meant to spark
                  organic growth, not become a recurring discount loophole.
                </p>
              </div>
            </div>
          </section>
        )}

        {isSignedIn && overview && (
          <section className="space-y-8">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="border border-cyan-400/20 bg-[#07131d]/88 p-8 shadow-[0_24px_80px_rgba(8,145,178,0.18)] backdrop-blur-xl md:p-10">
                <p className="text-[11px] tracking-[0.24em] text-cyan-200 uppercase">
                  Your Share Code
                </p>
                <h1 className="mt-5 text-4xl font-semibold text-white md:text-5xl">
                  Build a pilot network that pays for itself.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                  Every qualified pilot you bring in moves you toward a one-time
                  month of PRO. New signups show up immediately, then graduate
                  once they clear the activity rules.
                </p>

                <div className="mt-8 border border-white/10 bg-black/25 p-5">
                  <p className="text-[11px] tracking-[0.18em] text-slate-500 uppercase">
                    Referral Code
                  </p>
                  <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="font-mono text-4xl font-semibold tracking-[0.34em] text-cyan-200">
                      {referralCode ?? "....."}
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button
                        onClick={() => referralCode && void copyValue("code", referralCode)}
                        disabled={!referralCode}
                        variant="outline"
                        className="h-11 cursor-pointer rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10"
                      >
                        {copiedState === "code" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        Copy code
                      </Button>
                      <Button
                        onClick={() => shareLink && void copyValue("link", shareLink)}
                        disabled={!shareLink}
                        className="h-11 cursor-pointer rounded-none bg-cyan-400 text-black hover:bg-cyan-300"
                      >
                        {copiedState === "link" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        Copy link
                      </Button>
                    </div>
                  </div>
                  <p className="mt-4 break-all font-mono text-xs leading-6 text-slate-400">
                    {shareLink || "Generating your share link..."}
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="border border-white/10 bg-black/20 p-7">
                  <p className="text-[11px] tracking-[0.22em] text-slate-500 uppercase">
                    Progress to Reward
                  </p>
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div className="text-5xl font-semibold text-white">
                      {overview.qualifiedCount}
                    </div>
                    <div className="text-right text-sm text-slate-400">
                      <div>Qualified referrals</div>
                      <div>{overview.rewardThreshold} needed for reward</div>
                    </div>
                  </div>
                  <div className="mt-6 h-3 overflow-hidden border border-white/10 bg-white/8">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-cyan-200 transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                    <span>{overview.pendingCount} pending</span>
                    <span>{overview.rewardRemaining} remaining</span>
                  </div>
                  <div className="mt-5 border-l-2 border-cyan-400 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
                    {overview.rewardGrantedAt
                      ? `Reward granted on ${formatDate(overview.rewardGrantedAt)}.`
                      : `Hit ${overview.rewardThreshold} qualified pilots and you get ${REFERRAL_PRO_REWARD_DURATION_DAYS} days of PRO once.`}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <MetricCard
                    icon={Clock3}
                    label="Qualification"
                    value={`${overview.minAccountAgeDays} days`}
                    hint="Each signup must remain active for a month"
                  />
                  <MetricCard
                    icon={ShieldCheck}
                    label="Flight Gate"
                    value={`${overview.minFlights} flights`}
                    hint="Only actual pilots count toward the milestone"
                  />
                </div>
              </div>
            </div>

            <div className="border border-white/10 bg-[#060d15]/80 p-7">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[11px] tracking-[0.22em] text-slate-500 uppercase">
                    Referral Activity
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Who has signed up with your code
                  </h2>
                </div>
                <p className="text-sm text-slate-400">
                  Signed in as {user?.primaryEmailAddress?.emailAddress ?? "your account"}
                </p>
              </div>

              {overview.claims.length === 0 ? (
                <div className="mt-6 border border-dashed border-cyan-400/20 bg-cyan-400/[0.06] p-8 text-center">
                  <p className="text-lg font-medium text-white">
                    No one has used your code yet.
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    Share your link in the GeoFS community, Discord servers, or
                    anywhere pilots already look for flight tools.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {overview.claims.map((claim) => (
                    <ReferralClaimCard key={claim.id} claim={claim} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default function ReferralPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ReferralPageContent />
    </Suspense>
  );
}
