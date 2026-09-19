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
  | "revoke_pro"
  | "warn"
  | "ban"
  | "revoke_warning"
  | "lift_ban";

type AuditResourceType =
  | "aircraft_image"
  | "airport_chart"
  | "virtual_airline"
  | "pro_access"
  | "user_moderation";

import { moderationLabel } from "./lib/moderationRules";

const SUPER_ADMIN_GOOGLE_ID = "101233162035372298523";

async function getUserByClerkId(ctx: QueryCtx | MutationCtx, clerkId?: string) {
  if (!clerkId) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .first();
}

function isAdminTelemetryActor(
  user: Awaited<ReturnType<typeof getUserByClerkId>>,
) {
  return user?.role === "ADMIN" || user?.googleId === SUPER_ADMIN_GOOGLE_ID;
}

async function requireSuperAdmin(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) return null;

  const user = await getUserByClerkId(ctx, identity.subject);
  const isSuperAdmin = user?.googleId === SUPER_ADMIN_GOOGLE_ID;
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
  const identity = await ctx.auth.getUserIdentity();
  const [actor, target] = await Promise.all([
    getUserByClerkId(ctx, args.actorClerkId),
    getUserByClerkId(ctx, args.targetClerkId),
  ]);
  const identityActorEmail =
    identity?.subject === args.actorClerkId ? identity.email : null;

  if (!isAdminTelemetryActor(actor)) {
    return;
  }

  await ctx.db.insert("adminTelemetry", {
    actorClerkId: args.actorClerkId,
    actorUserId: actor?._id,
    actorEmail:
      args.resourceType === "user_moderation"
        ? undefined
        : (actor?.email ?? identityActorEmail ?? undefined),
    actorDiscordUsername: actor?.discordUsername,
    action: args.action,
    resourceType: args.resourceType,
    resourceId: String(args.resourceId),
    resourceLabel: args.resourceLabel.slice(0, 180),
    targetClerkId: args.targetClerkId,
    targetEmail:
      args.resourceType === "user_moderation" ? undefined : target?.email,
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

    return await Promise.all(
      events.map(async (event) => {
        if (event.resourceType === "user_moderation") {
          const id = ctx.db.normalizeId("moderationActions", event.resourceId);
          const record = id ? await ctx.db.get(id) : null;
          const [actor, target] = await Promise.all([
            event.actorUserId ? ctx.db.get(event.actorUserId) : null,
            record ? ctx.db.get(record.targetUserId) : null,
          ]);
          const actorLabel = moderationLabel(
            actor,
            event.actorUserId ?? "unavailable",
          );
          const targetLabel = moderationLabel(
            target,
            record?.targetUserId ?? "unavailable",
          );
          return {
            id: event._id,
            actorClerkId: "",
            actorEmail: null,
            actorDiscordUsername: null,
            actorLabel,
            targetLabel,
            action: event.action,
            resourceType: event.resourceType,
            resourceId: event.resourceId,
            resourceLabel: targetLabel,
            targetClerkId: null,
            targetEmail: null,
            targetDiscordUsername: null,
            metadata: {
              reason:
                typeof event.metadata?.reason === "string"
                  ? event.metadata.reason
                  : null,
            },
            createdAt: event.createdAt,
          };
        }
        return {
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
        };
      }),
    );
  },
});
