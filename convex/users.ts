import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { hasEffectiveProAccess } from "../src/lib/proAccess";
import { REFERRAL_MIN_ACCOUNT_AGE_MS } from "../src/lib/referrals";
import { maybeCreateReferralClaimForNewUser } from "./referrals";
import { logAdminTelemetry } from "./adminTelemetry";
import { requireAdmin, requireAuthenticatedClerkId, requireSystem } from "./lib/auth";

const SUPER_ADMIN_EMAIL = "mansoor.eb.ak@gmail.com";

function normalizeDiscordUsername(value: string): string {
  return value.trim().toLowerCase();
}

async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();
}

async function requireAdminForProManagement(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("Unauthorized");
  }

  const user = await getCurrentUser(ctx);
  const isSuperAdmin =
    identity?.email?.trim().toLowerCase() === SUPER_ADMIN_EMAIL ||
    user?.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
  if (!isSuperAdmin) {
    throw new Error("Unauthorized");
  }

  return (
    user ?? {
      clerkId: identity.subject,
      email: identity.email ?? SUPER_ADMIN_EMAIL,
      discordUsername: undefined,
    }
  );
}

export const isSuperAdmin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) return false;

    const user = await getCurrentUser(ctx);
    return (
      identity.email?.trim().toLowerCase() === SUPER_ADMIN_EMAIL ||
      user?.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL
    );
  },
});

function getProAccessLabel(user: { email: string; discordUsername?: string }) {
  return user.discordUsername
    ? `${user.discordUsername} (${user.email})`
    : user.email;
}

// Get user by Clerk ID
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

// Get user by Google ID
export const getByGoogleId = query({
  args: { googleId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_googleId", (q) => q.eq("googleId", args.googleId))
      .first();
  },
});

// Get Discord usernames for a batch of Google IDs
export const getDiscordUsernamesByGoogleIds = query({
  args: { googleIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const googleIds = Array.from(
      new Set(
        args.googleIds.map((googleId) => googleId.trim()).filter(Boolean),
      ),
    );

    if (googleIds.length === 0) {
      return {};
    }

    const users = await Promise.all(
      googleIds.map((googleId) =>
        ctx.db
          .query("users")
          .withIndex("by_googleId", (q) => q.eq("googleId", googleId))
          .first(),
      ),
    );

    return Object.fromEntries(
      users.flatMap((user, index) => {
        const googleId = googleIds[index];
        if (!googleId || !user?.discordUsername) return [];
        return [[googleId, user.discordUsername]];
      }),
    );
  },
});

// Get user by Stripe Customer ID
export const getByStripeCustomerId = query({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_stripeCustomerId", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId),
      )
      .first();
  },
});

// Get user by email
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

// Get user by Discord username
export const getByDiscordUsername = query({
  args: { discordUsername: v.string() },
  handler: async (ctx, args) => {
    const normalized = normalizeDiscordUsername(args.discordUsername);

    const indexedUser = await ctx.db
      .query("users")
      .withIndex("by_discordUsernameLower", (q) =>
        q.eq("discordUsernameLower", normalized),
      )
      .first();

    if (indexedUser) return indexedUser;

    const users = await ctx.db.query("users").collect();
    return (
      users.find(
        (user) =>
          user.discordUsername &&
          normalizeDiscordUsername(user.discordUsername) === normalized,
      ) ?? null
    );
  },
});

// Search pilots by Discord username prefix for radar search
export const searchPilotsByDiscordUsername = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const normalized = normalizeDiscordUsername(args.searchTerm).replace(
      /^@/,
      "",
    );

    if (!normalized) return [];

    const limit = Math.max(1, Math.min(args.limit ?? 8, 20));
    const indexedUsers = await ctx.db
      .query("users")
      .withIndex("by_discordUsernameLower", (q) =>
        q
          .gte("discordUsernameLower", normalized)
          .lt("discordUsernameLower", `${normalized}\uffff`),
      )
      .take(limit * 2);

    const fallbackUsers =
      indexedUsers.length >= limit
        ? []
        : (await ctx.db.query("users").collect()).filter((user) => {
            if (user.isDeleted || !user.discordUsername) return false;
            return normalizeDiscordUsername(user.discordUsername).includes(
              normalized,
            );
          });

    const usersById = new Map(
      [...indexedUsers, ...fallbackUsers]
        .filter((user) => !user.isDeleted && user.discordUsername)
        .map((user) => [user._id, user]),
    );
    const activeUsers = Array.from(usersById.values()).slice(0, limit);
    const stats = await Promise.all(
      activeUsers.map((user) =>
        ctx.db
          .query("userStats")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .first(),
      ),
    );

    return activeUsers.map((user, index) => ({
      _id: user._id,
      discordUsername: user.discordUsername ?? null,
      pilotCallsign: stats[index]?.lastFlightCallsign ?? null,
      totalFlights: stats[index]?.totalFlights ?? 0,
      role: user.role,
    }));
  },
});

// Check if user is PRO
export const isPro = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    return hasEffectiveProAccess(user);
  },
});

// Get user role
export const getRole = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    return user?.role ?? null;
  },
});

// Store user (client-side upsert, called once per session)
export const storeUser = mutation({
  args: {
    googleId: v.optional(v.string()),
    referralCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const clerkId = identity.subject;
    const email = identity.email!;

    // Try to find existing user by clerkId
    let user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .first();

    // If not found by clerkId, try by email (handles pre-existing or migrated users)
    if (!user) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
    }

    if (user) {
      // Re-activate soft-deleted user
      if (user.isDeleted) {
        await ctx.db.patch(user._id, {
          clerkId,
          email,
          googleId: args.googleId,
          isDeleted: false,
          deletedAt: undefined,
          role: "FREE",
        });
        return user._id;
      }

      // Update existing active user only if something changed
      const updates: Record<string, string | undefined> = {};
      if (user.clerkId !== clerkId) updates.clerkId = clerkId;
      if (user.email !== email) updates.email = email;
      if (args.googleId && user.googleId !== args.googleId)
        updates.googleId = args.googleId;

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(user._id, updates);
      }
      return user._id;
    }

    // Create new user
    const createdAt = Date.now();
    const userId = await ctx.db.insert("users", {
      clerkId,
      email,
      googleId: args.googleId,
      role: "FREE",
      isDeleted: false,
      createdAt,
    });

    const claimId = await maybeCreateReferralClaimForNewUser(
      ctx,
      { _id: userId, createdAt },
      args.referralCode,
    );

    if (claimId) {
      await ctx.scheduler.runAfter(
        REFERRAL_MIN_ACCOUNT_AGE_MS,
        internal.referrals.evaluateClaimQualification,
        { claimId },
      );
    }

    return userId;
  },
});

// Update user
export const update = mutation({
  args: {
    id: v.id("users"),
    email: v.optional(v.string()),
    role: v.optional(v.union(v.literal("FREE"), v.literal("PRO"))),
    googleId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
    systemSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, systemSecret, ...updates } = args;
    const user = await ctx.db.get(id);
    if (!user) return null;

    const requiresSystem =
      updates.role !== undefined ||
      updates.stripeCustomerId !== undefined ||
      updates.stripeSubscriptionId !== undefined ||
      updates.isDeleted !== undefined ||
      updates.deletedAt !== undefined;

    if (requiresSystem) {
      requireSystem(ctx, systemSecret);
    } else {
      await requireAuthenticatedClerkId(ctx, user.clerkId);
    }

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined),
    );
    await ctx.db.patch(id, filteredUpdates);
    return id;
  },
});

// Update user by Clerk ID
export const updateByClerkId = mutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    role: v.optional(v.union(v.literal("FREE"), v.literal("PRO"))),
    googleId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
    systemSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { clerkId, systemSecret, ...updates } = args;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!user) return null;

    const requiresSystem =
      updates.role !== undefined ||
      updates.stripeCustomerId !== undefined ||
      updates.stripeSubscriptionId !== undefined ||
      updates.isDeleted !== undefined ||
      updates.deletedAt !== undefined;

    if (requiresSystem) {
      requireSystem(ctx, systemSecret);
    } else {
      await requireAuthenticatedClerkId(ctx, clerkId);
    }

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined),
    );
    await ctx.db.patch(user._id, filteredUpdates);
    return user._id;
  },
});

// Update user by Stripe Customer ID
export const updateByStripeCustomerId = mutation({
  args: {
    stripeCustomerId: v.string(),
    role: v.optional(v.union(v.literal("FREE"), v.literal("PRO"))),
    systemSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireSystem(ctx, args.systemSecret);

    const { stripeCustomerId, systemSecret: _systemSecret, ...updates } = args;
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripeCustomerId", (q) =>
        q.eq("stripeCustomerId", stripeCustomerId),
      )
      .first();

    if (!user) return null;

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined),
    );
    await ctx.db.patch(user._id, filteredUpdates);
    return user._id;
  },
});

// Soft delete user (for Clerk user.deleted event)
export const softDelete = mutation({
  args: { clerkId: v.string(), systemSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireSystem(ctx, args.systemSecret);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (user) {
      await ctx.db.patch(user._id, {
        isDeleted: true,
        deletedAt: Date.now(),
        role: "FREE",
      });
    }
  },
});

// Update Discord username for a user
export const updateDiscordUsername = mutation({
  args: {
    clerkId: v.string(),
    discordUsername: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return null;

    const discordUsername = args.discordUsername?.trim();

    await ctx.db.patch(user._id, {
      discordUsername,
      discordUsernameLower: discordUsername
        ? normalizeDiscordUsername(discordUsername)
        : undefined,
    });
    return user._id;
  },
});

// Get all non-deleted users (admin only)
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();
  },
});

export const getAssignablePilots = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthenticatedClerkId(ctx);

    const users = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();

    return users
      .filter((user) => Boolean(user.googleId))
      .map((user) => ({
        _id: user._id,
        discordUsername: user.discordUsername ?? null,
      }));
  },
});

export const getAllForProManagement = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminForProManagement(ctx);

    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();
  },
});

export const setPermanentProRole = mutation({
  args: {
    id: v.id("users"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdminForProManagement(ctx);

    const user = await ctx.db.get(args.id);
    if (!user || user.isDeleted) {
      throw new Error("User not found");
    }

    if (user.role === "ADMIN") {
      throw new Error("Admin users cannot be modified here");
    }

    await ctx.db.patch(args.id, {
      role: args.enabled ? "PRO" : "FREE",
      adminProExpiresAt: undefined,
    });

    await logAdminTelemetry(ctx, {
      actorClerkId: actor.clerkId,
      action: args.enabled ? "grant_pro" : "revoke_pro",
      resourceType: "pro_access",
      resourceId: user._id,
      resourceLabel: getProAccessLabel(user),
      targetClerkId: user.clerkId,
      metadata: {
        grantType: args.enabled ? "permanent" : "permanent_revoked",
        previousRole: user.role,
      },
    });
  },
});

export const setTemporaryProGrant = mutation({
  args: {
    id: v.id("users"),
    expiresAt: v.optional(v.number()),
    clear: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdminForProManagement(ctx);

    const user = await ctx.db.get(args.id);
    if (!user || user.isDeleted) {
      throw new Error("User not found");
    }

    if (user.role === "ADMIN") {
      throw new Error("Admin users cannot be modified here");
    }

    if (args.clear) {
      await ctx.db.patch(args.id, { adminProExpiresAt: undefined });
      await logAdminTelemetry(ctx, {
        actorClerkId: actor.clerkId,
        action: "revoke_pro",
        resourceType: "pro_access",
        resourceId: user._id,
        resourceLabel: getProAccessLabel(user),
        targetClerkId: user.clerkId,
        metadata: {
          grantType: "temporary",
          previousExpiresAt: user.adminProExpiresAt ?? null,
        },
      });
      return;
    }

    if (user.role === "PRO") {
      throw new Error("This user already has permanent PRO access");
    }

    if (
      typeof args.expiresAt !== "number" ||
      !Number.isFinite(args.expiresAt) ||
      args.expiresAt <= Date.now()
    ) {
      throw new Error("Pick a valid expiration time");
    }

    await ctx.db.patch(args.id, {
      adminProExpiresAt: args.expiresAt,
    });

    await logAdminTelemetry(ctx, {
      actorClerkId: actor.clerkId,
      action: "grant_pro",
      resourceType: "pro_access",
      resourceId: user._id,
      resourceLabel: getProAccessLabel(user),
      targetClerkId: user.clerkId,
      metadata: {
        grantType: "temporary",
        expiresAt: args.expiresAt,
      },
    });
  },
});

// Get upload counts for all active users (aircraft images + airport charts)
export const getFreeUserUploadCounts = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();
    const stats = await ctx.db.query("userStats").collect();
    const statsByUserId = new Map(stats.map((entry) => [entry.userId, entry]));

    return users
      .map((user) => {
        const userStats = statsByUserId.get(user._id);
        const aircraftImages = userStats?.approvedAircraftImages ?? 0;

        return {
          userId: user._id,
          clerkId: user.clerkId,
          role: user.role,
          discordUsername: user.discordUsername ?? null,
          displayName:
            user.discordUsername ?? `User ${user.clerkId.slice(0, 6)}`,
          aircraftImages,
          airportCharts: 0,
          total: aircraftImages,
        };
      })
      .filter((entry) => entry.total > 0);
  },
});

// Get total approved aircraft image uploads count for a user
export const getTotalApprovedUploads = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      return {
        aircraftImages: 0,
        airportCharts: 0,
        total: 0,
      };
    }

    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    const aircraftImages = stats?.approvedAircraftImages ?? 0;

    return {
      aircraftImages,
      airportCharts: 0,
      total: aircraftImages,
    };
  },
});

// One-time backfill for approved aircraft image contribution counts
export const backfillApprovedAircraftImageStats = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();
    const stats = await ctx.db.query("userStats").collect();
    const statsByUserId = new Map(stats.map((entry) => [entry.userId, entry]));
    const usersByClerkId = new Map(users.map((user) => [user.clerkId, user]));
    const usersByDiscordUsername = new Map(
      users
        .filter((user) => user.discordUsername)
        .map((user) => [user.discordUsername!, user]),
    );

    const approvedImages = await ctx.db
      .query("aircraftImages")
      .withIndex("by_isApproved", (q) => q.eq("isApproved", true))
      .collect();

    const approvedCountsByUserId = new Map<Id<"users">, number>();

    for (const image of approvedImages) {
      const matchedUser =
        usersByClerkId.get(image.uploadedBy) ??
        (image.discordUsername
          ? usersByDiscordUsername.get(image.discordUsername)
          : undefined);

      if (!matchedUser) continue;

      approvedCountsByUserId.set(
        matchedUser._id,
        (approvedCountsByUserId.get(matchedUser._id) ?? 0) + 1,
      );
    }

    for (const user of users) {
      const statsEntry = statsByUserId.get(user._id);
      const approvedAircraftImages = approvedCountsByUserId.get(user._id) ?? 0;

      if (statsEntry) {
        await ctx.db.patch(statsEntry._id, {
          approvedAircraftImages,
        });
        continue;
      }

      await ctx.db.insert("userStats", {
        userId: user._id,
        totalFlights: 0,
        totalFlightTimeMs: 0,
        totalDistanceNm: 0,
        approvedAircraftImages,
        streakAtLastFlight: 0,
        longestStreak: 0,
      });
    }

    return {
      usersUpdated: users.length,
      approvedImagesCounted: approvedImages.length,
    };
  },
});
