import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByVirtualAirlineId = query({
  args: {
    virtualAirlineId: v.id("virtualAirlines"),
  },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("virtualAirlineMembers")
      .withIndex("by_virtualAirlineId", (q) =>
        q.eq("virtualAirlineId", args.virtualAirlineId),
      )
      .collect();

    const results = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        return {
          id: member._id,
          virtualAirlineId: member.virtualAirlineId,
          userId: member.userId,
          clerkId: member.clerkId,
          googleId: member.googleId,
          addedBy: member.addedBy,
          createdAt: member._creationTime,
          email: user?.email ?? null,
          discordUsername: user?.discordUsername ?? null,
        };
      }),
    );

    return results.sort((a, b) =>
      (a.email ?? a.discordUsername ?? a.clerkId).localeCompare(
        b.email ?? b.discordUsername ?? b.clerkId,
      ),
    );
  },
});

export const getByUserId = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("virtualAirlineMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!membership) return null;

    return {
      id: membership._id,
      virtualAirlineId: membership.virtualAirlineId,
      userId: membership.userId,
      clerkId: membership.clerkId,
      googleId: membership.googleId,
      addedBy: membership.addedBy,
      createdAt: membership._creationTime,
    };
  },
});

export const add = mutation({
  args: {
    virtualAirlineId: v.id("virtualAirlines"),
    userId: v.id("users"),
    clerkId: v.string(),
    googleId: v.string(),
    addedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const existingMembership = await ctx.db
      .query("virtualAirlineMembers")
      .withIndex("by_virtualAirlineId_userId", (q) =>
        q
          .eq("virtualAirlineId", args.virtualAirlineId)
          .eq("userId", args.userId),
      )
      .first();

    if (existingMembership) {
      return {
        id: existingMembership._id,
        virtualAirlineId: existingMembership.virtualAirlineId,
        userId: existingMembership.userId,
        clerkId: existingMembership.clerkId,
        googleId: existingMembership.googleId,
        addedBy: existingMembership.addedBy,
        createdAt: existingMembership._creationTime,
      };
    }

    const id = await ctx.db.insert("virtualAirlineMembers", {
      virtualAirlineId: args.virtualAirlineId,
      userId: args.userId,
      clerkId: args.clerkId,
      googleId: args.googleId,
      addedBy: args.addedBy,
    });

    const membership = await ctx.db.get(id);
    if (!membership) return null;

    return {
      id: membership._id,
      virtualAirlineId: membership.virtualAirlineId,
      userId: membership.userId,
      clerkId: membership.clerkId,
      googleId: membership.googleId,
      addedBy: membership.addedBy,
      createdAt: membership._creationTime,
    };
  },
});

export const remove = mutation({
  args: {
    id: v.id("virtualAirlineMembers"),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get(args.id);
    if (!membership) return null;

    await ctx.db.delete(args.id);

    return {
      id: membership._id,
      virtualAirlineId: membership.virtualAirlineId,
      userId: membership.userId,
      clerkId: membership.clerkId,
      googleId: membership.googleId,
    };
  },
});
