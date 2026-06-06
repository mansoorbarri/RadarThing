import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logAdminTelemetry } from "./adminTelemetry";
import type { Doc } from "./_generated/dataModel";
import {
  requireAdmin,
  requireAuthenticatedClerkId,
  requireVirtualAirlineManager,
} from "./lib/auth";

function normalizeCallsignPrefix(prefix: string): string {
  return prefix.trim().toUpperCase().replace(/\s+/g, "");
}

function normalizeCallsign(callsign: string): string {
  return callsign.trim().toUpperCase().replace(/\s+/g, "");
}

function normalizeAircraftTypeKey(aircraftType: string): string {
  const cleaned = aircraftType.trim().toUpperCase();
  const atrMatch = /\bATR?[\s-]?(\d{2})\b/.exec(cleaned);
  if (atrMatch) return `ATR${atrMatch[1]}`;
  const poseidonMatch = /\bP-?8(?:I)?\b/.exec(cleaned);
  if (poseidonMatch) return "P8";
  const ilyushinMatch = /\bIL-?76(?:[A-Z0-9-]*)/.exec(cleaned);
  if (ilyushinMatch) return "IL76";
  const antonovMatch = /\bAN-?(\d{2,3})\b/.exec(cleaned);
  if (antonovMatch) return `AN${antonovMatch[1]}`;
  return cleaned;
}

function toVirtualAirlineSummary(virtualAirline: Doc<"virtualAirlines">) {
  return {
    id: virtualAirline._id,
    name: virtualAirline.name,
    callsignPrefix: virtualAirline.callsignPrefix,
    adminClerkId: virtualAirline.adminClerkId,
    website: virtualAirline.website ?? null,
    isActive: virtualAirline.isActive,
    createdBy: virtualAirline.createdBy,
    createdAt: virtualAirline._creationTime,
    updatedAt: virtualAirline.updatedAt,
  };
}

function toVirtualAirlineImageSummary(
  image: Doc<"virtualAirlineAircraftImages">,
) {
  return {
    id: image._id,
    virtualAirlineId: image.virtualAirlineId,
    aircraftType: image.aircraftType,
    imageUrl: image.imageUrl,
    imageKey: image.imageKey ?? null,
    uploadedBy: image.uploadedBy,
    createdAt: image._creationTime,
    updatedAt: image.updatedAt,
  };
}

async function getMatchingVirtualAirline(ctx: any, callsign: string) {
  const normalizedCallsign = normalizeCallsign(callsign);
  if (!normalizedCallsign) return null;

  const activeVirtualAirlines = await ctx.db
    .query("virtualAirlines")
    .withIndex("by_isActive", (q: any) => q.eq("isActive", true))
    .collect();

  let bestMatch: Doc<"virtualAirlines"> | null = null;

  for (const virtualAirline of activeVirtualAirlines) {
    if (!normalizedCallsign.startsWith(virtualAirline.callsignPrefix)) continue;

    if (
      !bestMatch ||
      virtualAirline.callsignPrefix.length > bestMatch.callsignPrefix.length
    ) {
      bestMatch = virtualAirline;
    }
  }

  return bestMatch;
}

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const virtualAirlines = await ctx.db.query("virtualAirlines").collect();

    return virtualAirlines
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map(toVirtualAirlineSummary);
  },
});

export const getById = query({
  args: {
    id: v.id("virtualAirlines"),
  },
  handler: async (ctx, args) => {
    const virtualAirline = await ctx.db.get(args.id);
    return virtualAirline ? toVirtualAirlineSummary(virtualAirline) : null;
  },
});

export const getByCallsignPrefix = query({
  args: {
    callsignPrefix: v.string(),
  },
  handler: async (ctx, args) => {
    const virtualAirline = await ctx.db
      .query("virtualAirlines")
      .withIndex("by_callsignPrefix", (q) =>
        q.eq("callsignPrefix", normalizeCallsignPrefix(args.callsignPrefix)),
      )
      .first();

    return virtualAirline ? toVirtualAirlineSummary(virtualAirline) : null;
  },
});

export const getManagedByAdmin = query({
  args: {
    adminClerkId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.adminClerkId);

    const virtualAirlines = await ctx.db
      .query("virtualAirlines")
      .withIndex("by_adminClerkId", (q) =>
        q.eq("adminClerkId", args.adminClerkId),
      )
      .collect();

    return virtualAirlines
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map(toVirtualAirlineSummary);
  },
});

export const getByCallsign = query({
  args: {
    callsign: v.string(),
  },
  handler: async (ctx, args) => {
    const virtualAirline = await getMatchingVirtualAirline(ctx, args.callsign);
    return virtualAirline ? toVirtualAirlineSummary(virtualAirline) : null;
  },
});

export const getFlightContext = query({
  args: {
    callsign: v.string(),
    aircraftType: v.optional(v.string()),
    aircraftTypes: v.optional(v.array(v.string())),
    googleId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const googleId = args.googleId?.trim();
    if (!googleId) {
      return {
        virtualAirline: null,
        image: null,
      };
    }

    const directMembership = await ctx.db
      .query("virtualAirlineMembers")
      .withIndex("by_googleId", (q) => q.eq("googleId", googleId))
      .first();
    let virtualAirlineId = directMembership?.virtualAirlineId ?? null;

    // Treat the assigned VA owner as an implicit member so new VAs work
    // immediately even before the roster table is populated.
    if (!virtualAirlineId) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_googleId", (q) => q.eq("googleId", googleId))
        .first();

      if (!user) {
        return {
          virtualAirline: null,
          image: null,
        };
      }

      const matchingVirtualAirline = await getMatchingVirtualAirline(
        ctx,
        args.callsign,
      );

      if (matchingVirtualAirline?.adminClerkId !== user.clerkId) {
        return {
          virtualAirline: null,
          image: null,
        };
      }

      virtualAirlineId = matchingVirtualAirline._id;
    }

    const virtualAirline = await ctx.db.get(virtualAirlineId);
    if (!virtualAirline) {
      return {
        virtualAirline: null,
        image: null,
      };
    }

    if (!virtualAirline.isActive) {
      return {
        virtualAirline: null,
        image: null,
      };
    }

    const normalizedCallsign = normalizeCallsign(args.callsign);
    if (!normalizedCallsign.startsWith(virtualAirline.callsignPrefix)) {
      return {
        virtualAirline: null,
        image: null,
      };
    }

    let image = null;
    const aircraftTypes = Array.from(
      new Set(
        (args.aircraftTypes ?? [])
          .map((aircraftType) => aircraftType.trim())
          .filter(Boolean)
          .map(normalizeAircraftTypeKey),
      ),
    );

    if (aircraftTypes.length === 0 && args.aircraftType?.trim()) {
      aircraftTypes.push(normalizeAircraftTypeKey(args.aircraftType));
    }

    for (const aircraftType of aircraftTypes) {
      const matchingImage = await ctx.db
        .query("virtualAirlineAircraftImages")
        .withIndex("by_virtualAirlineId_aircraftType", (q) =>
          q
            .eq("virtualAirlineId", virtualAirline._id)
            .eq("aircraftType", aircraftType),
        )
        .first();

      if (matchingImage) {
        image = toVirtualAirlineImageSummary(matchingImage);
        break;
      }
    }

    return {
      virtualAirline: toVirtualAirlineSummary(virtualAirline),
      image,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    callsignPrefix: v.string(),
    adminClerkId: v.string(),
    website: v.optional(v.string()),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, { actorClerkId: args.createdBy });
    const now = Date.now();
    const id = await ctx.db.insert("virtualAirlines", {
      name: args.name.trim(),
      callsignPrefix: normalizeCallsignPrefix(args.callsignPrefix),
      adminClerkId: args.adminClerkId,
      website: args.website,
      isActive: true,
      createdBy: actor.clerkId,
      updatedAt: now,
    });

    const virtualAirline = await ctx.db.get(id);
    if (virtualAirline) {
      await logAdminTelemetry(ctx, {
        actorClerkId: actor.clerkId,
        action: "create",
        resourceType: "virtual_airline",
        resourceId: virtualAirline._id,
        resourceLabel: `${virtualAirline.name} (${virtualAirline.callsignPrefix})`,
        targetClerkId: virtualAirline.adminClerkId,
        metadata: {
          callsignPrefix: virtualAirline.callsignPrefix,
          adminClerkId: virtualAirline.adminClerkId,
          website: virtualAirline.website ?? null,
        },
      });
    }
    return virtualAirline ? toVirtualAirlineSummary(virtualAirline) : null;
  },
});

export const update = mutation({
  args: {
    id: v.id("virtualAirlines"),
    name: v.string(),
    callsignPrefix: v.string(),
    adminClerkId: v.string(),
    website: v.optional(v.string()),
    isActive: v.boolean(),
    actorClerkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user: actor } = await requireVirtualAirlineManager(ctx, args.id, {
      actorClerkId: args.actorClerkId,
    });
    const existing = await ctx.db.get(args.id);
    if (!existing) return null;

    const isSiteAdmin = actor.role === "ADMIN";
    if (
      !isSiteAdmin &&
      (args.adminClerkId !== existing.adminClerkId ||
        args.isActive !== existing.isActive)
    ) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.id, {
      name: args.name.trim(),
      callsignPrefix: normalizeCallsignPrefix(args.callsignPrefix),
      adminClerkId: args.adminClerkId,
      website: args.website,
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    const virtualAirline = await ctx.db.get(args.id);
    if (virtualAirline) {
      await logAdminTelemetry(ctx, {
        actorClerkId: actor.clerkId,
        action: "edit",
        resourceType: "virtual_airline",
        resourceId: virtualAirline._id,
        resourceLabel: `${virtualAirline.name} (${virtualAirline.callsignPrefix})`,
        targetClerkId: virtualAirline.adminClerkId,
        metadata: {
          before: {
            name: existing.name,
            callsignPrefix: existing.callsignPrefix,
            adminClerkId: existing.adminClerkId,
            website: existing.website ?? null,
            isActive: existing.isActive,
          },
          after: {
            name: virtualAirline.name,
            callsignPrefix: virtualAirline.callsignPrefix,
            adminClerkId: virtualAirline.adminClerkId,
            website: virtualAirline.website ?? null,
            isActive: virtualAirline.isActive,
          },
        },
      });
    }
    return virtualAirline ? toVirtualAirlineSummary(virtualAirline) : null;
  },
});

export const setActive = mutation({
  args: {
    id: v.id("virtualAirlines"),
    isActive: v.boolean(),
    actorClerkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, { actorClerkId: args.actorClerkId });
    const existing = await ctx.db.get(args.id);
    if (!existing) return null;

    await ctx.db.patch(args.id, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    const virtualAirline = await ctx.db.get(args.id);
    if (virtualAirline) {
      await logAdminTelemetry(ctx, {
        actorClerkId: actor.clerkId,
        action: "edit",
        resourceType: "virtual_airline",
        resourceId: virtualAirline._id,
        resourceLabel: `${virtualAirline.name} (${virtualAirline.callsignPrefix})`,
        targetClerkId: virtualAirline.adminClerkId,
        metadata: {
          before: { isActive: existing.isActive },
          after: { isActive: virtualAirline.isActive },
        },
      });
    }
    return virtualAirline ? toVirtualAirlineSummary(virtualAirline) : null;
  },
});

export const remove = mutation({
  args: {
    id: v.id("virtualAirlines"),
    actorClerkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, { actorClerkId: args.actorClerkId });
    const virtualAirline = await ctx.db.get(args.id);
    if (!virtualAirline) return null;

    const [members, images] = await Promise.all([
      ctx.db
        .query("virtualAirlineMembers")
        .withIndex("by_virtualAirlineId", (q) =>
          q.eq("virtualAirlineId", args.id),
        )
        .collect(),
      ctx.db
        .query("virtualAirlineAircraftImages")
        .withIndex("by_virtualAirlineId", (q) =>
          q.eq("virtualAirlineId", args.id),
        )
        .collect(),
    ]);

    await Promise.all([
      ...members.map((member) => ctx.db.delete(member._id)),
      ...images.map((image) => ctx.db.delete(image._id)),
    ]);

    await ctx.db.delete(args.id);

    await logAdminTelemetry(ctx, {
      actorClerkId: actor.clerkId,
      action: "delete",
      resourceType: "virtual_airline",
      resourceId: virtualAirline._id,
      resourceLabel: `${virtualAirline.name} (${virtualAirline.callsignPrefix})`,
      targetClerkId: virtualAirline.adminClerkId,
      metadata: {
        callsignPrefix: virtualAirline.callsignPrefix,
        adminClerkId: virtualAirline.adminClerkId,
        memberCount: members.length,
        imageCount: images.length,
      },
    });

    return {
      id: virtualAirline._id,
      imageKeys: images
        .map((image) => image.imageKey)
        .filter((imageKey): imageKey is string => Boolean(imageKey)),
      memberCount: members.length,
      imageCount: images.length,
    };
  },
});
