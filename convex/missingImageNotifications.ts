import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isValidAirlineCode } from "./lib/airlineCodes";

function parseDiscordWebhook(
  webhookUrl: string,
): { id: string; token: string } | null {
  try {
    const url = new URL(webhookUrl);
    const match = /\/api\/webhooks\/([^/]+)\/([^/]+)/.exec(url.pathname);
    if (!match) return null;
    const id = match[1];
    const token = match[2];
    if (!id || !token) return null;
    return { id, token };
  } catch {
    return null;
  }
}

async function deleteDiscordMessage(messageId: string | undefined) {
  if (!messageId) return;

  const webhookUrl = process.env.DISCORD_MISSING_IMAGE_WEBHOOK;
  if (!webhookUrl) return;

  const parsed = parseDiscordWebhook(webhookUrl);
  if (!parsed) return;

  try {
    await fetch(
      `https://discord.com/api/webhooks/${parsed.id}/${parsed.token}/messages/${messageId}`,
      { method: "DELETE" },
    );
  } catch (error) {
    console.error("Failed to delete Discord missing-image message:", error);
  }
}

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
          .eq("aircraftType", args.aircraftType.toUpperCase()),
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
          .eq("aircraftType", args.aircraftType.toUpperCase()),
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
    const airlineCode = args.airlineCode.toUpperCase();
    const aircraftType = args.aircraftType.toUpperCase();

    // Reject invalid airline codes silently (external SSE backend calls this)
    if (!isValidAirlineCode(airlineCode)) {
      return { id: null, created: false };
    }

    // Check if already exists to prevent duplicates
    const existing = await ctx.db
      .query("missingImageNotifications")
      .withIndex("by_airline_aircraft", (q) =>
        q.eq("airlineCode", airlineCode).eq("aircraftType", aircraftType),
      )
      .first();

    if (existing) {
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("missingImageNotifications", {
      airlineCode,
      aircraftType,
    });

    return { id, created: true };
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
          .eq("aircraftType", args.aircraftType.toUpperCase()),
      )
      .first();

    if (notification) {
      const hasNote = args.note.trim().length > 0;
      if (hasNote && notification.discordMessageId) {
        await deleteDiscordMessage(notification.discordMessageId);
      }

      await ctx.db.patch(notification._id, {
        note: args.note || undefined,
        discordMessageId: hasNote ? undefined : notification.discordMessageId,
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
          .eq("aircraftType", args.aircraftType.toUpperCase()),
      )
      .first();

    if (notification) {
      await deleteDiscordMessage(notification.discordMessageId);
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
        q.eq("airlineCode", iata).eq("aircraftType", aircraftType),
      )
      .first();

    if (iataNotification) {
      await deleteDiscordMessage(iataNotification.discordMessageId);
      await ctx.db.delete(iataNotification._id);
      deletedCount++;
    }

    // Find and delete notification for ICAO code (if different from IATA)
    if (icao !== iata) {
      const icaoNotification = await ctx.db
        .query("missingImageNotifications")
        .withIndex("by_airline_aircraft", (q) =>
          q.eq("airlineCode", icao).eq("aircraftType", aircraftType),
        )
        .first();

      if (icaoNotification) {
        await deleteDiscordMessage(icaoNotification.discordMessageId);
        await ctx.db.delete(icaoNotification._id);
        deletedCount++;
      }
    }

    return { deletedCount };
  },
});

// Purge all notifications with invalid airline codes
export const purgeInvalid = mutation({
  handler: async (ctx) => {
    const all = await ctx.db.query("missingImageNotifications").collect();
    let deletedCount = 0;

    for (const notification of all) {
      if (!isValidAirlineCode(notification.airlineCode)) {
        await deleteDiscordMessage(notification.discordMessageId);
        await ctx.db.delete(notification._id);
        deletedCount++;
      }
    }

    return { deletedCount };
  },
});

// Store Discord message ID so we can delete the message later
export const setDiscordMessageId = mutation({
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
          .eq("aircraftType", args.aircraftType.toUpperCase()),
      )
      .first();

    if (!notification) return { updated: false };

    await ctx.db.patch(notification._id, {
      discordMessageId: args.discordMessageId,
    });

    return { updated: true };
  },
});
