import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  REFERRAL_MIN_ACCOUNT_AGE_DAYS,
  REFERRAL_MIN_ACCOUNT_AGE_MS,
  REFERRAL_MIN_QUALIFYING_FLIGHTS,
  REFERRAL_PRO_REWARD_DURATION_MS,
  REFERRAL_REWARD_THRESHOLD,
  generateReferralCode,
  getReferralQualificationDeadline,
  isReferralCode,
  maskReferralEmail,
  normalizeReferralCode,
} from "../src/lib/referrals";

async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();
}

async function getReferralCodeByOwner(
  ctx: QueryCtx | MutationCtx,
  ownerUserId: Id<"users">,
) {
  return await ctx.db
    .query("referralCodes")
    .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", ownerUserId))
    .first();
}

async function getReferralCodeByCode(ctx: QueryCtx | MutationCtx, code: string) {
  return await ctx.db
    .query("referralCodes")
    .withIndex("by_code", (q) => q.eq("code", code))
    .first();
}

async function getReferralClaimByReferredUserId(
  ctx: QueryCtx | MutationCtx,
  referredUserId: Id<"users">,
) {
  return await ctx.db
    .query("referralClaims")
    .withIndex("by_referredUserId", (q) => q.eq("referredUserId", referredUserId))
    .first();
}

async function getUserStats(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  return await ctx.db
    .query("userStats")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

async function createUniqueReferralCode(ctx: MutationCtx, ownerUserId: Id<"users">) {
  const existingCode = await getReferralCodeByOwner(ctx, ownerUserId);
  if (existingCode) {
    return existingCode;
  }

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const code = generateReferralCode();
    const collision = await getReferralCodeByCode(ctx, code);
    if (collision) continue;

    const now = Date.now();
    const codeId = await ctx.db.insert("referralCodes", {
      ownerUserId,
      code,
      createdAt: now,
      qualifiedCount: 0,
    });

    const createdCode = await ctx.db.get(codeId);
    if (!createdCode) {
      throw new Error("Failed to create referral code");
    }

    return createdCode;
  }

  throw new Error("Failed to generate a unique referral code");
}

function getReferralDisplayName(user: {
  email: string;
  discordUsername?: string;
}) {
  if (user.discordUsername) {
    return `@${user.discordUsername}`;
  }

  return maskReferralEmail(user.email);
}

async function grantReferralRewardIfNeeded(
  ctx: MutationCtx,
  referralCodeDoc: {
    _id: Id<"referralCodes">;
    qualifiedCount: number;
    rewardGrantedAt?: number;
    ownerUserId: Id<"users">;
  },
  referrerUser: {
    _id: Id<"users">;
    adminProExpiresAt?: number;
  },
) {
  if (
    referralCodeDoc.rewardGrantedAt ||
    referralCodeDoc.qualifiedCount < REFERRAL_REWARD_THRESHOLD
  ) {
    return;
  }

  const now = Date.now();
  const rewardBase = Math.max(referrerUser.adminProExpiresAt ?? 0, now);

  await ctx.db.patch(referralCodeDoc._id, {
    rewardGrantedAt: now,
  });

  await ctx.db.patch(referrerUser._id, {
    adminProExpiresAt: rewardBase + REFERRAL_PRO_REWARD_DURATION_MS,
  });
}

async function evaluatePendingClaim(
  ctx: MutationCtx,
  claim: {
    _id: Id<"referralClaims">;
    referralCodeId: Id<"referralCodes">;
    referrerUserId: Id<"users">;
    referredUserId: Id<"users">;
    status: "pending" | "qualified" | "rejected";
    createdAt: number;
  },
) {
  if (claim.status !== "pending") {
    return { status: claim.status };
  }

  const [referredUser, referrerUser, referralCodeDoc] = await Promise.all([
    ctx.db.get(claim.referredUserId),
    ctx.db.get(claim.referrerUserId),
    ctx.db.get(claim.referralCodeId),
  ]);

  if (!referredUser || referredUser.isDeleted) {
    await ctx.db.patch(claim._id, {
      status: "rejected",
      rejectedAt: Date.now(),
      rejectionReason: "referred_user_missing",
    });
    return { status: "rejected" as const };
  }

  if (!referrerUser || referrerUser.isDeleted || !referralCodeDoc) {
    await ctx.db.patch(claim._id, {
      status: "rejected",
      rejectedAt: Date.now(),
      rejectionReason: "referrer_missing",
    });
    return { status: "rejected" as const };
  }

  const createdAt = referredUser.createdAt ?? claim.createdAt;
  const stats = await getUserStats(ctx, claim.referredUserId);
  const totalFlights = stats?.totalFlights ?? 0;

  if (Date.now() - createdAt < REFERRAL_MIN_ACCOUNT_AGE_MS) {
    return { status: "pending" as const };
  }

  if (totalFlights < REFERRAL_MIN_QUALIFYING_FLIGHTS) {
    return { status: "pending" as const };
  }

  const qualifiedAt = Date.now();
  await ctx.db.patch(claim._id, {
    status: "qualified",
    qualifiedAt,
    qualifyingFlightCount: totalFlights,
  });

  const nextQualifiedCount = referralCodeDoc.qualifiedCount + 1;
  const nextCodeDoc = {
    ...referralCodeDoc,
    qualifiedCount: nextQualifiedCount,
  };

  await ctx.db.patch(referralCodeDoc._id, {
    qualifiedCount: nextQualifiedCount,
  });

  await grantReferralRewardIfNeeded(ctx, nextCodeDoc, referrerUser);

  return { status: "qualified" as const };
}

export async function maybeCreateReferralClaimForNewUser(
  ctx: MutationCtx,
  referredUser: {
    _id: Id<"users">;
    createdAt?: number;
  },
  rawReferralCode?: string,
) {
  const normalizedCode = normalizeReferralCode(rawReferralCode);
  if (!isReferralCode(normalizedCode)) {
    return null;
  }

  const existingClaim = await getReferralClaimByReferredUserId(ctx, referredUser._id);
  if (existingClaim) {
    return existingClaim._id;
  }

  const referralCodeDoc = await getReferralCodeByCode(ctx, normalizedCode);
  if (!referralCodeDoc || referralCodeDoc.ownerUserId === referredUser._id) {
    return null;
  }

  const referrerUser = await ctx.db.get(referralCodeDoc.ownerUserId);
  if (!referrerUser || referrerUser.isDeleted) {
    return null;
  }

  const claimId = await ctx.db.insert("referralClaims", {
    referralCodeId: referralCodeDoc._id,
    referralCode: referralCodeDoc.code,
    referrerUserId: referralCodeDoc.ownerUserId,
    referredUserId: referredUser._id,
    status: "pending",
    createdAt: referredUser.createdAt ?? Date.now(),
  });

  return claimId;
}

export async function maybeQualifyReferralForUser(
  ctx: MutationCtx,
  referredUserId: Id<"users">,
) {
  const claim = await getReferralClaimByReferredUserId(ctx, referredUserId);
  if (claim?.status !== "pending") {
    return null;
  }

  return await evaluatePendingClaim(ctx, claim);
}

export const getOrCreateMyCode = mutation({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || currentUser.isDeleted) {
      throw new Error("Unauthorized");
    }

    const codeDoc = await createUniqueReferralCode(ctx, currentUser._id);
    return codeDoc.code;
  },
});

export const getMyOverview = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || currentUser.isDeleted) {
      return null;
    }

    const codeDoc = await getReferralCodeByOwner(ctx, currentUser._id);
    const claims = await ctx.db
      .query("referralClaims")
      .withIndex("by_referrerUserId", (q) => q.eq("referrerUserId", currentUser._id))
      .collect();

    const detailedClaims = await Promise.all(
      claims.map(async (claim) => {
        const [referredUser, stats] = await Promise.all([
          ctx.db.get(claim.referredUserId),
          getUserStats(ctx, claim.referredUserId),
        ]);

        if (!referredUser) {
          return {
            id: claim._id,
            code: claim.referralCode,
            displayName: "Deleted user",
            createdAt: claim.createdAt,
            status: claim.status,
            qualifiedAt: claim.qualifiedAt ?? null,
            totalFlights: claim.qualifyingFlightCount ?? 0,
            flightsRemaining: REFERRAL_MIN_QUALIFYING_FLIGHTS,
            timeRemainingMs: 0,
          };
        }

        const referralCreatedAt = referredUser.createdAt ?? claim.createdAt;
        const qualificationDeadline =
          getReferralQualificationDeadline(referralCreatedAt);
        const totalFlights = stats?.totalFlights ?? 0;

        return {
          id: claim._id,
          code: claim.referralCode,
          displayName: getReferralDisplayName(referredUser),
          createdAt: referralCreatedAt,
          status: claim.status,
          qualifiedAt: claim.qualifiedAt ?? null,
          totalFlights,
          flightsRemaining: Math.max(
            0,
            REFERRAL_MIN_QUALIFYING_FLIGHTS - totalFlights,
          ),
          timeRemainingMs: Math.max(0, qualificationDeadline - Date.now()),
        };
      }),
    );

    detailedClaims.sort((a, b) => b.createdAt - a.createdAt);

    const qualifiedCount = codeDoc?.qualifiedCount ?? 0;
    const pendingCount = detailedClaims.filter(
      (claim) => claim.status === "pending",
    ).length;

    return {
      code: codeDoc?.code ?? null,
      qualifiedCount,
      pendingCount,
      rewardGrantedAt: codeDoc?.rewardGrantedAt ?? null,
      rewardThreshold: REFERRAL_REWARD_THRESHOLD,
      rewardRemaining: Math.max(0, REFERRAL_REWARD_THRESHOLD - qualifiedCount),
      minAccountAgeDays: REFERRAL_MIN_ACCOUNT_AGE_DAYS,
      minFlights: REFERRAL_MIN_QUALIFYING_FLIGHTS,
      claims: detailedClaims,
    };
  },
});

export const getPublicCodeSummary = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const normalizedCode = normalizeReferralCode(args.code);
    if (!isReferralCode(normalizedCode)) {
      return null;
    }

    const referralCodeDoc = await getReferralCodeByCode(ctx, normalizedCode);
    if (!referralCodeDoc) {
      return null;
    }

    const owner = await ctx.db.get(referralCodeDoc.ownerUserId);
    if (!owner || owner.isDeleted) {
      return null;
    }

    return {
      code: referralCodeDoc.code,
      referrerName: owner.discordUsername
        ? `@${owner.discordUsername}`
        : "a RadarThing pilot",
      qualifiedCount: referralCodeDoc.qualifiedCount,
      rewardThreshold: REFERRAL_REWARD_THRESHOLD,
      rewardGrantedAt: referralCodeDoc.rewardGrantedAt ?? null,
      minAccountAgeDays: REFERRAL_MIN_ACCOUNT_AGE_DAYS,
      minFlights: REFERRAL_MIN_QUALIFYING_FLIGHTS,
    };
  },
});

export const evaluateClaimQualification = internalMutation({
  args: { claimId: v.id("referralClaims") },
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim) {
      return null;
    }

    return await evaluatePendingClaim(ctx, claim);
  },
});
