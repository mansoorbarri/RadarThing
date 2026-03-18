import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

// Check if user is PRO
export const isPro = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    return user?.role === "PRO";
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
    return await ctx.db.insert("users", {
      clerkId,
      email,
      googleId: args.googleId,
      role: "FREE",
      isDeleted: false,
    });
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
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined),
    );
    await ctx.db.patch(id, filteredUpdates);
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
  },
  handler: async (ctx, args) => {
    const { clerkId, ...updates } = args;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!user) return null;

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
  },
  handler: async (ctx, args) => {
    const { stripeCustomerId, ...updates } = args;
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
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
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
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return null;

    await ctx.db.patch(user._id, {
      discordUsername: args.discordUsername,
    });
    return user._id;
  },
});

// Get all non-deleted users (admin only)
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();
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

    const results = await Promise.all(
      users.map(async (user) => {
        const aircraftImages = await ctx.db
          .query("aircraftImages")
          .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", user.clerkId))
          .collect();

        const airportCharts = await ctx.db
          .query("airportCharts")
          .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", user.clerkId))
          .collect();

        return {
          userId: user._id,
          clerkId: user.clerkId,
          role: user.role,
          discordUsername: user.discordUsername ?? null,
          displayName: user.discordUsername ?? `User ${user.clerkId.slice(0, 6)}`,
          aircraftImages: aircraftImages.length,
          airportCharts: airportCharts.length,
          total: aircraftImages.length + airportCharts.length,
        };
      }),
    );

    return results.filter((r) => r.total > 0);
  },
});

// Get total approved uploads count (aircraft images + airport charts) for a user
export const getTotalApprovedUploads = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    // Count approved aircraft images
    const aircraftImages = await ctx.db
      .query("aircraftImages")
      .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", args.clerkId))
      .filter((q) => q.eq(q.field("isApproved"), true))
      .collect();

    // Count approved airport charts
    const airportCharts = await ctx.db
      .query("airportCharts")
      .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", args.clerkId))
      .filter((q) => q.eq(q.field("isApproved"), true))
      .collect();

    return {
      aircraftImages: aircraftImages.length,
      airportCharts: airportCharts.length,
      total: aircraftImages.length + airportCharts.length,
    };
  },
});
