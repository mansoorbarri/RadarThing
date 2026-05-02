import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  countUniqueVisitedAirports,
  doesFlightCollectionMatchChallenge,
  doesFlightMatchChallenge,
  getFlightsInChallengeWindow,
  isAggregateChallengeRule,
  isChallengeActiveAt,
  sumFlightDistancesNm,
  sumFlightDurationsMinutes,
} from "./lib/challengeRules";

const DAY_MS = 24 * 60 * 60 * 1000;

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
    user.role === "ADMIN" ||
    Boolean(
      process.env.ADMIN_GOOGLE_ID &&
      user.googleId === process.env.ADMIN_GOOGLE_ID,
    );

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

function validateChallengeInput(args: {
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

  if (description.length < 8 || description.length > 400) {
    throw new Error("Challenge description must be 8-400 characters");
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

  const targetAirport = normalizeAirportCode(args.targetAirport);
  const targetDepartureAirport = normalizeAirportCode(
    args.targetDepartureAirport,
  );
  const targetArrivalAirport = normalizeAirportCode(args.targetArrivalAirport);
  const targetAircraftType = normalizeAircraftType(args.targetAircraftType);

  if (args.mode === "manual") {
    if (args.ruleType !== "manual") {
      throw new Error("Manual challenges must use the manual rule type");
    }
  } else if (args.ruleType === "manual") {
    throw new Error("Automatic challenges need a concrete auto rule");
  }

  if (args.mode === "auto") {
    if (
      ["visit_airport", "depart_airport", "arrive_airport"].includes(
        args.ruleType,
      ) &&
      !targetAirport
    ) {
      throw new Error("This challenge needs an airport code");
    }

    if (
      args.ruleType === "route" &&
      (!targetDepartureAirport || !targetArrivalAirport)
    ) {
      throw new Error(
        "Route challenges need both departure and arrival airports",
      );
    }

    if (args.ruleType === "aircraft_type" && !targetAircraftType) {
      throw new Error("Aircraft challenges need an aircraft type");
    }

    if (
      args.ruleType === "visit_airport_count" &&
      (!args.requiredAirportCount || args.requiredAirportCount <= 0)
    ) {
      throw new Error("Airport count challenges need a visit count above 0");
    }

    if (
      args.ruleType === "flight_count" &&
      (!args.requiredFlightCount || args.requiredFlightCount <= 0)
    ) {
      throw new Error("Flight count challenges need a flight count above 0");
    }

    if (
      args.ruleType === "min_duration" &&
      (!args.minDurationMinutes || args.minDurationMinutes <= 0)
    ) {
      throw new Error("Minimum duration challenges need a duration above 0");
    }

    if (
      args.ruleType === "min_distance" &&
      (!args.minDistanceNm || args.minDistanceNm <= 0)
    ) {
      throw new Error("Minimum distance challenges need a distance above 0");
    }
  }

  return {
    title,
    description,
    cadence: args.cadence,
    mode: args.mode,
    ruleType: args.ruleType,
    targetAirport,
    targetDepartureAirport,
    targetArrivalAirport,
    targetAircraftType,
    requiredAirportCount: args.requiredAirportCount,
    requiredFlightCount: args.requiredFlightCount,
    minDurationMinutes: args.minDurationMinutes,
    minDistanceNm: args.minDistanceNm,
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
  targetAirport?: string;
  targetDepartureAirport?: string;
  targetArrivalAirport?: string;
  targetAircraftType?: string;
  requiredAirportCount?: number;
  requiredFlightCount?: number;
  minDurationMinutes?: number;
  minDistanceNm?: number;
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

  if (isAggregateChallengeRule(challenge.ruleType)) {
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

  switch (challenge.ruleType) {
    case "visit_airport_count": {
      const current = countUniqueVisitedAirports(flightsInWindow);
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
      const current = flightsInWindow.length;
      return {
        progressCurrent: Math.min(current, target),
        progressTarget: target,
        progressLabel: `${Math.min(current, target)} / ${target} flights`,
        isComplete,
      };
    }
    case "min_duration": {
      const target = challenge.minDurationMinutes ?? 1;
      const totalMinutes = sumFlightDurationsMinutes(flightsInWindow);
      return {
        progressCurrent: Math.min(Math.floor(totalMinutes), target),
        progressTarget: target,
        progressLabel: `${Math.min(Math.floor(totalMinutes), target)} / ${target} minutes`,
        isComplete,
      };
    }
    case "min_distance": {
      const target = challenge.minDistanceNm ?? 1;
      const totalDistance = sumFlightDistancesNm(flightsInWindow);
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
    routeData?: unknown;
  },
) {
  const now = Date.now();
  const publishedChallenges = await getPublishedChallenges(ctx);
  const activeChallenges = publishedChallenges.filter((challenge) =>
    isChallengeActiveAt(challenge, now),
  );
  const aggregateChallenges = activeChallenges.filter((challenge) =>
    isAggregateChallengeRule(challenge.ruleType),
  );
  const allFlights =
    aggregateChallenges.length > 0
      ? await ctx.db
          .query("flights")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .collect()
      : [];

  let completedCount = 0;
  for (const challenge of activeChallenges) {
    const matches = isAggregateChallengeRule(challenge.ruleType)
      ? doesFlightCollectionMatchChallenge(challenge, allFlights)
      : doesFlightMatchChallenge(challenge, {
          aircraftType: args.aircraftType,
          depICAO: args.depICAO,
          arrICAO: args.arrICAO,
          startTime: args.startTime,
          endTime: args.endTime,
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
    if (inserted) completedCount += 1;
  }

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

    const completionByChallengeId = new Map<
      string,
      {
        id: Id<"challengeCompletions">;
        status: "pending" | "completed" | "rejected";
        completedAt?: number;
        submissionNote?: string;
      }
    >();
    const flights = viewer.user
      ? await ctx.db
          .query("flights")
          .withIndex("by_userId", (q) => q.eq("userId", viewer.user._id))
          .collect()
      : [];

    if (viewer.user) {
      const user = viewer.user;
      const completions = await ctx.db
        .query("challengeCompletions")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();

      for (const completion of completions) {
        completionByChallengeId.set(completion.challengeId, {
          id: completion._id,
          status: completion.status,
          completedAt: completion.completedAt,
          submissionNote: completion.submissionNote,
        });
      }
    }

    return challenges.map((challenge) => {
      const completion = completionByChallengeId.get(challenge._id);
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
          completion?.status !== "pending" &&
          completion?.status !== "completed",
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

    const completionByChallengeId = new Map(
      completions.map((completion) => [completion.challengeId, completion]),
    );

    return challenges.map((challenge) => {
      const completion = completionByChallengeId.get(challenge._id);
      const autoProgress = getAutoProgress(challenge, flights);
      const computedStatus =
        challenge.mode === "auto" && autoProgress.isComplete
          ? "completed"
          : null;

      return {
        ...serializeChallenge(challenge),
        userCompletionId: completion?._id ?? null,
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

export const listAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const challenges = await ctx.db.query("challenges").collect();
    const completions = await ctx.db.query("challengeCompletions").collect();
    const users = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();
    const usersById = new Map(users.map((user) => [user._id, user]));

    const completionCounts = new Map<
      string,
      { pending: number; completed: number; rejected: number }
    >();
    const completedUserIdsByChallenge = new Map<
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
      }
    }

    const now = Date.now();
    const computedCompletedUserIdsByChallenge = new Map<
      Id<"challenges">,
      Set<Id<"users">>
    >();

    for (const challenge of challenges) {
      if (challenge.mode !== "auto" || !isChallengeActiveAt(challenge, now)) {
        continue;
      }

      const flights = await ctx.db
        .query("flights")
        .withIndex("by_startTime", (q) =>
          q
            .gte("startTime", challenge.startAt)
            .lt("startTime", challenge.endAt),
        )
        .collect();

      const flightsByUser = new Map<Id<"users">, typeof flights>();
      for (const flight of flights) {
        const userFlights = flightsByUser.get(flight.userId) ?? [];
        userFlights.push(flight);
        flightsByUser.set(flight.userId, userFlights);
      }

      const completedUserIds = new Set<Id<"users">>();
      for (const [userId, userFlights] of flightsByUser.entries()) {
        if (doesFlightCollectionMatchChallenge(challenge, userFlights)) {
          completedUserIds.add(userId);
        }
      }
      computedCompletedUserIdsByChallenge.set(challenge._id, completedUserIds);
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
          ...(computedCompletedUserIdsByChallenge.get(challenge._id) ?? []),
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

        return {
          ...serializeChallenge(challenge),
          counts: {
            ...counts,
            completed: completedUsers.size,
          },
          completedUsers: completedUserDetails,
        };
      });
  },
});

export const listPendingReviews = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const pending = await ctx.db
      .query("challengeCompletions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const results = [];

    for (const completion of pending) {
      const [challenge, user, flight] = await Promise.all([
        ctx.db.get(completion.challengeId),
        ctx.db.get(completion.userId),
        completion.flightId
          ? ctx.db.get(completion.flightId)
          : Promise.resolve(null),
      ]);

      if (!challenge || !user || user.isDeleted) continue;

      results.push({
        id: completion._id,
        challengeId: challenge._id,
        challengeTitle: challenge.title,
        challengeDescription: challenge.description,
        userId: user._id,
        userDisplay: user.discordUsername ?? user.email,
        userEmail: user.email,
        submissionNote: completion.submissionNote ?? null,
        createdAt: completion.createdAt,
        flight: flight
          ? {
              id: flight._id,
              callsign: flight.callsign,
              aircraftType: flight.aircraftType,
              depICAO: flight.depICAO ?? null,
              arrICAO: flight.arrICAO ?? null,
              startTime: flight.startTime,
              endTime: flight.endTime ?? null,
            }
          : null,
      });
    }

    return results.sort((a, b) => a.createdAt - b.createdAt);
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

    await ctx.db.patch(args.challengeId, {
      ...values,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.challengeId);
  },
});

export const togglePublished = mutation({
  args: {
    challengeId: v.id("challenges"),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    await ctx.db.patch(args.challengeId, {
      isPublished: args.isPublished,
      updatedAt: Date.now(),
    });
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

    await ctx.db.delete(args.challengeId);
  },
});

export const submitManualClaim = mutation({
  args: {
    challengeId: v.id("challenges"),
    submissionNote: v.optional(v.string()),
    flightId: v.optional(v.id("flights")),
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

    const existing = await ctx.db
      .query("challengeCompletions")
      .withIndex("by_challengeId_userId", (q) =>
        q.eq("challengeId", args.challengeId).eq("userId", user._id),
      )
      .first();

    if (existing?.status === "pending") {
      throw new Error("This challenge is already pending review");
    }

    if (existing?.status === "completed") {
      throw new Error("You already completed this challenge");
    }

    if (args.flightId) {
      const flight = await ctx.db.get(args.flightId);
      if (!flight || flight.userId !== user._id) {
        throw new Error("You can only attach your own flight");
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "pending",
        submissionNote,
        flightId: args.flightId,
        reviewedBy: undefined,
        reviewedAt: undefined,
        completedAt: undefined,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("challengeCompletions", {
      challengeId: args.challengeId,
      userId: user._id,
      status: "pending",
      submissionNote,
      flightId: args.flightId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const reviewSubmission = mutation({
  args: {
    completionId: v.id("challengeCompletions"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
  },
  handler: async (ctx, args) => {
    const viewer = await requireAdmin(ctx);
    const user = viewer.user;
    const completion = await ctx.db.get(args.completionId);

    if (!completion) {
      throw new Error("Submission not found");
    }

    if (completion.status !== "pending") {
      throw new Error("This submission has already been reviewed");
    }

    const now = Date.now();
    await ctx.db.patch(args.completionId, {
      status: args.decision === "approve" ? "completed" : "rejected",
      completedAt: args.decision === "approve" ? now : undefined,
      reviewedBy: user.clerkId,
      reviewedAt: now,
      updatedAt: now,
    });
  },
});

export const syncForCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const user = viewer.user;
    const now = Date.now();
    const activeChallenges = (await getPublishedChallenges(ctx)).filter(
      (challenge) =>
        challenge.mode === "auto" && isChallengeActiveAt(challenge, now),
    );

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
      completedChallengeIds.add(challenge._id);
      created += 1;
    }

    return created;
  },
});
