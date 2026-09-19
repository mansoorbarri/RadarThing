import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getCurrentUser, requireAdmin } from "./lib/auth";
import { logAdminTelemetry } from "./adminTelemetry";
import {
  assertModerationTarget,
  moderationReason,
  moderationLabel,
  SUPER_ADMIN_GOOGLE_ID,
} from "./lib/moderationRules";

function targetSummary(actor: Doc<"users">, user: Doc<"users">) {
  let disabledReason: string | undefined;
  try {
    assertModerationTarget(actor, user);
  } catch (error) {
    disabledReason =
      error instanceof Error ? error.message : "Protected account";
  }
  return {
    _id: user._id,
    discordUsername: user.discordUsername ?? null,
    label: moderationLabel(user, user._id),
    isBanned: Boolean(user.activeBanId),
    disabledReason,
  };
}

export const searchTargets = query({
  args: { search: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const search = args.search.trim().toLowerCase().replace(/^@/, "");
    if (!search || search.length > 200) return [];
    const users = await ctx.db.query("users").collect();
    return users
      .filter(
        (user) =>
          !user.isDeleted &&
          (user._id.toLowerCase().includes(search) ||
            (user.discordUsername?.toLowerCase().includes(search) ?? false)),
      )
      .slice(0, 20)
      .map((user) => targetSummary(actor, user));
  },
});

export const sidebarTarget = query({
  args: { googleId: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_googleId", (q) => q.eq("googleId", args.googleId))
      .first();
    return user && !user.isDeleted ? targetSummary(actor, user) : null;
  },
});

// Explicitly select fields: recipient email and internal delivery details never
// leave the backend. Resolve labels afresh to protect legacy email-based labels.
async function publicRecord(ctx: QueryCtx, record: Doc<"moderationActions">) {
  const [target, actor, revoker] = await Promise.all([
    ctx.db.get(record.targetUserId),
    ctx.db.get(record.actorUserId),
    record.revokedBy ? ctx.db.get(record.revokedBy) : null,
  ]);
  return {
    _id: record._id,
    targetUserId: record.targetUserId,
    targetLabel: moderationLabel(target, record.targetUserId),
    actorLabel: moderationLabel(actor, record.actorUserId),
    kind: record.kind,
    reason: record.reason,
    createdAt: record.createdAt,
    acknowledgedAt: record.acknowledgedAt,
    revokedAt: record.revokedAt,
    revokedByLabel: record.revokedBy
      ? moderationLabel(revoker, record.revokedBy)
      : undefined,
    revokeReason: record.revokeReason,
    emailStatus: record.emailStatus,
    emailAttempts: record.emailAttempts,
    emailLastError: record.emailLastError
      ? "Email could not be sent. Check notification configuration."
      : undefined,
  };
}

export const issue = mutation({
  args: {
    targetUserId: v.id("users"),
    kind: v.union(v.literal("warn"), v.literal("ban")),
    reason: v.string(),
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const reason = moderationReason(args.reason);
    if (!args.requestId || args.requestId.length > 100)
      throw new Error("Invalid request ID");
    const previous = await ctx.db
      .query("moderationActions")
      .withIndex("by_actor_request", (q) =>
        q.eq("actorUserId", actor._id).eq("requestId", args.requestId),
      )
      .first();
    if (previous) {
      if (
        previous.targetUserId !== args.targetUserId ||
        previous.kind !== args.kind ||
        previous.reason !== reason
      )
        throw new Error("Request ID already used");
      return previous._id;
    }
    const target = await ctx.db.get(args.targetUserId);
    assertModerationTarget(actor, target);
    if (!target) throw new Error("User not found");
    if (target.activeBanId)
      throw new Error(
        "This user is already banned. Only the super-admin can lift the ban.",
      );
    const createdAt = Date.now();
    const id = await ctx.db.insert("moderationActions", {
      targetUserId: target._id,
      targetLabel: moderationLabel(target, target._id),
      targetEmail: target.email,
      actorUserId: actor._id,
      actorLabel: moderationLabel(actor, actor._id),
      kind: args.kind,
      reason,
      createdAt,
      requestId: args.requestId,
      emailStatus: "pending",
      emailAttempts: 0,
    });
    if (args.kind === "ban") {
      await ctx.db.patch(target._id, { activeBanId: id });
      const trackers = await ctx.db
        .query("activeTrackers")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", target.clerkId))
        .collect();
      for (const tracker of trackers) await ctx.db.delete(tracker._id);
      const sessions = await ctx.db
        .query("activeFlightSessions")
        .withIndex("by_userId", (q) => q.eq("userId", target._id))
        .collect();
      for (const session of sessions) await ctx.db.delete(session._id);
    }
    await logAdminTelemetry(ctx, {
      actorClerkId: actor.clerkId,
      targetClerkId: target.clerkId,
      action: args.kind,
      resourceType: "user_moderation",
      resourceId: id,
      resourceLabel: moderationLabel(target, target._id),
      metadata: { reason, targetUserId: target._id },
    });
    await ctx.scheduler.runAfter(0, internal.moderationEmail.send, { id });
    return id;
  },
});

export const revoke = mutation({
  args: { id: v.id("moderationActions"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    if (actor.googleId !== SUPER_ADMIN_GOOGLE_ID)
      throw new Error("Only the super-admin can override moderation actions");
    const reason = moderationReason(args.reason);
    const record = await ctx.db.get(args.id);
    if (!record) throw new Error("Moderation action not found");
    if (record.revokedAt)
      throw new Error("This action has already been overridden");
    const target = await ctx.db.get(record.targetUserId);
    await ctx.db.patch(record._id, {
      revokedAt: Date.now(),
      revokedBy: actor._id,
      revokedByLabel: moderationLabel(actor, actor._id),
      revokeReason: reason,
    });
    if (record.kind === "ban" && target?.activeBanId === record._id)
      await ctx.db.patch(target._id, { activeBanId: undefined });
    await logAdminTelemetry(ctx, {
      actorClerkId: actor.clerkId,
      targetClerkId: target?.clerkId,
      action: record.kind === "ban" ? "lift_ban" : "revoke_warning",
      resourceType: "user_moderation",
      resourceId: record._id,
      resourceLabel: moderationLabel(target, record.targetUserId),
      metadata: {
        reason,
        originalReason: record.reason,
        originalActor: moderationLabel(
          await ctx.db.get(record.actorUserId),
          record.actorUserId,
        ),
        targetUserId: record.targetUserId,
      },
    });
  },
});

export const history = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const actor = await getCurrentUser(ctx);
    if (
      !actor ||
      actor.isDeleted ||
      actor.activeBanId ||
      (actor.role !== "ADMIN" && actor.googleId !== SUPER_ADMIN_GOOGLE_ID)
    ) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const records =
      actor.googleId === SUPER_ADMIN_GOOGLE_ID
        ? ctx.db.query("moderationActions").withIndex("by_createdAt")
        : ctx.db
            .query("moderationActions")
            .withIndex("by_actor_createdAt", (q) =>
              q.eq("actorUserId", actor._id),
            );
    const page = await records.order("desc").paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map((record) => publicRecord(ctx, record)),
      ),
    };
  },
});

export const targetHistory = query({
  args: {
    targetUserId: v.id("users"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const actor = await getCurrentUser(ctx);
    if (
      !actor ||
      actor.isDeleted ||
      actor.activeBanId ||
      (actor.role !== "ADMIN" && actor.googleId !== SUPER_ADMIN_GOOGLE_ID)
    ) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const page = await ctx.db
      .query("moderationActions")
      .withIndex("by_target_createdAt", (q) =>
        q.eq("targetUserId", args.targetUserId),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map((record) => publicRecord(ctx, record)),
      ),
    };
  },
});

// Only the account owner can read their notices; no actor details are exposed.
export const myStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    const ban = user.activeBanId ? await ctx.db.get(user.activeBanId) : null;
    const warnings = await ctx.db
      .query("moderationActions")
      .withIndex("by_target_pending", (q) =>
        q
          .eq("targetUserId", user._id)
          .eq("kind", "warn")
          .eq("revokedAt", undefined)
          .eq("acknowledgedAt", undefined),
      )
      .take(50);
    const notice = (r: NonNullable<typeof ban>) => ({
      id: r._id,
      reason: r.reason,
      createdAt: r.createdAt,
    });
    return {
      ban: ban ? notice(ban) : null,
      warnings: warnings.map(notice),
      checkedAt: Date.now(),
    };
  },
});

export const acknowledge = mutation({
  args: { id: v.id("moderationActions") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const record = await ctx.db.get(args.id);
    if (!user || record?.targetUserId !== user._id || record.kind !== "warn")
      throw new Error("Unauthorized");
    if (!record.acknowledgedAt && !record.revokedAt)
      await ctx.db.patch(record._id, { acknowledgedAt: Date.now() });
  },
});

export const emailRecord = internalQuery({
  args: { id: v.id("moderationActions") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});
export const emailResult = internalMutation({
  args: {
    id: v.id("moderationActions"),
    sent: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record || record.emailStatus === "sent") return;
    const attempts = record.emailAttempts + 1;
    const retry =
      !args.sent &&
      attempts < 6 &&
      Date.now() - record.createdAt < 20 * 60 * 60 * 1000;
    await ctx.db.patch(args.id, {
      emailStatus: args.sent ? "sent" : retry ? "pending" : "failed",
      emailAttempts: attempts,
      emailLastError: args.error,
      emailSentAt: args.sent ? Date.now() : undefined,
    });
    if (retry)
      await ctx.scheduler.runAfter(
        60_000 * 2 ** attempts,
        internal.moderationEmail.send,
        { id: args.id },
      );
  },
});
