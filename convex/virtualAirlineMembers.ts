import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireVirtualAirlineManager } from "./lib/auth";

export const getByVirtualAirlineId = query({
  args: {
    virtualAirlineId: v.id("virtualAirlines"),
  },
  handler: async (ctx, args) => {
    try {
      await requireVirtualAirlineManager(ctx, args.virtualAirlineId);
    } catch {
      return [];
    }

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
          addedBy: member.addedBy,
          createdAt: member._creationTime,
          discordUsername: user?.discordUsername ?? null,
        };
      }),
    );

    return results.sort((a, b) =>
      (a.discordUsername ?? a.userId).localeCompare(
        b.discordUsername ?? b.userId,
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
      addedBy: membership.addedBy,
      createdAt: membership._creationTime,
    };
  },
});

export const getById = query({
  args: {
    id: v.id("virtualAirlineMembers"),
    virtualAirlineId: v.id("virtualAirlines"),
  },
  handler: async (ctx, args) => {
    try {
      await requireVirtualAirlineManager(ctx, args.virtualAirlineId);
    } catch {
      return null;
    }

    const membership = await ctx.db.get(args.id);
    if (!membership) return null;

    if (membership.virtualAirlineId !== args.virtualAirlineId) return null;

    const user = await ctx.db.get(membership.userId);

    return {
      id: membership._id,
      virtualAirlineId: membership.virtualAirlineId,
      userId: membership.userId,
      addedBy: membership.addedBy,
      createdAt: membership._creationTime,
      discordUsername: user?.discordUsername ?? null,
    };
  },
});

export const add = mutation({
  args: {
    virtualAirlineId: v.id("virtualAirlines"),
    userId: v.id("users"),
    addedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const { user: actor } = await requireVirtualAirlineManager(
      ctx,
      args.virtualAirlineId,
      { actorClerkId: args.addedBy },
    );

    const selectedUser = await ctx.db.get(args.userId);
    if (!selectedUser || selectedUser.isDeleted || !selectedUser.googleId) {
      throw new Error("Pilot not found");
    }

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
        addedBy: existingMembership.addedBy,
        createdAt: existingMembership._creationTime,
      };
    }

    const existingUserMembership = await ctx.db
      .query("virtualAirlineMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existingUserMembership) {
      throw new Error("Pilot is already assigned to another VA");
    }

    const id = await ctx.db.insert("virtualAirlineMembers", {
      virtualAirlineId: args.virtualAirlineId,
      userId: args.userId,
      clerkId: selectedUser.clerkId,
      googleId: selectedUser.googleId,
      addedBy: actor.clerkId,
    });

    const membership = await ctx.db.get(id);
    if (!membership) return null;

    return {
      id: membership._id,
      virtualAirlineId: membership.virtualAirlineId,
      userId: membership.userId,
      addedBy: membership.addedBy,
      createdAt: membership._creationTime,
    };
  },
});

export const remove = mutation({
  args: {
    id: v.id("virtualAirlineMembers"),
    virtualAirlineId: v.id("virtualAirlines"),
  },
  handler: async (ctx, args) => {
    await requireVirtualAirlineManager(ctx, args.virtualAirlineId);

    const membership = await ctx.db.get(args.id);
    if (!membership) return null;

    if (membership.virtualAirlineId !== args.virtualAirlineId) return null;

    await ctx.db.delete(args.id);

    return {
      id: membership._id,
      virtualAirlineId: membership.virtualAirlineId,
      userId: membership.userId,
    };
  },
});
