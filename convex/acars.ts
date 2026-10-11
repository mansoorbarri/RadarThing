import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getCurrentUser, requireAdmin, requireSystem } from "./lib/auth";
import {
  assertModerationTarget,
  moderationReason,
} from "./lib/moderationRules";

const MAX_MESSAGES = 20;

function validGoogleId(value: string) {
  return /^\d{8,32}$/.test(value);
}

async function postingPilot(
  ctx: QueryCtx | MutationCtx,
  tokenHash: string,
  googleId: string,
) {
  if (!validGoogleId(googleId))
    throw new Error("Sign in to GeoFS to publish ACARS");
  const device = await ctx.db
    .query("acarsDevices")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .first();
  if (device?.googleId !== googleId)
    throw new Error("ACARS device is not registered");
  const user = await ctx.db
    .query("users")
    .withIndex("by_googleId", (q) => q.eq("googleId", googleId))
    .first();
  if (user?.isDeleted || user?.activeBanId)
    throw new Error("Account access restricted");
  return user;
}

export const registerDevice = mutation({
  args: {
    googleId: v.string(),
    tokenHash: v.string(),
    systemSecret: v.string(),
  },
  handler: async (ctx, args) => {
    requireSystem(ctx, args.systemSecret);
    if (!validGoogleId(args.googleId) || !/^[a-f0-9]{64}$/.test(args.tokenHash))
      throw new Error("Invalid ACARS device registration");
    const existing = await ctx.db
      .query("acarsDevices")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();
    if (existing) {
      if (existing.googleId !== args.googleId)
        throw new Error("ACARS device belongs to another pilot");
      return;
    }
    await ctx.db.insert("acarsDevices", {
      googleId: args.googleId,
      tokenHash: args.tokenHash,
      createdAt: Date.now(),
    });
  },
});

export const postingStatus = query({
  args: { tokenHash: v.string(), googleId: v.string() },
  handler: async (ctx, args) => {
    try {
      await postingPilot(ctx, args.tokenHash, args.googleId);
      const latest = await ctx.db
        .query("acarsMessages")
        .withIndex("by_googleId_createdAt", (q) =>
          q.eq("googleId", args.googleId),
        )
        .order("desc")
        .first();
      const blocked = await ctx.db
        .query("acarsModerationEvents")
        .withIndex("by_googleId_createdAt", (q) =>
          q.eq("googleId", args.googleId),
        )
        .order("desc")
        .first();
      const lastAttempt = Math.max(
        latest?.createdAt ?? 0,
        blocked?.createdAt ?? 0,
      );
      return {
        allowed: true,
        retryAfter: lastAttempt
          ? Math.max(0, 30_000 - (Date.now() - lastAttempt))
          : 0,
      };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : "Cannot publish",
      };
    }
  },
});

export const publish = mutation({
  args: {
    googleId: v.string(),
    tokenHash: v.string(),
    body: v.string(),
    systemSecret: v.string(),
  },
  handler: async (ctx, args) => {
    requireSystem(ctx, args.systemSecret);
    const user = await postingPilot(ctx, args.tokenHash, args.googleId);
    const body = args.body.trim();
    if (!body || body.length > 500)
      throw new Error("ACARS text must be 1–500 characters");
    const messages = await ctx.db
      .query("acarsMessages")
      .withIndex("by_googleId_createdAt", (q) =>
        q.eq("googleId", args.googleId),
      )
      .order("desc")
      .take(MAX_MESSAGES + 1);
    if (messages[0] && Date.now() - messages[0].createdAt < 30_000)
      throw new Error("Wait 30 seconds before publishing another ACARS entry");
    const oldest = messages[messages.length - 1];
    if (messages.length >= MAX_MESSAGES && oldest)
      await ctx.db.delete(oldest._id);
    return await ctx.db.insert("acarsMessages", {
      userId: user?._id,
      googleId: args.googleId,
      deviceHash: args.tokenHash,
      body,
      createdAt: Date.now(),
    });
  },
});

export const recordBlocked = mutation({
  args: {
    googleId: v.string(),
    tokenHash: v.string(),
    body: v.string(),
    categories: v.array(v.string()),
    systemSecret: v.string(),
  },
  handler: async (ctx, args) => {
    requireSystem(ctx, args.systemSecret);
    const user = await postingPilot(ctx, args.tokenHash, args.googleId);
    if (!args.body.trim() || args.body.length > 500)
      throw new Error("Invalid ACARS text");
    const previous = await ctx.db
      .query("acarsModerationEvents")
      .withIndex("by_googleId_createdAt", (q) =>
        q.eq("googleId", args.googleId),
      )
      .order("desc")
      .take(100);
    if (previous.length >= 100) {
      const oldest = previous[previous.length - 1];
      if (oldest) await ctx.db.delete(oldest._id);
    }
    return await ctx.db.insert("acarsModerationEvents", {
      userId: user?._id,
      googleId: args.googleId,
      body: args.body.trim(),
      categories: args.categories.slice(0, 20),
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    googleId: v.string(),
    tokenHash: v.string(),
    messageId: v.id("acarsMessages"),
    systemSecret: v.string(),
  },
  handler: async (ctx, args) => {
    requireSystem(ctx, args.systemSecret);
    await postingPilot(ctx, args.tokenHash, args.googleId);
    const message = await ctx.db.get(args.messageId);
    if (
      message?.googleId !== args.googleId ||
      message.deviceHash !== args.tokenHash
    )
      throw new Error("ACARS entry not found on this device");
    await ctx.db.delete(message._id);
  },
});

export const listPublic = query({
  args: { googleId: v.string() },
  handler: async (ctx, args) => {
    if (!validGoogleId(args.googleId)) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_googleId", (q) => q.eq("googleId", args.googleId))
      .first();
    if (user?.isDeleted || user?.activeBanId) return [];
    const messages = await ctx.db
      .query("acarsMessages")
      .withIndex("by_googleId_createdAt", (q) =>
        q.eq("googleId", args.googleId),
      )
      .order("desc")
      .take(MAX_MESSAGES);
    return messages.map(({ _id, body, createdAt }) => ({
      _id,
      body,
      createdAt,
    }));
  },
});

export const listForDevice = query({
  args: { googleId: v.string(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    await postingPilot(ctx, args.tokenHash, args.googleId);
    const messages = await ctx.db
      .query("acarsMessages")
      .withIndex("by_googleId_createdAt", (q) =>
        q.eq("googleId", args.googleId),
      )
      .order("desc")
      .take(MAX_MESSAGES);
    return messages.map(({ _id, body, createdAt, deviceHash }) => ({
      _id,
      body,
      createdAt,
      canRemove: deviceHash === args.tokenHash,
    }));
  },
});

export const myAccountExport = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.isDeleted) throw new Error("Account not found");
    const [messages, blocked] = await Promise.all([
      ctx.db
        .query("acarsMessages")
        .withIndex("by_userId_createdAt", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(100),
      ctx.db
        .query("acarsModerationEvents")
        .withIndex("by_userId_createdAt", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(100),
    ]);
    return {
      messages: messages.map(({ _id, googleId, body, createdAt }) => ({
        id: _id,
        googleId,
        body,
        createdAt,
      })),
      blocked: blocked.map(
        ({ _id, googleId, body, categories, createdAt }) => ({
          id: _id,
          googleId,
          body,
          categories,
          createdAt,
        }),
      ),
    };
  },
});

export const report = mutation({
  args: { messageId: v.id("acarsMessages"), reason: v.string() },
  handler: async (ctx, args) => {
    const reporter = await getCurrentUser(ctx);
    if (!reporter || reporter.isDeleted || reporter.activeBanId)
      throw new Error("Sign in to report an ACARS entry");
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("ACARS entry not found");
    if (message.userId === reporter._id)
      throw new Error("You cannot report your own entry");
    const previous = await ctx.db
      .query("acarsReports")
      .withIndex("by_message_reporter", (q) =>
        q.eq("messageId", args.messageId).eq("reporterUserId", reporter._id),
      )
      .first();
    if (previous) return previous._id;
    return await ctx.db.insert("acarsReports", {
      messageId: args.messageId,
      reporterUserId: reporter._id,
      pilotUserId: message.userId,
      googleId: message.googleId,
      body: message.body,
      reason: moderationReason(args.reason),
      createdAt: Date.now(),
    });
  },
});

export const adminQueue = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [reports, blocked] = await Promise.all([
      ctx.db
        .query("acarsReports")
        .withIndex("by_createdAt")
        .order("desc")
        .take(100),
      ctx.db
        .query("acarsModerationEvents")
        .withIndex("by_createdAt")
        .order("desc")
        .take(100),
    ]);
    return {
      reports: await Promise.all(
        reports.map(async (report) => {
          const message = await ctx.db.get(report.messageId);
          const pilot = report.pilotUserId
            ? await ctx.db.get(report.pilotUserId)
            : null;
          return {
            ...report,
            isMessagePresent: Boolean(message),
            pilotId: pilot?._id ?? null,
            pilotLabel:
              pilot?.discordUsername ??
              (pilot ? "RT ID: " + pilot._id : "GeoFS ID: " + report.googleId),
          };
        }),
      ),
      blocked: await Promise.all(
        blocked.map(async (event) => {
          const pilot = event.userId ? await ctx.db.get(event.userId) : null;
          return {
            ...event,
            pilotLabel:
              pilot?.discordUsername ??
              (pilot ? "RT ID: " + pilot._id : "GeoFS ID: " + event.googleId),
          };
        }),
      ),
    };
  },
});

export const adminRemove = mutation({
  args: { messageId: v.id("acarsMessages") },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) return;
    const pilot = message.userId ? await ctx.db.get(message.userId) : null;
    if (pilot) assertModerationTarget(actor, pilot);
    await ctx.db.delete(message._id);
  },
});

export const markReportReviewed = mutation({
  args: { reportId: v.id("acarsReports") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const report = await ctx.db.get(args.reportId);
    if (report && !report.reviewedAt)
      await ctx.db.patch(report._id, { reviewedAt: Date.now() });
  },
});
