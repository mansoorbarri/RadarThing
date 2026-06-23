import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { isSystemSecretValid } from "./lib/auth";
import {
  countUniqueVisitedAirports,
  doesFlightCollectionMatchChallenge,
  doesFlightMatchChallenge,
  getChallengeScopedRules,
  getChallengeRules,
  getPerFlightChallengeRules,
  getFlightsInChallengeWindow,
  getRuleScope,
  isAggregateChallengeRule,
  isChallengeActiveAt,
  sumFlightDistancesNm,
  sumFlightDurationsMinutes,
  type ChallengeRule,
  type ChallengeRuleConfig,
  type ChallengeRuleType,
} from "./lib/challengeRules";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LEADERBOARD_ENTRY_LIMIT = 10;
const MAX_MANUAL_SUBMISSION_FLIGHTS = 25;
const ADMIN_MANUAL_REVIEW_STATUS_LIMIT = 100;
const SUPER_ADMIN_GOOGLE_ID = "101233162035372298523";

const challengeRuleValidator = v.object({
  ruleType: v.union(
    v.literal("visit_airport"),
    v.literal("visit_airport_count"),
    v.literal("depart_airport"),
    v.literal("arrive_airport"),
    v.literal("route"),
    v.literal("aircraft_type"),
    v.literal("flight_count"),
    v.literal("min_duration"),
    v.literal("min_distance"),
    v.literal("manual"),
  ),
  scope: v.optional(v.union(v.literal("challenge"), v.literal("each_flight"))),
  targetAirport: v.optional(v.string()),
  targetDepartureAirport: v.optional(v.string()),
  targetArrivalAirport: v.optional(v.string()),
  targetAircraftType: v.optional(v.string()),
  requiredAirportCount: v.optional(v.number()),
  requiredFlightCount: v.optional(v.number()),
  minDurationMinutes: v.optional(v.number()),
  minDistanceNm: v.optional(v.number()),
});

function normalizeAirportCode(value?: string) {
  const normalized = value?.trim().toUpperCase() ?? "";
  return normalized || undefined;
}

function normalizeAircraftType(value?: string) {
  const normalized = value?.trim().toUpperCase() ?? "";
  return normalized || undefined;
}

async function getViewer(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return { identity: null, user: null, isAdmin: false };
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user || user.isDeleted) {
    return { identity, user: null, isAdmin: false };
  }

  const isAdmin =
    user.role === "ADMIN" || user.googleId === SUPER_ADMIN_GOOGLE_ID;

  return { identity, user, isAdmin };
}

async function requireViewer(ctx: QueryCtx | MutationCtx) {
  const viewer = await getViewer(ctx);
  if (!viewer.user) {
    throw new Error("You must be signed in");
  }
  return viewer;
}

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const viewer = await requireViewer(ctx);
  if (!viewer.isAdmin) {
    throw new Error("You do not have permission to manage challenges");
  }
  return viewer;
}

async function requireAdminOrSystem(
  ctx: QueryCtx | MutationCtx,
  systemSecret?: string,
) {
  if (isSystemSecretValid(systemSecret)) {
    return null;
  }

  return await requireAdmin(ctx);
}

async function canReadAdminChallenges(ctx: QueryCtx) {
  try {
    await requireAdmin(ctx);
    return true;
  } catch {
    return false;
  }
}

function validateChallengeInput(args: {
  title: string;
  description: string;
  cadence: "weekly" | "monthly" | "custom";
  mode: "auto" | "manual";
  ruleType: ChallengeRuleType;
  rules?: ChallengeRuleConfig[];
  targetAirport?: string;
  targetDepartureAirport?: string;
  targetArrivalAirport?: string;
  targetAircraftType?: string;
  requiredAirportCount?: number;
  requiredFlightCount?: number;
  minDurationMinutes?: number;
  minDistanceNm?: number;
  startAt: number;
  durationDays?: number;
  isPublished?: boolean;
}) {
  const title = args.title.trim();
  const description = args.description.trim();

  if (title.length < 3 || title.length > 80) {
    throw new Error("Challenge title must be 3-80 characters");
  }

  if (description.length < 8 || description.length > 300) {
    throw new Error("Challenge description must be 8-300 characters");
  }

  if (!Number.isFinite(args.startAt)) {
    throw new Error("Challenge start time is invalid");
  }

  const durationDays =
    args.cadence === "weekly"
      ? 7
      : args.cadence === "monthly"
        ? 30
        : args.durationDays;

  if (
    typeof durationDays !== "number" ||
    !Number.isFinite(durationDays) ||
    durationDays <= 0
  ) {
    throw new Error("Custom challenges need a duration above 0 days");
  }

  function normalizeRule(rule: ChallengeRuleConfig) {
    return {
      ruleType: rule.ruleType,
      scope: rule.scope ?? "challenge",
      targetAirport: normalizeAirportCode(rule.targetAirport),
      targetDepartureAirport: normalizeAirportCode(rule.targetDepartureAirport),
      targetArrivalAirport: normalizeAirportCode(rule.targetArrivalAirport),
      targetAircraftType: normalizeAircraftType(rule.targetAircraftType),
      requiredAirportCount: rule.requiredAirportCount,
      requiredFlightCount: rule.requiredFlightCount,
      minDurationMinutes: rule.minDurationMinutes,
      minDistanceNm: rule.minDistanceNm,
    };
  }

  const rules =
    args.rules && args.rules.length > 0
      ? args.rules.map(normalizeRule)
      : [
          normalizeRule({
            ruleType: args.ruleType,
            targetAirport: args.targetAirport,
            targetDepartureAirport: args.targetDepartureAirport,
            targetArrivalAirport: args.targetArrivalAirport,
            targetAircraftType: args.targetAircraftType,
            requiredAirportCount: args.requiredAirportCount,
            requiredFlightCount: args.requiredFlightCount,
            minDurationMinutes: args.minDurationMinutes,
            minDistanceNm: args.minDistanceNm,
          }),
        ];

  if (rules.length === 0 || rules.length > 8) {
    throw new Error("Challenges need between 1 and 8 rules");
  }

  if (args.mode === "manual") {
    if (rules.length !== 1 || rules[0]?.ruleType !== "manual") {
      throw new Error("Manual challenges must use the manual rule type");
    }
  } else if (rules.some((rule) => rule.ruleType === "manual")) {
    throw new Error("Automatic challenges need concrete auto rules");
  }

  if (args.mode === "auto") {
    for (const rule of rules) {
      if (
        rule.scope === "each_flight" &&
        (rule.ruleType === "visit_airport_count" ||
          rule.ruleType === "flight_count")
      ) {
        throw new Error("Count rules must apply to the whole challenge");
      }

      if (
        ["visit_airport", "depart_airport", "arrive_airport"].includes(
          rule.ruleType,
        ) &&
        !rule.targetAirport
      ) {
        throw new Error("This challenge needs an airport code");
      }

      if (
        rule.ruleType === "route" &&
        (!rule.targetDepartureAirport || !rule.targetArrivalAirport)
      ) {
        throw new Error(
          "Route challenges need both departure and arrival airports",
        );
      }

      if (rule.ruleType === "aircraft_type" && !rule.targetAircraftType) {
        throw new Error("Aircraft challenges need an aircraft type");
      }

      if (
        rule.ruleType === "visit_airport_count" &&
        (!rule.requiredAirportCount || rule.requiredAirportCount <= 0)
      ) {
        throw new Error("Airport count challenges need a visit count above 0");
      }

      if (
        rule.ruleType === "flight_count" &&
        (!rule.requiredFlightCount || rule.requiredFlightCount <= 0)
      ) {
        throw new Error("Flight count challenges need a flight count above 0");
      }

      if (
        rule.ruleType === "min_duration" &&
        (!rule.minDurationMinutes || rule.minDurationMinutes <= 0)
      ) {
        throw new Error("Minimum duration challenges need a duration above 0");
      }

      if (
        rule.ruleType === "min_distance" &&
        (!rule.minDistanceNm || rule.minDistanceNm <= 0)
      ) {
        throw new Error("Minimum distance challenges need a distance above 0");
      }
    }
  }

  const primaryRule = rules[0];
  if (!primaryRule) {
    throw new Error("Challenges need at least one rule");
  }

  return {
    title,
    description,
    cadence: args.cadence,
    mode: args.mode,
    ruleType: primaryRule.ruleType,
    targetAirport: primaryRule.targetAirport,
    targetDepartureAirport: primaryRule.targetDepartureAirport,
    targetArrivalAirport: primaryRule.targetArrivalAirport,
    targetAircraftType: primaryRule.targetAircraftType,
    requiredAirportCount: primaryRule.requiredAirportCount,
    requiredFlightCount: primaryRule.requiredFlightCount,
    minDurationMinutes: primaryRule.minDurationMinutes,
    minDistanceNm: primaryRule.minDistanceNm,
    rules,
    durationDays,
    startAt: args.startAt,
    endAt: args.startAt + durationDays * DAY_MS,
    isPublished: args.isPublished ?? true,
  };
}

function serializeChallenge(challenge: {
  _id: Id<"challenges">;
  title: string;
  description: string;
  cadence: "weekly" | "monthly" | "custom";
  mode: "auto" | "manual";
  ruleType: ChallengeRuleType;
  targetAirport?: string;
  targetDepartureAirport?: string;
  targetArrivalAirport?: string;
  targetAircraftType?: string;
  requiredAirportCount?: number;
  requiredFlightCount?: number;
  minDurationMinutes?: number;
  minDistanceNm?: number;
  rules?: ChallengeRuleConfig[];
  durationDays?: number;
  startAt: number;
  endAt: number;
  isPublished: boolean;
  createdBy: string;
  updatedAt: number;
}) {
  return {
    id: challenge._id,
    title: challenge.title,
    description: challenge.description,
    cadence: challenge.cadence,
    mode: challenge.mode,
    ruleType: challenge.ruleType,
    targetAirport: challenge.targetAirport ?? null,
    targetDepartureAirport: challenge.targetDepartureAirport ?? null,
    targetArrivalAirport: challenge.targetArrivalAirport ?? null,
    targetAircraftType: challenge.targetAircraftType ?? null,
    requiredAirportCount: challenge.requiredAirportCount ?? null,
    requiredFlightCount: challenge.requiredFlightCount ?? null,
    minDurationMinutes: challenge.minDurationMinutes ?? null,
    minDistanceNm: challenge.minDistanceNm ?? null,
    rules: getChallengeRules(challenge).map((rule) => ({
      ruleType: rule.ruleType,
      scope: getRuleScope(rule),
      targetAirport: rule.targetAirport ?? null,
      targetDepartureAirport: rule.targetDepartureAirport ?? null,
      targetArrivalAirport: rule.targetArrivalAirport ?? null,
      targetAircraftType: rule.targetAircraftType ?? null,
      requiredAirportCount: rule.requiredAirportCount ?? null,
      requiredFlightCount: rule.requiredFlightCount ?? null,
      minDurationMinutes: rule.minDurationMinutes ?? null,
      minDistanceNm: rule.minDistanceNm ?? null,
    })),
    durationDays:
      challenge.durationDays ??
      Math.max(1, Math.round((challenge.endAt - challenge.startAt) / DAY_MS)),
    startAt: challenge.startAt,
    endAt: challenge.endAt,
    isPublished: challenge.isPublished,
    createdBy: challenge.createdBy,
    updatedAt: challenge.updatedAt,
  };
}

async function getPublishedChallenges(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("challenges")
    .withIndex("by_isPublished", (q) => q.eq("isPublished", true))
    .collect();
}

async function getActiveChallenges(ctx: QueryCtx | MutationCtx, now: number) {
  return (await getPublishedChallenges(ctx)).filter((challenge) =>
    isChallengeActiveAt(challenge, now),
  );
}

async function getActiveAutoChallenges(
  ctx: QueryCtx | MutationCtx,
  now: number,
) {
  return (await getActiveChallenges(ctx, now)).filter(
    (challenge) => challenge.mode === "auto",
  );
}

function aggregateManualChallengeCompletions(
  completions: {
    _id: Id<"challengeCompletions">;
    challengeId: Id<"challenges">;
    userId: Id<"users">;
    status: "pending" | "completed" | "rejected";
    completedAt?: number;
    submissionNote?: string;
    createdAt: number;
    updatedAt: number;
  }[],
) {
  if (completions.length === 0) return null;

  const sorted = [...completions].sort((a, b) => b.updatedAt - a.updatedAt);
  const latest = sorted[0];
  if (!latest) return null;
  const hasPending = sorted.some((completion) => completion.status === "pending");
  const latestCompleted = sorted.find(
    (completion) => completion.status === "completed",
  );
  const status: "pending" | "completed" | "rejected" = hasPending
    ? "pending"
    : latestCompleted
      ? "completed"
      : "rejected";

  return {
    id: latest._id,
    status,
    completedAt: latestCompleted?.completedAt,
    submissionNote: latest.submissionNote,
    canSubmitManual: !hasPending,
    approvedCount: sorted.filter((completion) => completion.status === "completed")
      .length,
    latestActivityAt: latest.updatedAt,
  };
}

async function clearChallengeLeaderboardEntries(
  ctx: MutationCtx,
  challengeId: Id<"challenges">,
) {
  const entries = await ctx.db
    .query("challengeLeaderboardEntries")
    .withIndex("by_challengeId", (q) => q.eq("challengeId", challengeId))
    .collect();

  for (const entry of entries) {
    await ctx.db.delete(entry._id);
  }
}

async function rebuildChallengeLeaderboardEntries(
  ctx: MutationCtx,
  challenge: Doc<"challenges">,
  now: number,
  options?: {
    requireActive?: boolean;
  },
) {
  await clearChallengeLeaderboardEntries(ctx, challenge._id);

  const requireActive = options?.requireActive ?? true;
  if (
    challenge.mode !== "auto" ||
    (requireActive && !isChallengeActiveAt(challenge, now))
  ) {
    return 0;
  }

  const [flights, completions] = await Promise.all([
    ctx.db
      .query("flights")
      .withIndex("by_startTime", (q) =>
        q.gte("startTime", challenge.startAt).lt("startTime", challenge.endAt),
      )
      .collect(),
    ctx.db
      .query("challengeCompletions")
      .withIndex("by_challengeId", (q) => q.eq("challengeId", challenge._id))
      .collect(),
  ]);

  const flightsByUserId = new Map<Id<"users">, typeof flights>();
  for (const flight of flights) {
    const userFlights = flightsByUserId.get(flight.userId) ?? [];
    userFlights.push(flight);
    flightsByUserId.set(flight.userId, userFlights);
  }

  const completionByUserId = new Map(
    completions.map((completion) => [completion.userId, completion]),
  );
  const userIds = new Set<Id<"users">>([
    ...flightsByUserId.keys(),
    ...completionByUserId.keys(),
  ]);

  let rebuiltEntries = 0;

  for (const userId of userIds) {
    const userFlights = flightsByUserId.get(userId) ?? [];
    const completion = completionByUserId.get(userId);
    const progress = getAutoProgress(challenge, userFlights);
    const isComplete =
      completion?.status === "completed" || progress.isComplete;
    const progressCurrent =
      isComplete && progress.progressCurrent === 0
        ? 1
        : progress.progressCurrent;
    const progressTarget = Math.max(1, progress.progressTarget);
    const shouldKeep = isComplete || progressCurrent > 0;

    if (!shouldKeep) continue;

    await ctx.db.insert("challengeLeaderboardEntries", {
      challengeId: challenge._id,
      userId,
      progressCurrent,
      progressTarget,
      progressLabel: isComplete ? "Completed" : progress.progressLabel,
      isComplete,
      status: isComplete ? "completed" : "in_progress",
      completedAt: completion?.completedAt,
      updatedAt: now,
    });
    rebuiltEntries += 1;
  }

  return rebuiltEntries;
}

async function backfillAutoChallengeCompletions(
  ctx: MutationCtx,
  challenge: Doc<"challenges">,
  now: number,
) {
  if (challenge.mode !== "auto") {
    return {
      insertedCompletions: 0,
      leaderboardEntries: 0,
      completionCount: 0,
      matchedUsers: 0,
      flightsInWindow: 0,
    };
  }

  const [flights, existingCompletions] = await Promise.all([
    ctx.db
      .query("flights")
      .withIndex("by_startTime", (q) =>
        q.gte("startTime", challenge.startAt).lt("startTime", challenge.endAt),
      )
      .collect(),
    ctx.db
      .query("challengeCompletions")
      .withIndex("by_challengeId", (q) => q.eq("challengeId", challenge._id))
      .collect(),
  ]);

  const existingCompletionUserIds = new Set(
    existingCompletions.map((completion) => completion.userId),
  );
  const flightsByUserId = new Map<Id<"users">, typeof flights>();
  for (const flight of flights) {
    const userFlights = flightsByUserId.get(flight.userId) ?? [];
    userFlights.push(flight);
    flightsByUserId.set(flight.userId, userFlights);
  }

  let insertedCompletions = 0;
  let matchedUsers = 0;

  for (const [userId, userFlights] of flightsByUserId.entries()) {
    if (!doesFlightCollectionMatchChallenge(challenge, userFlights)) {
      continue;
    }

    matchedUsers += 1;
    if (existingCompletionUserIds.has(userId)) {
      continue;
    }

    const supportingFlightId = findSupportingFlightId(challenge, userFlights);
    if (!supportingFlightId) {
      continue;
    }

    const inserted = await insertAutoCompletionIfMissing(ctx, {
      challengeId: challenge._id,
      userId,
      flightId: supportingFlightId,
      now,
    });
    if (!inserted) {
      continue;
    }

    existingCompletionUserIds.add(userId);
    insertedCompletions += 1;
  }

  const leaderboardEntries = await rebuildChallengeLeaderboardEntries(
    ctx,
    challenge,
    now,
    { requireActive: false },
  );
  const finalCompletions = await ctx.db
    .query("challengeCompletions")
    .withIndex("by_challengeId", (q) => q.eq("challengeId", challenge._id))
    .collect();

  return {
    insertedCompletions,
    leaderboardEntries,
    completionCount: finalCompletions.length,
    matchedUsers,
    flightsInWindow: flights.length,
  };
}

async function syncAutoLeaderboardEntriesForUser(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    challenges: Awaited<ReturnType<typeof getActiveAutoChallenges>>;
    flights: {
      aircraftType: string;
      depICAO?: string;
      arrICAO?: string;
      startTime: number;
      endTime?: number;
      routeData?: unknown;
    }[];
    completions: {
      challengeId: Id<"challenges">;
      status: "pending" | "completed" | "rejected";
      completedAt?: number;
    }[];
    now: number;
  },
) {
  if (args.challenges.length === 0) return 0;

  const existingEntries = await ctx.db
    .query("challengeLeaderboardEntries")
    .withIndex("by_userId", (q) => q.eq("userId", args.userId))
    .collect();

  const existingEntryByChallengeId = new Map(
    existingEntries.map((entry) => [entry.challengeId, entry]),
  );
  const completionByChallengeId = new Map(
    args.completions.map((completion) => [completion.challengeId, completion]),
  );

  let changedEntries = 0;

  for (const challenge of args.challenges) {
    const progress = getAutoProgress(challenge, args.flights);
    const completion = completionByChallengeId.get(challenge._id);
    const isComplete =
      completion?.status === "completed" || progress.isComplete;
    const progressCurrent =
      isComplete && progress.progressCurrent === 0
        ? 1
        : progress.progressCurrent;
    const progressTarget = Math.max(1, progress.progressTarget);
    const progressLabel = isComplete ? "Completed" : progress.progressLabel;
    const existingEntry = existingEntryByChallengeId.get(challenge._id);
    const shouldKeep = isComplete || progressCurrent > 0;

    if (!shouldKeep) {
      if (existingEntry) {
        await ctx.db.delete(existingEntry._id);
        changedEntries += 1;
      }
      continue;
    }

    const nextValues = {
      progressCurrent,
      progressTarget,
      progressLabel,
      isComplete,
      status: isComplete ? "completed" : "in_progress",
      completedAt: completion?.completedAt,
      updatedAt: args.now,
    } as const;

    if (existingEntry) {
      await ctx.db.patch(existingEntry._id, nextValues);
    } else {
      await ctx.db.insert("challengeLeaderboardEntries", {
        challengeId: challenge._id,
        userId: args.userId,
        ...nextValues,
      });
    }
    changedEntries += 1;
  }

  return changedEntries;
}

async function insertAutoCompletionIfMissing(
  ctx: MutationCtx,
  args: {
    challengeId: Id<"challenges">;
    userId: Id<"users">;
    flightId: Id<"flights">;
    now: number;
  },
) {
  const existing = await ctx.db
    .query("challengeCompletions")
    .withIndex("by_challengeId_userId", (q) =>
      q.eq("challengeId", args.challengeId).eq("userId", args.userId),
    )
    .first();

  if (existing) return false;

  await ctx.db.insert("challengeCompletions", {
    challengeId: args.challengeId,
    userId: args.userId,
    status: "completed",
    completedAt: args.now,
    flightId: args.flightId,
    createdAt: args.now,
    updatedAt: args.now,
  });

  return true;
}

function findSupportingFlightId(
  challenge: {
    ruleType: ChallengeRuleType;
    rules?: ChallengeRuleConfig[];
    startAt: number;
    endAt: number;
    targetAirport?: string;
    targetDepartureAirport?: string;
    targetArrivalAirport?: string;
    targetAircraftType?: string;
    requiredAirportCount?: number;
    requiredFlightCount?: number;
    minDurationMinutes?: number;
    minDistanceNm?: number;
    mode: "auto" | "manual";
    isPublished: boolean;
  },
  flights: {
    _id: Id<"flights">;
    aircraftType: string;
    depICAO?: string;
    arrICAO?: string;
    startTime: number;
    endTime?: number;
    routeData?: unknown;
  }[],
) {
  const flightsInWindow = getFlightsInChallengeWindow(challenge, flights).sort(
    (a, b) => b.startTime - a.startTime,
  );

  if (
    getChallengeRules(challenge).some((rule) =>
      isAggregateChallengeRule(rule.ruleType),
    )
  ) {
    return flightsInWindow[0]?._id ?? null;
  }

  return (
    flightsInWindow.find((flight) =>
      doesFlightMatchChallenge(challenge, {
        aircraftType: flight.aircraftType,
        depICAO: flight.depICAO,
        arrICAO: flight.arrICAO,
        startTime: flight.startTime,
        endTime: flight.endTime,
        routeData: flight.routeData,
      }),
    )?._id ?? null
  );
}

function getAutoProgress(
  challenge: {
    ruleType: ChallengeRuleType;
    rules?: ChallengeRuleConfig[];
    startAt: number;
    endAt: number;
    targetAirport?: string;
    targetDepartureAirport?: string;
    targetArrivalAirport?: string;
    targetAircraftType?: string;
    requiredAirportCount?: number;
    requiredFlightCount?: number;
    minDurationMinutes?: number;
    minDistanceNm?: number;
    mode: "auto" | "manual";
    isPublished: boolean;
  },
  flights: {
    aircraftType: string;
    depICAO?: string;
    arrICAO?: string;
    startTime: number;
    endTime?: number;
    routeData?: unknown;
  }[],
) {
  if (challenge.mode !== "auto") {
    return {
      progressCurrent: 0,
      progressTarget: 1,
      progressLabel: "Manual review",
      isComplete: false,
    };
  }

  const flightsInWindow = getFlightsInChallengeWindow(challenge, flights);
  const isComplete = doesFlightCollectionMatchChallenge(challenge, flights);
  const rules = getChallengeRules(challenge);
  const perFlightRules = getPerFlightChallengeRules(challenge);
  const flightsForProgress =
    perFlightRules.length > 0
      ? flightsInWindow.filter((flight) =>
          perFlightRules.every((rule) =>
            doesFlightMatchChallenge(
              { ...challenge, ...rule, rules: [rule] },
              flight,
            ),
          ),
        )
      : flightsInWindow;
  const challengeRules = getChallengeScopedRules(challenge);
  const progressRule =
    challengeRules.find((rule) => isAggregateChallengeRule(rule.ruleType)) ??
    (challengeRules.length === 1 ? challengeRules[0] : undefined);

  if (progressRule && isAggregateChallengeRule(progressRule.ruleType)) {
    switch (progressRule.ruleType) {
      case "visit_airport_count": {
        const current = countUniqueVisitedAirports(flightsForProgress);
        const target = progressRule.requiredAirportCount ?? 1;
        return {
          progressCurrent: Math.min(current, target),
          progressTarget: target,
          progressLabel: `${Math.min(current, target)} / ${target} airports`,
          isComplete,
        };
      }
      case "flight_count": {
        const target = progressRule.requiredFlightCount ?? 1;
        const current = flightsForProgress.length;
        return {
          progressCurrent: Math.min(current, target),
          progressTarget: target,
          progressLabel: `${Math.min(current, target)} / ${target} flights`,
          isComplete,
        };
      }
      case "min_duration": {
        const target = progressRule.minDurationMinutes ?? 1;
        const totalMinutes = sumFlightDurationsMinutes(flightsForProgress);
        return {
          progressCurrent: Math.min(Math.floor(totalMinutes), target),
          progressTarget: target,
          progressLabel: `${Math.min(Math.floor(totalMinutes), target)} / ${target} minutes`,
          isComplete,
        };
      }
      case "min_distance": {
        const target = progressRule.minDistanceNm ?? 1;
        const totalDistance = sumFlightDistancesNm(flightsForProgress);
        return {
          progressCurrent: Math.min(Math.floor(totalDistance), target),
          progressTarget: target,
          progressLabel: `${Math.min(Math.floor(totalDistance), target)} / ${target} nm`,
          isComplete,
        };
      }
    }
  }

  if (rules.length > 1) {
    const completedRules = rules.filter((rule) =>
      getRuleScope(rule) === "each_flight"
        ? flightsForProgress.length > 0
        : doesFlightCollectionMatchChallenge(
            {
              ...challenge,
              ...rule,
              rules: [rule],
            },
            flights,
          ),
    ).length;

    return {
      progressCurrent: completedRules,
      progressTarget: rules.length,
      progressLabel: `${completedRules} / ${rules.length} rules`,
      isComplete,
    };
  }

  switch (challenge.ruleType) {
    case "visit_airport_count": {
      const current = countUniqueVisitedAirports(flightsForProgress);
      const target = challenge.requiredAirportCount ?? 1;
      return {
        progressCurrent: Math.min(current, target),
        progressTarget: target,
        progressLabel: `${Math.min(current, target)} / ${target} airports`,
        isComplete,
      };
    }
    case "flight_count": {
      const target = challenge.requiredFlightCount ?? 1;
      const current = flightsForProgress.length;
      return {
        progressCurrent: Math.min(current, target),
        progressTarget: target,
        progressLabel: `${Math.min(current, target)} / ${target} flights`,
        isComplete,
      };
    }
    case "min_duration": {
      const target = challenge.minDurationMinutes ?? 1;
      const totalMinutes = sumFlightDurationsMinutes(flightsForProgress);
      return {
        progressCurrent: Math.min(Math.floor(totalMinutes), target),
        progressTarget: target,
        progressLabel: `${Math.min(Math.floor(totalMinutes), target)} / ${target} minutes`,
        isComplete,
      };
    }
    case "min_distance": {
      const target = challenge.minDistanceNm ?? 1;
      const totalDistance = sumFlightDistancesNm(flightsForProgress);
      return {
        progressCurrent: Math.min(Math.floor(totalDistance), target),
        progressTarget: target,
        progressLabel: `${Math.min(Math.floor(totalDistance), target)} / ${target} nm`,
        isComplete,
      };
    }
    default:
      return {
        progressCurrent: isComplete ? 1 : 0,
        progressTarget: 1,
        progressLabel: isComplete ? "Complete" : "Not complete yet",
        isComplete,
      };
  }
}

interface ChallengeLeaderboardEntryResult {
  userId: Id<"users">;
  displayName: string;
  callsign: string | null;
  progressCurrent: number;
  progressTarget: number;
  progressLabel: string;
  isComplete: boolean;
  completedAt: number | null;
  status: "completed" | "in_progress" | "pending" | "rejected";
}

interface ManualChallengeLeaderboardEntryResult extends ChallengeLeaderboardEntryResult {
  status: "completed" | "pending" | "rejected" | "in_progress";
  sortAt: number;
}

interface ChallengeLeaderboardResult {
  id: Id<"challenges">;
  title: string;
  description: string;
  cadence: "weekly" | "monthly" | "custom";
  mode: "auto" | "manual";
  ruleType:
    | "visit_airport"
    | "visit_airport_count"
    | "depart_airport"
    | "arrive_airport"
    | "route"
    | "aircraft_type"
    | "flight_count"
    | "min_duration"
    | "min_distance"
    | "manual";
  targetAirport: string | null;
  targetDepartureAirport: string | null;
  targetArrivalAirport: string | null;
  targetAircraftType: string | null;
  requiredAirportCount: number | null;
  requiredFlightCount: number | null;
  minDurationMinutes: number | null;
  minDistanceNm: number | null;
  durationDays: number;
  startAt: number;
  endAt: number;
  isPublished: boolean;
  createdBy: string;
  updatedAt: number;
  entries: ChallengeLeaderboardEntryResult[];
}

function compareTopProgressUsers(
  a: {
    displayName: string;
    progressCurrent: number;
    progressTarget: number;
    isComplete: boolean;
    completedAt: number | null;
  },
  b: {
    displayName: string;
    progressCurrent: number;
    progressTarget: number;
    isComplete: boolean;
    completedAt: number | null;
  },
) {
  if (a.isComplete !== b.isComplete) {
    return a.isComplete ? -1 : 1;
  }

  if (a.isComplete && b.isComplete) {
    const completedAtA = a.completedAt ?? Number.MAX_SAFE_INTEGER;
    const completedAtB = b.completedAt ?? Number.MAX_SAFE_INTEGER;
    if (completedAtA !== completedAtB) {
      return completedAtA - completedAtB;
    }
  }

  const ratioA = a.progressCurrent / Math.max(1, a.progressTarget);
  const ratioB = b.progressCurrent / Math.max(1, b.progressTarget);
  if (ratioA !== ratioB) {
    return ratioB - ratioA;
  }

  if (a.progressCurrent !== b.progressCurrent) {
    return b.progressCurrent - a.progressCurrent;
  }

  return a.displayName.localeCompare(b.displayName);
}

function getChallengePilotDisplayName(
  user:
    | {
        discordUsername?: string;
      }
    | undefined,
  userStats:
    | {
        lastFlightCallsign?: string;
      }
    | undefined,
  userId: Id<"users">,
) {
  return user?.discordUsername ?? userStats?.lastFlightCallsign ?? userId;
}

function compareManualLeaderboardEntries(
  a: {
    status: "pending" | "completed" | "rejected" | "in_progress";
    displayName: string;
    sortAt: number;
  },
  b: {
    status: "pending" | "completed" | "rejected" | "in_progress";
    displayName: string;
    sortAt: number;
  },
) {
  const statusRank = {
    completed: 0,
    pending: 1,
    rejected: 2,
    in_progress: 3,
  } as const;

  if (statusRank[a.status] !== statusRank[b.status]) {
    return statusRank[a.status] - statusRank[b.status];
  }

  if (a.sortAt !== b.sortAt) {
    return a.sortAt - b.sortAt;
  }

  return a.displayName.localeCompare(b.displayName);
}

function requiresCollectionMatching(challenge: ChallengeRule) {
  const rules = getChallengeRules(challenge);
  return (
    rules.length > 1 ||
    rules.some((rule) => isAggregateChallengeRule(rule.ruleType))
  );
}

export async function autoCompleteChallengesForFlight(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    flightId: Id<"flights">;
    aircraftType: string;
    depICAO?: string;
    arrICAO?: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    routeData?: unknown;
  },
) {
  const now = Date.now();
  const activeChallenges = await getActiveAutoChallenges(ctx, now);
  const collectionChallenges = activeChallenges.filter((challenge) =>
    requiresCollectionMatching(challenge),
  );
  const allFlights =
    collectionChallenges.length > 0
      ? await ctx.db
          .query("flights")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .collect()
      : [];

  let completedCount = 0;
  const completions: {
    challengeId: Id<"challenges">;
    status: "pending" | "completed" | "rejected";
    completedAt?: number;
  }[] = [];

  for (const challenge of activeChallenges) {
    const needsCollection = requiresCollectionMatching(challenge);
    const matches = needsCollection
      ? doesFlightCollectionMatchChallenge(challenge, allFlights)
      : doesFlightMatchChallenge(challenge, {
          aircraftType: args.aircraftType,
          depICAO: args.depICAO,
          arrICAO: args.arrICAO,
          startTime: args.startTime,
          endTime: args.endTime,
          duration: args.duration,
          routeData: args.routeData,
        });

    if (!matches) continue;

    const supportingFlightId =
      findSupportingFlightId(challenge, allFlights) ?? args.flightId;

    const inserted = await insertAutoCompletionIfMissing(ctx, {
      challengeId: challenge._id,
      userId: args.userId,
      flightId: supportingFlightId,
      now,
    });
    if (inserted) {
      completedCount += 1;
      completions.push({
        challengeId: challenge._id,
        status: "completed",
        completedAt: now,
      });
    }
  }

  const existingCompletions = await ctx.db
    .query("challengeCompletions")
    .withIndex("by_userId", (q) => q.eq("userId", args.userId))
    .collect();
  completions.push(...existingCompletions);

  await syncAutoLeaderboardEntriesForUser(ctx, {
    userId: args.userId,
    challenges: activeChallenges,
    flights: allFlights,
    completions,
    now,
  });

  return completedCount;
}

export const listActiveForViewer = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const viewer = await getViewer(ctx);
    const challenges = (await getPublishedChallenges(ctx))
      .filter((challenge) => isChallengeActiveAt(challenge, now))
      .sort((a, b) => a.endAt - b.endAt);

    const viewerUser = viewer.user;
    const flights = viewerUser
      ? await ctx.db
          .query("flights")
          .withIndex("by_userId", (q) => q.eq("userId", viewerUser._id))
          .collect()
      : [];
    const completions = viewerUser
      ? await ctx.db
          .query("challengeCompletions")
          .withIndex("by_userId", (q) => q.eq("userId", viewerUser._id))
          .collect()
      : [];
    const completionsByChallengeId = new Map<
      string,
      (typeof completions)[number][]
    >();

    for (const completion of completions) {
      const entries = completionsByChallengeId.get(completion.challengeId) ?? [];
      entries.push(completion);
      completionsByChallengeId.set(completion.challengeId, entries);
    }

    return challenges.map((challenge) => {
      const completion = aggregateManualChallengeCompletions(
        completionsByChallengeId.get(challenge._id) ?? [],
      );
      const autoProgress = getAutoProgress(challenge, flights);
      const computedStatus =
        challenge.mode === "auto" && autoProgress.isComplete
          ? "completed"
          : null;

      return {
        ...serializeChallenge(challenge),
        userCompletionId: completion?.id ?? null,
        userStatus: completion?.status ?? computedStatus,
        completedAt: completion?.completedAt ?? null,
        submissionNote: completion?.submissionNote ?? null,
        progressCurrent: autoProgress.progressCurrent,
        progressTarget: autoProgress.progressTarget,
        progressLabel: autoProgress.progressLabel,
        canSubmitManual:
          Boolean(viewer.user) &&
          challenge.mode === "manual" &&
          (completion?.canSubmitManual ?? true),
      };
    });
  },
});

export const listActiveForUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.isDeleted) return [];

    const now = Date.now();
    const challenges = (await getPublishedChallenges(ctx))
      .filter((challenge) => isChallengeActiveAt(challenge, now))
      .sort((a, b) => a.endAt - b.endAt);

    const [completions, flights] = await Promise.all([
      ctx.db
        .query("challengeCompletions")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect(),
      ctx.db
        .query("flights")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect(),
    ]);

    const completionsByChallengeId = new Map<
      string,
      (typeof completions)[number][]
    >();
    for (const completion of completions) {
      const entries = completionsByChallengeId.get(completion.challengeId) ?? [];
      entries.push(completion);
      completionsByChallengeId.set(completion.challengeId, entries);
    }

    return challenges.map((challenge) => {
      const completion = aggregateManualChallengeCompletions(
        completionsByChallengeId.get(challenge._id) ?? [],
      );
      const autoProgress = getAutoProgress(challenge, flights);
      const computedStatus =
        challenge.mode === "auto" && autoProgress.isComplete
          ? "completed"
          : null;

      return {
        ...serializeChallenge(challenge),
        userCompletionId: completion?.id ?? null,
        userStatus: completion?.status ?? computedStatus,
        completedAt: completion?.completedAt ?? null,
        submissionNote: completion?.submissionNote ?? null,
        progressCurrent: autoProgress.progressCurrent,
        progressTarget: autoProgress.progressTarget,
        progressLabel: autoProgress.progressLabel,
      };
    });
  },
});

export const listActiveLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const challenges = (await getActiveChallenges(ctx, now)).sort(
      (a, b) => a.endAt - b.endAt,
    );

    const [users, userStats] = await Promise.all([
      ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("isDeleted"), false))
        .collect(),
      ctx.db.query("userStats").collect(),
    ]);

    const usersById = new Map(users.map((user) => [user._id, user]));
    const userStatsByUserId = new Map(
      userStats.map((stats) => [stats.userId, stats]),
    );

    const leaderboards: ChallengeLeaderboardResult[] = [];

    for (const challenge of challenges) {
      if (challenge.mode === "auto") {
        const [storedEntries, completions] = await Promise.all([
          ctx.db
            .query("challengeLeaderboardEntries")
            .withIndex("by_challengeId", (q) =>
              q.eq("challengeId", challenge._id),
            )
            .collect(),
          ctx.db
            .query("challengeCompletions")
            .withIndex("by_challengeId", (q) =>
              q.eq("challengeId", challenge._id),
            )
            .collect(),
        ]);

        const entryByUserId = new Map<
          Id<"users">,
          {
            userId: Id<"users">;
            progressCurrent: number;
            progressTarget: number;
            progressLabel: string;
            isComplete: boolean;
            completedAt: number | null;
            status: "completed" | "in_progress";
          }
        >();

        for (const entry of storedEntries) {
          entryByUserId.set(entry.userId, {
            userId: entry.userId,
            progressCurrent: entry.progressCurrent,
            progressTarget: entry.progressTarget,
            progressLabel: entry.progressLabel,
            isComplete: entry.isComplete,
            completedAt: entry.completedAt ?? null,
            status: entry.status,
          });
        }

        for (const completion of completions) {
          if (
            completion.status !== "completed" ||
            entryByUserId.has(completion.userId)
          ) {
            continue;
          }

          entryByUserId.set(completion.userId, {
            userId: completion.userId,
            progressCurrent: 1,
            progressTarget: 1,
            progressLabel: "Completed",
            isComplete: true,
            completedAt: completion.completedAt ?? null,
            status: "completed",
          });
        }

        const entries: ChallengeLeaderboardEntryResult[] = [
          ...entryByUserId.values(),
        ]
          .flatMap((entry) => {
            const user = usersById.get(entry.userId);
            if (!user || (!entry.isComplete && entry.progressCurrent <= 0)) {
              return [];
            }

            const stats = userStatsByUserId.get(entry.userId);
            return [
              {
                userId: entry.userId,
                displayName: getChallengePilotDisplayName(
                  user,
                  stats,
                  entry.userId,
                ),
                callsign: stats?.lastFlightCallsign ?? null,
                progressCurrent: entry.progressCurrent,
                progressTarget: entry.progressTarget,
                progressLabel: entry.progressLabel,
                isComplete: entry.isComplete,
                completedAt: entry.completedAt,
                status: entry.status,
              } satisfies ChallengeLeaderboardEntryResult,
            ];
          })
          .sort(compareTopProgressUsers);

        leaderboards.push({
          ...serializeChallenge(challenge),
          entries: entries.slice(0, DEFAULT_LEADERBOARD_ENTRY_LIMIT),
        });
        continue;
      }

      const completions = await ctx.db
        .query("challengeCompletions")
        .withIndex("by_challengeId", (q) => q.eq("challengeId", challenge._id))
        .collect();

      const completionsByUserId = new Map<Id<"users">, typeof completions>();
      for (const completion of completions) {
        const entries = completionsByUserId.get(completion.userId) ?? [];
        entries.push(completion);
        completionsByUserId.set(completion.userId, entries);
      }

      const entries: ChallengeLeaderboardEntryResult[] = [...completionsByUserId]
        .flatMap(([userId, userCompletions]) => {
          const user = usersById.get(userId);
          if (!user) return [];

          const aggregate = aggregateManualChallengeCompletions(userCompletions);
          if (!aggregate) return [];

          const stats = userStatsByUserId.get(userId);
          return [
            {
              userId,
              displayName: getChallengePilotDisplayName(user, stats, userId),
              callsign: stats?.lastFlightCallsign ?? null,
              progressCurrent: aggregate.approvedCount > 0 ? aggregate.approvedCount : 0,
              progressTarget: 1,
              progressLabel:
                aggregate.status === "completed"
                  ? aggregate.approvedCount > 1
                    ? `${aggregate.approvedCount} approved`
                    : "Approved"
                  : aggregate.status === "pending"
                    ? "Pending review"
                    : "Needs resubmission",
              isComplete: aggregate.approvedCount > 0,
              completedAt: aggregate.completedAt ?? null,
              status: aggregate.status,
              sortAt: aggregate.completedAt ?? aggregate.latestActivityAt,
            } satisfies ManualChallengeLeaderboardEntryResult,
          ];
        })
        .sort(compareManualLeaderboardEntries)
        .map(({ sortAt, ...entry }) => entry);

      leaderboards.push({
        ...serializeChallenge(challenge),
        entries: entries.slice(0, DEFAULT_LEADERBOARD_ENTRY_LIMIT),
      });
    }

    return leaderboards;
  },
});

export const listAdmin = query({
  args: {},
  handler: async (ctx) => {
    if (!(await canReadAdminChallenges(ctx))) {
      return [];
    }

    const [challenges, completions, leaderboardEntries, users] =
      await Promise.all([
        ctx.db.query("challenges").collect(),
        ctx.db.query("challengeCompletions").collect(),
        ctx.db.query("challengeLeaderboardEntries").collect(),
        ctx.db
          .query("users")
          .filter((q) => q.eq(q.field("isDeleted"), false))
          .collect(),
      ]);
    const usersById = new Map(users.map((user) => [user._id, user]));

    const completionCounts = new Map<
      string,
      { pending: number; completed: number; rejected: number }
    >();
    const completedUserIdsByChallenge = new Map<
      Id<"challenges">,
      Set<Id<"users">>
    >();
    const completedMetadataByChallenge = new Map<
      Id<"challenges">,
      Map<Id<"users">, number | null>
    >();
    const leaderboardEntriesByChallenge = new Map<
      Id<"challenges">,
      typeof leaderboardEntries
    >();
    const completedLeaderboardUserIdsByChallenge = new Map<
      Id<"challenges">,
      Set<Id<"users">>
    >();

    for (const completion of completions) {
      const current = completionCounts.get(completion.challengeId) ?? {
        pending: 0,
        completed: 0,
        rejected: 0,
      };
      current[completion.status] += 1;
      completionCounts.set(completion.challengeId, current);

      if (completion.status === "completed") {
        const users =
          completedUserIdsByChallenge.get(completion.challengeId) ??
          new Set<Id<"users">>();
        users.add(completion.userId);
        completedUserIdsByChallenge.set(completion.challengeId, users);

        const completedMetadata =
          completedMetadataByChallenge.get(completion.challengeId) ??
          new Map<Id<"users">, number | null>();
        completedMetadata.set(
          completion.userId,
          completion.completedAt ?? null,
        );
        completedMetadataByChallenge.set(
          completion.challengeId,
          completedMetadata,
        );
      }
    }

    for (const entry of leaderboardEntries) {
      const challengeEntries =
        leaderboardEntriesByChallenge.get(entry.challengeId) ?? [];
      challengeEntries.push(entry);
      leaderboardEntriesByChallenge.set(entry.challengeId, challengeEntries);

      if (!entry.isComplete) continue;

      const completedUsers =
        completedLeaderboardUserIdsByChallenge.get(entry.challengeId) ??
        new Set<Id<"users">>();
      completedUsers.add(entry.userId);
      completedLeaderboardUserIdsByChallenge.set(
        entry.challengeId,
        completedUsers,
      );
    }

    return challenges
      .sort((a, b) => b.startAt - a.startAt)
      .map((challenge) => {
        const counts = completionCounts.get(challenge._id) ?? {
          pending: 0,
          completed: 0,
          rejected: 0,
        };
        const completedUsers = new Set([
          ...(completedUserIdsByChallenge.get(challenge._id) ?? []),
          ...(completedLeaderboardUserIdsByChallenge.get(challenge._id) ?? []),
        ]);
        const completedUserDetails = [...completedUsers]
          .map((userId) => {
            const user = usersById.get(userId);
            return {
              userId,
              displayName: user?.discordUsername ?? userId,
              discordUsername: user?.discordUsername ?? null,
            };
          })
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
        const topProgressUsers =
          challenge.mode === "auto"
            ? (leaderboardEntriesByChallenge.get(challenge._id) ?? [])
                .map((entry) => {
                  const user = usersById.get(entry.userId);
                  return {
                    userId: entry.userId,
                    displayName: user?.discordUsername ?? entry.userId,
                    discordUsername: user?.discordUsername ?? null,
                    progressCurrent: entry.progressCurrent,
                    progressTarget: entry.progressTarget,
                    progressLabel: entry.progressLabel,
                    isComplete: entry.isComplete,
                    completedAt:
                      entry.completedAt ??
                      completedMetadataByChallenge
                        .get(challenge._id)
                        ?.get(entry.userId) ??
                      null,
                  };
                })
                .sort(compareTopProgressUsers)
                .slice(0, 3)
            : completedUserDetails
                .map((user) => ({
                  userId: user.userId,
                  displayName: user.displayName,
                  discordUsername: user.discordUsername,
                  progressCurrent: 1,
                  progressTarget: 1,
                  progressLabel: "Completed",
                  isComplete: true,
                  completedAt:
                    completedMetadataByChallenge
                      .get(challenge._id)
                      ?.get(user.userId) ?? null,
                }))
                .sort(compareTopProgressUsers)
                .slice(0, 3);

        return {
          ...serializeChallenge(challenge),
          counts: {
            ...counts,
            completed: completedUsers.size,
          },
          completedUsers: completedUserDetails,
          topProgressUsers,
        };
      });
  },
});

export const listPendingReviews = query({
  args: {},
  handler: async (ctx) => {
    if (!(await canReadAdminChallenges(ctx))) {
      return [];
    }

    const [pendingCompletions, completedCompletions, rejectedCompletions] =
      await Promise.all([
        ctx.db
          .query("challengeCompletions")
          .withIndex("by_status", (q) => q.eq("status", "pending"))
          .take(ADMIN_MANUAL_REVIEW_STATUS_LIMIT),
        ctx.db
          .query("challengeCompletions")
          .withIndex("by_status", (q) => q.eq("status", "completed"))
          .take(ADMIN_MANUAL_REVIEW_STATUS_LIMIT),
        ctx.db
          .query("challengeCompletions")
          .withIndex("by_status", (q) => q.eq("status", "rejected"))
          .take(ADMIN_MANUAL_REVIEW_STATUS_LIMIT),
      ]);
    const completions = [
      ...pendingCompletions,
      ...completedCompletions,
      ...rejectedCompletions,
    ];

    const results = [];

    for (const completion of completions) {
      const attachedFlightIds =
        completion.flightIds && completion.flightIds.length > 0
          ? completion.flightIds
          : completion.flightId
            ? [completion.flightId]
            : [];

      const [challenge, user, flights] = await Promise.all([
        ctx.db.get(completion.challengeId),
        ctx.db.get(completion.userId),
        Promise.all(attachedFlightIds.map((flightId) => ctx.db.get(flightId))),
      ]);

      if (challenge?.mode !== "manual" || user?.isDeleted !== false) {
        continue;
      }

      results.push({
        id: completion._id,
        challengeId: challenge._id,
        challengeTitle: challenge.title,
        challengeDescription: challenge.description,
        userId: user._id,
        userDisplay: user.discordUsername ?? user.email,
        userEmail: user.email,
        status: completion.status,
        submissionNote: completion.submissionNote ?? null,
        createdAt: completion.createdAt,
        reviewedAt: completion.reviewedAt ?? null,
        flights: flights
          .filter((flight): flight is NonNullable<typeof flight> => flight !== null)
          .map((flight) => ({
            id: flight._id,
            callsign: flight.callsign,
            aircraftType: flight.aircraftType,
            depICAO: flight.depICAO ?? null,
            arrICAO: flight.arrICAO ?? null,
            startTime: flight.startTime,
            endTime: flight.endTime ?? null,
          })),
      });
    }

    return results.sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return b.createdAt - a.createdAt;
    });
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    cadence: v.union(
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("custom"),
    ),
    mode: v.union(v.literal("auto"), v.literal("manual")),
    ruleType: v.union(
      v.literal("visit_airport"),
      v.literal("visit_airport_count"),
      v.literal("depart_airport"),
      v.literal("arrive_airport"),
      v.literal("route"),
      v.literal("aircraft_type"),
      v.literal("flight_count"),
      v.literal("min_duration"),
      v.literal("min_distance"),
      v.literal("manual"),
    ),
    rules: v.optional(v.array(challengeRuleValidator)),
    targetAirport: v.optional(v.string()),
    targetDepartureAirport: v.optional(v.string()),
    targetArrivalAirport: v.optional(v.string()),
    targetAircraftType: v.optional(v.string()),
    requiredAirportCount: v.optional(v.number()),
    requiredFlightCount: v.optional(v.number()),
    minDurationMinutes: v.optional(v.number()),
    minDistanceNm: v.optional(v.number()),
    startAt: v.number(),
    durationDays: v.optional(v.number()),
    isPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const viewer = await requireAdmin(ctx);
    const user = viewer.user;
    const values = validateChallengeInput(args);
    const now = Date.now();

    const id = await ctx.db.insert("challenges", {
      ...values,
      createdBy: user.clerkId,
      updatedAt: now,
    });

    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: {
    challengeId: v.id("challenges"),
    title: v.string(),
    description: v.string(),
    cadence: v.union(
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("custom"),
    ),
    mode: v.union(v.literal("auto"), v.literal("manual")),
    ruleType: v.union(
      v.literal("visit_airport"),
      v.literal("visit_airport_count"),
      v.literal("depart_airport"),
      v.literal("arrive_airport"),
      v.literal("route"),
      v.literal("aircraft_type"),
      v.literal("flight_count"),
      v.literal("min_duration"),
      v.literal("min_distance"),
      v.literal("manual"),
    ),
    rules: v.optional(v.array(challengeRuleValidator)),
    targetAirport: v.optional(v.string()),
    targetDepartureAirport: v.optional(v.string()),
    targetArrivalAirport: v.optional(v.string()),
    targetAircraftType: v.optional(v.string()),
    requiredAirportCount: v.optional(v.number()),
    requiredFlightCount: v.optional(v.number()),
    minDurationMinutes: v.optional(v.number()),
    minDistanceNm: v.optional(v.number()),
    startAt: v.number(),
    durationDays: v.optional(v.number()),
    isPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    const values = validateChallengeInput(args);

    const now = Date.now();

    await ctx.db.patch(args.challengeId, {
      ...values,
      updatedAt: now,
    });

    const updatedChallenge = await ctx.db.get(args.challengeId);
    if (!updatedChallenge) {
      throw new Error("Challenge not found");
    }

    await rebuildChallengeLeaderboardEntries(ctx, updatedChallenge, now);

    return updatedChallenge;
  },
});

export const togglePublished = mutation({
  args: {
    challengeId: v.id("challenges"),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new Error("Challenge not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.challengeId, {
      isPublished: args.isPublished,
      updatedAt: now,
    });

    const updatedChallenge = await ctx.db.get(args.challengeId);
    if (!updatedChallenge) {
      throw new Error("Challenge not found");
    }

    await rebuildChallengeLeaderboardEntries(ctx, updatedChallenge, now);
  },
});

export const remove = mutation({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const completions = await ctx.db
      .query("challengeCompletions")
      .withIndex("by_challengeId", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    for (const completion of completions) {
      await ctx.db.delete(completion._id);
    }

    await clearChallengeLeaderboardEntries(ctx, args.challengeId);
    await ctx.db.delete(args.challengeId);
  },
});

export const submitManualClaim = mutation({
  args: {
    challengeId: v.id("challenges"),
    submissionNote: v.optional(v.string()),
    flightId: v.optional(v.id("flights")),
    flightIds: v.optional(v.array(v.id("flights"))),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const user = viewer.user;
    const challenge = await ctx.db.get(args.challengeId);

    if (!challenge) {
      throw new Error("Challenge not found");
    }

    if (!challenge.isPublished || challenge.mode !== "manual") {
      throw new Error("This challenge does not accept manual submissions");
    }

    const now = Date.now();
    if (challenge.startAt > now || challenge.endAt <= now) {
      throw new Error("This challenge is not currently active");
    }

    const submissionNote = args.submissionNote?.trim() || undefined;
    if (submissionNote && submissionNote.length > 400) {
      throw new Error("Submission note must be 400 characters or fewer");
    }

    const requestedFlightCount =
      (args.flightIds?.length ?? 0) + (args.flightId ? 1 : 0);
    if (requestedFlightCount > MAX_MANUAL_SUBMISSION_FLIGHTS) {
      throw new Error(
        `You can attach up to ${MAX_MANUAL_SUBMISSION_FLIGHTS} flights per submission`,
      );
    }

    const normalizedFlightIds = Array.from(
      new Set([...(args.flightIds ?? []), ...(args.flightId ? [args.flightId] : [])]),
    );

    const existing = await ctx.db
      .query("challengeCompletions")
      .withIndex("by_challengeId_userId", (q) =>
        q.eq("challengeId", args.challengeId).eq("userId", user._id),
      )
      .collect();

    if (existing.some((completion) => completion.status === "pending")) {
      throw new Error("This challenge is already pending review");
    }

    for (const flightId of normalizedFlightIds) {
      const flight = await ctx.db.get(flightId);
      if (flight?.userId !== user._id) {
        throw new Error("You can only attach your own flights");
      }
    }

    return await ctx.db.insert("challengeCompletions", {
      challengeId: args.challengeId,
      userId: user._id,
      status: "pending",
      submissionNote,
      flightId: normalizedFlightIds[0],
      flightIds: normalizedFlightIds.length > 0 ? normalizedFlightIds : undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const withdrawManualClaim = mutation({
  args: {
    challengeId: v.id("challenges"),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const user = viewer.user;

    const completions = await ctx.db
      .query("challengeCompletions")
      .withIndex("by_challengeId_userId", (q) =>
        q.eq("challengeId", args.challengeId).eq("userId", user._id),
      )
      .collect();
    const pendingCompletions = completions.filter(
      (completion) => completion.status === "pending",
    );

    if (pendingCompletions.length === 0) {
      throw new Error("Submission not found");
    }

    for (const completion of pendingCompletions) {
      await ctx.db.delete(completion._id);
    }
    return { success: true, withdrawnCount: pendingCompletions.length };
  },
});

export const updateSubmissionStatus = mutation({
  args: {
    completionId: v.id("challengeCompletions"),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("rejected"),
    ),
  },
  handler: async (ctx, args) => {
    const viewer = await requireAdmin(ctx);
    const user = viewer.user;
    const completion = await ctx.db.get(args.completionId);

    if (!completion) {
      throw new Error("Submission not found");
    }

    const challenge = await ctx.db.get(completion.challengeId);
    if (challenge?.mode !== "manual") {
      throw new Error("Only manual challenge submissions can be reviewed");
    }

    if (args.status === "pending") {
      const existingPending = await ctx.db
        .query("challengeCompletions")
        .withIndex("by_challengeId_userId", (q) =>
          q
            .eq("challengeId", completion.challengeId)
            .eq("userId", completion.userId),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("status"), "pending"),
            q.neq(q.field("_id"), args.completionId),
          ),
        )
        .first();

      if (existingPending) {
        throw new Error(
          "This pilot already has a pending submission for this challenge",
        );
      }
    }

    const now = Date.now();
    await ctx.db.patch(args.completionId, {
      status: args.status,
      completedAt: args.status === "completed" ? now : undefined,
      reviewedBy: args.status === "pending" ? undefined : user.clerkId,
      reviewedAt: args.status === "pending" ? undefined : now,
      updatedAt: now,
    });
    return { success: true };
  },
});

export const recomputeAutoChallengeProgress = mutation({
  args: {
    challengeId: v.optional(v.id("challenges")),
    systemSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrSystem(ctx, args.systemSecret);

    const challenges = args.challengeId
      ? [await ctx.db.get(args.challengeId)]
      : await ctx.db.query("challenges").collect();
    const existingChallenges = challenges.filter(
      (challenge): challenge is Doc<"challenges"> => challenge !== null,
    );
    const now = Date.now();

    const results: {
      challengeId: Id<"challenges">;
      title: string;
      insertedCompletions: number;
      leaderboardEntries: number;
      completionCount: number;
      matchedUsers: number;
      flightsInWindow: number;
    }[] = [];

    for (const challenge of existingChallenges) {
      if (challenge.mode !== "auto") {
        continue;
      }
      const result = await backfillAutoChallengeCompletions(ctx, challenge, now);
      results.push({
        challengeId: challenge._id,
        title: challenge.title,
        ...result,
      });
    }

    return {
      challengeCount: results.length,
      insertedCompletions: results.reduce(
        (total, challenge) => total + challenge.insertedCompletions,
        0,
      ),
      leaderboardEntries: results.reduce(
        (total, challenge) => total + challenge.leaderboardEntries,
        0,
      ),
      results,
    };
  },
});

export const syncForCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const user = viewer.user;
    const now = Date.now();
    const activeChallenges = await getActiveAutoChallenges(ctx, now);

    if (activeChallenges.length === 0) return 0;

    const [flights, existingCompletions] = await Promise.all([
      ctx.db
        .query("flights")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("challengeCompletions")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
    ]);

    const completedChallengeIds = new Set(
      existingCompletions.map((completion) => completion.challengeId),
    );
    const leaderboardCompletions = existingCompletions.map((completion) => ({
      challengeId: completion.challengeId,
      status: completion.status,
      completedAt: completion.completedAt,
    }));
    let created = 0;

    const sortedFlights = [...flights].sort(
      (a, b) => b.startTime - a.startTime,
    );

    for (const challenge of activeChallenges) {
      if (completedChallengeIds.has(challenge._id)) continue;

      if (!doesFlightCollectionMatchChallenge(challenge, sortedFlights))
        continue;

      const supportingFlightId = findSupportingFlightId(
        challenge,
        sortedFlights,
      );
      if (!supportingFlightId) continue;

      await ctx.db.insert("challengeCompletions", {
        challengeId: challenge._id,
        userId: user._id,
        status: "completed",
        completedAt: now,
        flightId: supportingFlightId,
        createdAt: now,
        updatedAt: now,
      });
      leaderboardCompletions.push({
        challengeId: challenge._id,
        status: "completed",
        completedAt: now,
      });
      completedChallengeIds.add(challenge._id);
      created += 1;
    }

    await syncAutoLeaderboardEntriesForUser(ctx, {
      userId: user._id,
      challenges: activeChallenges,
      flights: sortedFlights,
      completions: leaderboardCompletions,
      now,
    });

    return created;
  },
});
