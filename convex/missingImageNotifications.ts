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
      note: n.note ?? null,
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

// Get notification record
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
    };
  },
});

// Create a notification record
export const create = mutation({
  args: {
    airlineCode: v.string(),
    aircraftType: v.string(),
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
      return existing._id;
    }

    return await ctx.db.insert("missingImageNotifications", {
      airlineCode: args.airlineCode.toUpperCase(),
      aircraftType: args.aircraftType.toUpperCase(),
    });
  },
});

// Update note
export const updateNote = mutation({
  args: {
    airlineCode: v.string(),
    aircraftType: v.string(),
    note: v.string(),
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
        note: args.note || undefined,
      });
      return true;
    }
    return false;
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
      return { deleted: true };
    }

    return { deleted: false };
  },
});

// Delete notifications for both IATA and ICAO codes in a single mutation
// This is more efficient than calling remove() twice
export const removeByCodes = mutation({
  args: {
    airlineIata: v.string(),
    airlineIcao: v.string(),
    aircraftType: v.string(),
  },
  handler: async (ctx, args) => {
    const aircraftType = args.aircraftType.toUpperCase();
    const iata = args.airlineIata.toUpperCase();
    const icao = args.airlineIcao.toUpperCase();

    let deletedCount = 0;

    // Find and delete notification for IATA code
    const iataNotification = await ctx.db
      .query("missingImageNotifications")
      .withIndex("by_airline_aircraft", (q) =>
        q.eq("airlineCode", iata).eq("aircraftType", aircraftType)
      )
      .first();

    if (iataNotification) {
      await ctx.db.delete(iataNotification._id);
      deletedCount++;
    }

    // Find and delete notification for ICAO code (if different from IATA)
    if (icao !== iata) {
      const icaoNotification = await ctx.db
        .query("missingImageNotifications")
        .withIndex("by_airline_aircraft", (q) =>
          q.eq("airlineCode", icao).eq("aircraftType", aircraftType)
        )
        .first();

      if (icaoNotification) {
        await ctx.db.delete(icaoNotification._id);
        deletedCount++;
      }
    }

    return { deletedCount };
  },
});

