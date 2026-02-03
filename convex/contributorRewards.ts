import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const REWARD_THRESHOLD = 100;

// Check if a user is eligible for a contributor reward
// Returns which reward(s) they qualify for, if any
export const checkEligibility = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    // Check if user is on FREE tier
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user || user.role !== "FREE") {
      return { eligible: false, reason: "not_free_tier" };
    }

    // Check if this user has already claimed any reward (one reward per person)
    const userExistingReward = await ctx.db
      .query("contributorRewards")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (userExistingReward) {
      return { eligible: false, reason: "already_claimed_reward" };
    }

    // Check if rewards are still available
    const aircraftImagesReward = await ctx.db
      .query("contributorRewards")
      .withIndex("by_rewardType", (q) => q.eq("rewardType", "aircraftImages"))
      .first();

    const airportChartsReward = await ctx.db
      .query("contributorRewards")
      .withIndex("by_rewardType", (q) => q.eq("rewardType", "airportCharts"))
      .first();

    // If both rewards are claimed, no more rewards available
    if (aircraftImagesReward && airportChartsReward) {
      return { eligible: false, reason: "all_rewards_claimed" };
    }

    // Check user's upload counts
    const aircraftImages = await ctx.db
      .query("aircraftImages")
      .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", args.clerkId))
      .filter((q) => q.eq(q.field("isApproved"), true))
      .collect();

    const airportCharts = await ctx.db
      .query("airportCharts")
      .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", args.clerkId))
      .filter((q) => q.eq(q.field("isApproved"), true))
      .collect();

    const eligibleRewards: Array<"aircraftImages" | "airportCharts"> = [];

    // Check if eligible for aircraft images reward
    if (!aircraftImagesReward && aircraftImages.length >= REWARD_THRESHOLD) {
      eligibleRewards.push("aircraftImages");
    }

    // Check if eligible for airport charts reward
    if (!airportChartsReward && airportCharts.length >= REWARD_THRESHOLD) {
      eligibleRewards.push("airportCharts");
    }

    if (eligibleRewards.length === 0) {
      return {
        eligible: false,
        reason: "threshold_not_met",
        counts: {
          aircraftImages: aircraftImages.length,
          airportCharts: airportCharts.length,
        },
      };
    }

    return {
      eligible: true,
      eligibleRewards,
      counts: {
        aircraftImages: aircraftImages.length,
        airportCharts: airportCharts.length,
      },
    };
  },
});

// Claim a contributor reward (called when user is first to hit 100)
export const claimReward = mutation({
  args: {
    clerkId: v.string(),
    rewardType: v.union(v.literal("aircraftImages"), v.literal("airportCharts")),
  },
  handler: async (ctx, args) => {
    // Check if this user has already claimed any reward
    const userExistingReward = await ctx.db
      .query("contributorRewards")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (userExistingReward) {
      return { success: false, reason: "user_already_claimed" };
    }

    // Check if this reward type is already claimed
    const existingReward = await ctx.db
      .query("contributorRewards")
      .withIndex("by_rewardType", (q) => q.eq("rewardType", args.rewardType))
      .first();

    if (existingReward) {
      return { success: false, reason: "reward_already_claimed" };
    }

    // Claim the reward
    await ctx.db.insert("contributorRewards", {
      rewardType: args.rewardType,
      clerkId: args.clerkId,
      claimedAt: Date.now(),
    });

    return { success: true };
  },
});

// Get all claimed rewards (for admin viewing)
export const getClaimedRewards = query({
  args: {},
  handler: async (ctx) => {
    const rewards = await ctx.db.query("contributorRewards").collect();
    return rewards;
  },
});
