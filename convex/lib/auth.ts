import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

const SUPER_ADMIN_EMAIL = "mansoor.eb.ak@gmail.com";

type AuthCtx = QueryCtx | MutationCtx;

export async function getCurrentUser(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();
}

export function isSystemSecretValid(systemSecret?: string) {
  const expected = process.env.BOT_API_SECRET;
  if (!expected || !systemSecret) return false;

  const encoder = new TextEncoder();
  const expectedBytes = encoder.encode(expected);
  const providedBytes = encoder.encode(systemSecret);
  if (expectedBytes.length !== providedBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < expectedBytes.length; i++) {
    diff |= (expectedBytes[i] ?? 0) ^ (providedBytes[i] ?? 0);
  }
  return diff === 0;
}

export async function requireAuthenticatedClerkId(
  ctx: AuthCtx,
  clerkId?: string,
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("Unauthorized");
  }

  if (clerkId && clerkId !== identity.subject) {
    throw new Error("Unauthorized");
  }

  return identity.subject;
}

export function requireSystem(ctx: AuthCtx, systemSecret?: string) {
  if (!isSystemSecretValid(systemSecret)) {
    throw new Error("Unauthorized");
  }
}

export async function requireAdmin(
  ctx: AuthCtx,
  options: { actorClerkId?: string; systemSecret?: string } = {},
) {
  const identity = await ctx.auth.getUserIdentity();

  let actorClerkId = identity?.subject;
  if (isSystemSecretValid(options.systemSecret)) {
    actorClerkId = options.actorClerkId ?? actorClerkId;
  }

  if (!actorClerkId) {
    throw new Error("Unauthorized");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", actorClerkId))
    .first();

  const actorEmail =
    actorClerkId === identity?.subject ? identity.email : undefined;
  const isSuperAdmin =
    actorEmail?.trim()?.toLowerCase() === SUPER_ADMIN_EMAIL ||
    user?.email?.trim()?.toLowerCase() === SUPER_ADMIN_EMAIL ||
    (process.env.ADMIN_GOOGLE_ID !== undefined &&
      user?.googleId === process.env.ADMIN_GOOGLE_ID);

  if (!user || user.isDeleted || (user.role !== "ADMIN" && !isSuperAdmin)) {
    throw new Error("Unauthorized");
  }

  return user;
}

export async function requireVirtualAirlineManager(
  ctx: AuthCtx,
  virtualAirlineId: Id<"virtualAirlines">,
  options: { actorClerkId?: string; systemSecret?: string } = {},
) {
  const virtualAirline = await ctx.db.get(virtualAirlineId);
  if (!virtualAirline) {
    throw new Error("Virtual airline not found");
  }

  const identity = await ctx.auth.getUserIdentity();
  let actorClerkId = identity?.subject;
  if (isSystemSecretValid(options.systemSecret)) {
    actorClerkId = options.actorClerkId ?? actorClerkId;
  }

  if (!actorClerkId) {
    throw new Error("Unauthorized");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", actorClerkId))
    .first();

  const isSiteAdmin =
    user?.role === "ADMIN" ||
    user?.email?.trim()?.toLowerCase() === SUPER_ADMIN_EMAIL ||
    (process.env.ADMIN_GOOGLE_ID !== undefined &&
      user?.googleId === process.env.ADMIN_GOOGLE_ID);

  if (
    !user ||
    user.isDeleted ||
    (!isSiteAdmin && actorClerkId !== virtualAirline.adminClerkId)
  ) {
    throw new Error("Unauthorized");
  }

  return { user, virtualAirline, isSiteAdmin };
}

export async function requireAnyVirtualAirlineManager(ctx: AuthCtx) {
  const actorClerkId = await requireAuthenticatedClerkId(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", actorClerkId))
    .first();

  const isSiteAdmin =
    user?.role === "ADMIN" ||
    user?.email?.trim()?.toLowerCase() === SUPER_ADMIN_EMAIL ||
    (process.env.ADMIN_GOOGLE_ID !== undefined &&
      user?.googleId === process.env.ADMIN_GOOGLE_ID);

  if (user?.isDeleted) {
    throw new Error("Unauthorized");
  }

  if (isSiteAdmin) return user;

  const managedVirtualAirline = await ctx.db
    .query("virtualAirlines")
    .withIndex("by_adminClerkId", (q) => q.eq("adminClerkId", actorClerkId))
    .first();

  if (!managedVirtualAirline) {
    throw new Error("Unauthorized");
  }

  if (!user || user.isDeleted) {
    throw new Error("Unauthorized");
  }

  return user;
}
