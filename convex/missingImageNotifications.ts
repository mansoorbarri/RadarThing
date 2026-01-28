import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all missing image notifications
export const getAll = query({
  handler: async (ctx) => {
    const notifications = await ctx.db
      .query("missingImageNotifications")
      .collect();

    return notifications.map((n) => ({
      id: n._id,
      airlineCode: n.airlineCode,
      aircraftType: n.aircraftType,
      discordMessageId: n.discordMessageId ?? null,
      createdAt: n._creationTime,
    }));
  },
});

// Check if a notification already exists for this airline + aircraft combo
export const exists = query({
  args: {
    airlineCode: v.string(),
    aircraftType: v.string(),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db
      .query("missingImageNotifications")
      .withIndex("by_airline_aircraft", (q) =>
        q
          .eq("airlineCode", args.airlineCode.toUpperCase())
          .eq("aircraftType", args.aircraftType.toUpperCase())
      )
      .first();

    return notification !== null;
  },
});

// Get notification record (includes message ID for deletion)
export const get = query({
  args: {
    airlineCode: v.string(),
    aircraftType: v.string(),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db
      .query("missingImageNotifications")
      .withIndex("by_airline_aircraft", (q) =>
        q
          .eq("airlineCode", args.airlineCode.toUpperCase())
          .eq("aircraftType", args.aircraftType.toUpperCase())
      )
      .first();

    if (!notification) return null;

    return {
      id: notification._id,
      airlineCode: notification.airlineCode,
      aircraftType: notification.aircraftType,
      discordMessageId: notification.discordMessageId ?? null,
    };
  },
});

// Create a notification record
export const create = mutation({
  args: {
    airlineCode: v.string(),
    aircraftType: v.string(),
    discordMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if already exists to prevent duplicates
    const existing = await ctx.db
      .query("missingImageNotifications")
      .withIndex("by_airline_aircraft", (q) =>
        q
          .eq("airlineCode", args.airlineCode.toUpperCase())
          .eq("aircraftType", args.aircraftType.toUpperCase())
      )
      .first();

    if (existing) {
      // Update with message ID if we now have one
      if (args.discordMessageId && !existing.discordMessageId) {
        await ctx.db.patch(existing._id, {
          discordMessageId: args.discordMessageId,
        });
      }
      return existing._id;
    }

    return await ctx.db.insert("missingImageNotifications", {
      airlineCode: args.airlineCode.toUpperCase(),
      aircraftType: args.aircraftType.toUpperCase(),
      discordMessageId: args.discordMessageId,
    });
  },
});

// Update discord message ID after sending
export const updateMessageId = mutation({
  args: {
    airlineCode: v.string(),
    aircraftType: v.string(),
    discordMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db
      .query("missingImageNotifications")
      .withIndex("by_airline_aircraft", (q) =>
        q
          .eq("airlineCode", args.airlineCode.toUpperCase())
          .eq("aircraftType", args.aircraftType.toUpperCase())
      )
      .first();

    if (notification) {
      await ctx.db.patch(notification._id, {
        discordMessageId: args.discordMessageId,
      });
    }
  },
});

// Delete notification (called when image is uploaded)
export const remove = mutation({
  args: {
    airlineCode: v.string(),
    aircraftType: v.string(),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db
      .query("missingImageNotifications")
      .withIndex("by_airline_aircraft", (q) =>
        q
          .eq("airlineCode", args.airlineCode.toUpperCase())
          .eq("aircraftType", args.aircraftType.toUpperCase())
      )
      .first();

    if (notification) {
      await ctx.db.delete(notification._id);
      return { deleted: true, discordMessageId: notification.discordMessageId };
    }

    return { deleted: false, discordMessageId: null };
  },
});
