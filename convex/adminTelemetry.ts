import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server";

type AuditAction =
  | "upload"
  | "approve"
  | "reject"
  | "edit"
  | "delete"
  | "create"
  | "grant_pro"
  | "revoke_pro";

type AuditResourceType =
  | "aircraft_image"
  | "airport_chart"
  | "virtual_airline"
  | "pro_access";

const SUPER_ADMIN_EMAIL = "mansoor.eb.ak@gmail.com";

async function getUserByClerkId(ctx: QueryCtx | MutationCtx, clerkId?: string) {
  if (!clerkId) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .first();
}

async function requireSuperAdmin(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) return null;

  const user = await getUserByClerkId(ctx, identity.subject);
  const isSuperAdmin =
    identity.email?.trim().toLowerCase() === SUPER_ADMIN_EMAIL ||
    user?.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
  if (!isSuperAdmin) return null;

  return user;
}

export async function logAdminTelemetry(
  ctx: MutationCtx,
  args: {
    actorClerkId: string;
    action: AuditAction;
    resourceType: AuditResourceType;
    resourceId: string | Id<any>;
    resourceLabel: string;
    targetClerkId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const [actor, target] = await Promise.all([
    getUserByClerkId(ctx, args.actorClerkId),
    getUserByClerkId(ctx, args.targetClerkId),
  ]);

  await ctx.db.insert("adminTelemetry", {
    actorClerkId: args.actorClerkId,
    actorUserId: actor?._id,
    actorEmail: actor?.email,
    actorDiscordUsername: actor?.discordUsername,
    action: args.action,
    resourceType: args.resourceType,
    resourceId: String(args.resourceId),
    resourceLabel: args.resourceLabel.slice(0, 180),
    targetClerkId: args.targetClerkId,
    targetEmail: target?.email,
    targetDiscordUsername: target?.discordUsername,
    metadata: args.metadata,
    createdAt: Date.now(),
  });
}

export const canView = query({
  args: {},
  handler: async (ctx) => {
    return Boolean(await requireSuperAdmin(ctx));
  },
});

export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireSuperAdmin(ctx);
    if (!user) {
      return null;
    }

    const limit = Math.max(1, Math.min(args.limit ?? 100, 200));
    const events = await ctx.db
      .query("adminTelemetry")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);

    return events.map((event) => ({
      id: event._id,
      actorClerkId: event.actorClerkId,
      actorEmail: event.actorEmail ?? null,
      actorDiscordUsername: event.actorDiscordUsername ?? null,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      resourceLabel: event.resourceLabel,
      targetClerkId: event.targetClerkId ?? null,
      targetEmail: event.targetEmail ?? null,
      targetDiscordUsername: event.targetDiscordUsername ?? null,
      metadata: event.metadata ?? null,
      createdAt: event.createdAt,
    }));
  },
});
