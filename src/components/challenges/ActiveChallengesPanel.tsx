"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  Clock3,
  Flag,
  Loader2,
  Route,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { ChallengeLeaderboardTab } from "~/components/challenges/ChallengeLeaderboardTab";
import { getRuleSummary } from "~/components/challenges/ruleSummary";
import { Analytics } from "~/lib/analytics";

function formatWindow(startAt: number, endAt: number) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return `${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} - ${end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

interface SuggestedManualSubmission {
  matchedCount: number;
  totalCount: number;
  cappedAt: number;
  flights: {
    id: Id<"flights">;
    callsign: string;
    aircraftType: string;
    depICAO: string | null;
    arrICAO: string | null;
    startTime: number;
    endTime: number | null;
    scheduledMonth: number;
    scheduledDay: number;
  }[];
}

function getSuggestedManualSubmission(
  challenge: unknown,
): SuggestedManualSubmission | null {
  if (
    !challenge ||
    typeof challenge !== "object" ||
    !("suggestedManualSubmission" in challenge)
  ) {
    return null;
  }

  const suggestion = challenge.suggestedManualSubmission;
  if (!suggestion || typeof suggestion !== "object") return null;

  return suggestion as SuggestedManualSubmission;
}

export function ActiveChallengesPanel({
  userId,
}: {
  userId?: Id<"users"> | null;
}) {
  const [activeTab, setActiveTab] = useState<"challenges" | "leaderboard">(
    "challenges",
  );
  const { isSignedIn, isLoaded } = useUser();
  const viewerChallenges = useQuery(
    api.challenges.listActiveForViewer,
    userId ? "skip" : {},
  );
  const userChallenges = useQuery(
    api.challenges.listActiveForUser,
    userId ? { userId } : "skip",
  );
  const leaderboard = useQuery(
    api.challenges.listActiveLeaderboard,
    activeTab === "leaderboard" ? {} : "skip",
  );
  const challenges = userId ? userChallenges : viewerChallenges;
  const syncForCurrentUser = useMutation(api.challenges.syncForCurrentUser);
  const submitManualClaim = useMutation(api.challenges.submitManualClaim);
  const withdrawManualClaim = useMutation(api.challenges.withdrawManualClaim);
  const [noteByChallengeId, setNoteByChallengeId] = useState<
    Record<string, string>
  >({});
  const [submittingChallengeId, setSubmittingChallengeId] = useState<
    string | null
  >(null);
  const hasSyncedRef = useRef(false);
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (!isSignedIn || hasSyncedRef.current) return;
    hasSyncedRef.current = true;
    void syncForCurrentUser().catch(() => {
      hasSyncedRef.current = false;
    });
  }, [isSignedIn, syncForCurrentUser]);

  useEffect(() => {
    if (!challenges || hasTrackedRef.current || challenges.length === 0) return;
    hasTrackedRef.current = true;
    Analytics.track("challenge_panel_viewed", {
      challenge_count: challenges.length,
    });
  }, [challenges]);

  async function handleSubmit(challengeId: string) {
    const submissionNote = noteByChallengeId[challengeId]?.trim();
    setSubmittingChallengeId(challengeId);

    try {
      await submitManualClaim({
        challengeId: challengeId as Id<"challenges">,
        submissionNote: submissionNote || undefined,
      });
      Analytics.track("challenge_claim_submitted", {
        challenge_id: challengeId,
        has_note: Boolean(submissionNote),
      });
      toast.success("Challenge submitted for review");
      setNoteByChallengeId((current) => ({ ...current, [challengeId]: "" }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not submit challenge";
      toast.error(message);
    } finally {
      setSubmittingChallengeId(null);
    }
  }

  async function handleSubmitSuggestedFlights(
    challengeId: string,
    flightIds: Id<"flights">[],
  ) {
    if (flightIds.length === 0) {
      toast.error("No matching flights found to submit");
      return;
    }

    setSubmittingChallengeId(challengeId);

    try {
      await submitManualClaim({
        challengeId: challengeId as Id<"challenges">,
        flightIds,
        submissionNote:
          "Suggested submission: matching recorded flights for the atwi60 schedule.",
      });
      Analytics.track("challenge_claim_submitted", {
        challenge_id: challengeId,
        flight_ids: flightIds,
        flight_count: flightIds.length,
        has_note: true,
        source: "atwi60_suggestion",
      });
      toast.success(
        `${flightIds.length} suggested flight${flightIds.length === 1 ? "" : "s"} submitted for review`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not submit challenge";
      toast.error(message);
    } finally {
      setSubmittingChallengeId(null);
    }
  }

  async function handleWithdraw(challengeId: string) {
    setSubmittingChallengeId(challengeId);

    try {
      await withdrawManualClaim({
        challengeId: challengeId as Id<"challenges">,
      });
      toast.success("Submission withdrawn");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not withdraw submission";
      toast.error(message);
    } finally {
      setSubmittingChallengeId(null);
    }
  }

  if (!isLoaded && !userId) {
    return (
      <div className="mb-8 rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Flag className="h-4 w-4 text-cyan-400" />
          <h3 className="font-mono text-sm font-bold tracking-wider text-slate-400">
            ACTIVE CHALLENGES
          </h3>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading challenges...
        </div>
      </div>
    );
  }

  if (challenges === undefined) {
    return (
      <div className="mb-8 rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Flag className="h-4 w-4 text-cyan-400" />
          <h3 className="font-mono text-sm font-bold tracking-wider text-slate-400">
            ACTIVE CHALLENGES
          </h3>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading challenges...
        </div>
      </div>
    );
  }

  if (challenges.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-cyan-400" />
          <h3 className="font-mono text-sm font-bold tracking-wider text-slate-400">
            ACTIVE CHALLENGES
          </h3>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="grid w-full grid-cols-2 rounded-xl border border-white/10 bg-white/5 p-1 sm:flex sm:w-auto">
            <button
              onClick={() => setActiveTab("challenges")}
              className={`cursor-pointer rounded-lg px-3 py-2 font-mono text-[10px] tracking-wider uppercase transition-colors sm:px-3 sm:py-1.5 ${
                activeTab === "challenges"
                  ? "bg-white/10 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Challenges
            </button>
            <button
              onClick={() => {
                setActiveTab("leaderboard");
                Analytics.track("challenge_leaderboard_viewed", {
                  challenge_count: challenges.length,
                });
              }}
              className={`cursor-pointer rounded-lg px-3 py-2 font-mono text-[10px] tracking-wider uppercase transition-colors sm:px-3 sm:py-1.5 ${
                activeTab === "leaderboard"
                  ? "bg-white/10 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Leaderboard
            </button>
          </div>
        </div>
      </div>

      {activeTab === "leaderboard" ? (
        <ChallengeLeaderboardTab
          challenges={leaderboard}
          highlightedUserId={userId ?? null}
          isLoading={leaderboard === undefined}
          maxEntries={10}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {challenges.map((challenge) => {
            const status = challenge.userStatus;
            const isSubmitting = submittingChallengeId === challenge.id;
            const canShowProgress = isSignedIn && challenge.mode === "auto";
            const canSubmitManual =
              "canSubmitManual" in challenge
                ? challenge.canSubmitManual
                : false;
            const suggestedManualSubmission =
              getSuggestedManualSubmission(challenge);
            const suggestedFlightIds =
              suggestedManualSubmission?.flights.map((flight) => flight.id) ??
              [];
            const progressTarget = Math.max(1, challenge.progressTarget ?? 1);
            const progressCurrent = challenge.progressCurrent ?? 0;
            const progressPercent = Math.min(
              100,
              Math.round((progressCurrent / progressTarget) * 100),
            );

            return (
              <div
                key={challenge.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"
              >
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] tracking-wider text-slate-400 uppercase">
                        {challenge.cadence}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase ${
                          challenge.mode === "auto"
                            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border border-amber-500/30 bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        {challenge.mode === "auto" ? "auto" : "manual"}
                      </span>
                      {status === "completed" && (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] tracking-wider text-emerald-300 uppercase">
                          completed
                        </span>
                      )}
                      {status === "pending" && (
                        <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 font-mono text-[10px] tracking-wider text-yellow-300 uppercase">
                          pending review
                        </span>
                      )}
                      {status === "rejected" && (
                        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 font-mono text-[10px] tracking-wider text-red-300 uppercase">
                          needs resubmission
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg leading-tight font-semibold text-white">
                      {challenge.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>
                      {formatWindow(challenge.startAt, challenge.endAt)}
                    </span>
                  </div>
                </div>

                <p className="mb-3 text-sm text-slate-300">
                  {challenge.description}
                </p>
                <p className="mb-4 font-mono text-xs text-cyan-300">
                  {getRuleSummary(challenge)}
                </p>

                {challenge.mode === "auto" ? (
                  canShowProgress ? (
                    <div className="space-y-2">
                      <div className="flex items-center text-xs sm:hidden">
                        <span
                          className={
                            status === "completed"
                              ? "text-emerald-300"
                              : "text-slate-400"
                          }
                        >
                          {status === "completed" ? (
                            <span className="inline-flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Complete
                            </span>
                          ) : (
                            "In progress"
                          )}
                        </span>
                      </div>
                      <div className="hidden items-center justify-between text-xs sm:flex">
                        <span
                          className={
                            status === "completed"
                              ? "text-emerald-300"
                              : "text-slate-400"
                          }
                        >
                          {status === "completed" ? (
                            <span className="inline-flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Complete
                            </span>
                          ) : (
                            challenge.progressLabel
                          )}
                        </span>
                        <span className="font-mono text-slate-500">
                          {progressPercent}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full ${
                            status === "completed"
                              ? "bg-emerald-400"
                              : "bg-cyan-400"
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        status === "completed"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                          : "border-white/10 bg-black/30 text-slate-400"
                      }`}
                    >
                      {status === "completed" ? (
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Completed from your recorded flights.
                        </span>
                      ) : (
                        "This challenge is tracked automatically from your flight history."
                      )}
                    </div>
                  )
                ) : (
                  <div className="space-y-3">
                    {canSubmitManual ? (
                      <>
                        {suggestedManualSubmission &&
                          suggestedManualSubmission.matchedCount > 0 && (
                            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="flex items-center gap-2 font-mono text-[10px] tracking-wider text-cyan-200 uppercase">
                                    <Route className="h-3.5 w-3.5" />
                                    Suggested flights
                                  </p>
                                  <p className="mt-1 text-sm text-cyan-50">
                                    {suggestedManualSubmission.matchedCount} of{" "}
                                    {suggestedManualSubmission.totalCount}{" "}
                                    scheduled flights match your recorded
                                    history. The first{" "}
                                    {suggestedFlightIds.length} will be attached
                                    for review.
                                  </p>
                                </div>
                                <button
                                  onClick={() =>
                                    void handleSubmitSuggestedFlights(
                                      challenge.id,
                                      suggestedFlightIds,
                                    )
                                  }
                                  disabled={
                                    isSubmitting ||
                                    suggestedFlightIds.length === 0
                                  }
                                  className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isSubmitting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Send className="h-4 w-4" />
                                  )}
                                  Submit suggested
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {suggestedManualSubmission.flights
                                  .slice(0, 8)
                                  .map((flight) => (
                                    <span
                                      key={flight.id}
                                      className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[10px] tracking-wider text-cyan-100"
                                    >
                                      {flight.scheduledMonth}/
                                      {flight.scheduledDay}{" "}
                                      {flight.depICAO ?? "???"}-
                                      {flight.arrICAO ?? "???"}
                                    </span>
                                  ))}
                                {suggestedManualSubmission.flights.length >
                                  8 && (
                                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[10px] tracking-wider text-slate-300">
                                    +
                                    {suggestedManualSubmission.flights.length -
                                      8}{" "}
                                    more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        <textarea
                          value={noteByChallengeId[challenge.id] ?? ""}
                          onChange={(event) =>
                            setNoteByChallengeId((current) => ({
                              ...current,
                              [challenge.id]: event.target.value,
                            }))
                          }
                          rows={3}
                          placeholder="Optional note for admins. Describe what you did or link the relevant flight."
                          className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500/50"
                        />
                        <button
                          onClick={() => handleSubmit(challenge.id)}
                          disabled={isSubmitting}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Submit for review
                        </button>
                      </>
                    ) : (
                      <div
                        className={`rounded-xl border px-3 py-2 text-sm ${
                          status === "completed"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                            : status === "pending"
                              ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-100"
                              : "border-red-500/30 bg-red-500/10 text-red-200"
                        }`}
                      >
                        {status === "completed" &&
                          "Your submission was approved."}
                        {status === "pending" &&
                          "Your submission is waiting for admin review."}
                        {status === "rejected" &&
                          "You can update your note and resubmit this challenge."}
                      </div>
                    )}
                    {status === "pending" && (
                      <button
                        onClick={() => handleWithdraw(challenge.id)}
                        disabled={isSubmitting}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm font-medium text-yellow-100 transition-colors hover:bg-yellow-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Withdraw submission
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
