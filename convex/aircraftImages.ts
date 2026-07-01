import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { logAdminTelemetry } from "./adminTelemetry";
import {
  requireAdmin,
  requireAuthenticatedClerkId,
  requireSystem,
} from "./lib/auth";

async function incrementApprovedAircraftImages(ctx: any, uploadedBy: string) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q: any) => q.eq("clerkId", uploadedBy))
    .first();
  if (!user) return;

  const stats = await ctx.db
    .query("userStats")
    .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
    .first();

  if (stats) {
    await ctx.db.patch(stats._id, {
      approvedAircraftImages: (stats.approvedAircraftImages ?? 0) + 1,
    });
    return;
  }

  await ctx.db.insert("userStats", {
    userId: user._id,
    totalFlights: 0,
    totalFlightTimeMs: 0,
    totalDistanceNm: 0,
    approvedAircraftImages: 1,
    streakAtLastFlight: 0,
    longestStreak: 0,
  });
}

function normalizeAircraftTypeKey(aircraftType: string): string {
  const cleaned = aircraftType.trim().toUpperCase();
  const learjetMatch =
    /\b(?:LEARJET|LEAR\s+JET)\s*(\d{2})\b/.exec(cleaned) ||
    /\bLJ[-\s]?(\d{2})\b/.exec(cleaned);
  if (learjetMatch) {
    return `LJ${learjetMatch[1]}`;
  }
  if (
    /\bCHALLENGER\b.*\b6(?:00|01|04|05|50)\b/.test(cleaned) ||
    /\bCL[-\s]?6(?:00|01|04|05|50)\b/.test(cleaned)
  ) {
    return "CL60";
  }
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

async function getUploaderDiscordUsername(
  ctx: QueryCtx | MutationCtx,
  uploadedBy: string,
) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", uploadedBy))
    .first();

  return user?.discordUsername ?? null;
}

async function getUploaderDiscordUsernames(
  ctx: QueryCtx | MutationCtx,
  images: Doc<"aircraftImages">[],
) {
  const uploadedByValues = Array.from(
    new Set(images.map((image) => image.uploadedBy)),
  );
  const users = await Promise.all(
    uploadedByValues.map((uploadedBy) =>
      ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", uploadedBy))
        .first(),
    ),
  );

  return new Map(
    uploadedByValues.map((uploadedBy, index) => [
      uploadedBy,
      users[index]?.discordUsername ?? null,
    ]),
  );
}

async function aircraftImageResponse(
  ctx: QueryCtx | MutationCtx,
  image: Doc<"aircraftImages">,
  uploaderDiscordUsernames?: Map<string, string | null>,
) {
  const discordUsername = uploaderDiscordUsernames?.has(image.uploadedBy)
    ? (uploaderDiscordUsernames.get(image.uploadedBy) ?? null)
    : await getUploaderDiscordUsername(ctx, image.uploadedBy);

  return {
    id: image._id,
    airlineIata: image.airlineIata,
    airlineIcao: image.airlineIcao,
    aircraftType: image.aircraftType,
    imageUrl: image.imageUrl,
    imageKey: image.imageKey ?? null,
    discordUsername,
    isMilitary: image.isMilitary ?? false,
    isApproved: image.isApproved,
    uploadedBy: image.uploadedBy,
    approvedBy: image.approvedBy ?? null,
    approvedAt: image.approvedAt ?? null,
    createdAt: image._creationTime,
    updatedAt: image._creationTime,
  };
}

// Get approved image for a specific airline + aircraft type
// Accepts either IATA (2-letter) or ICAO (3-letter) code
export const getApprovedImage = query({
  args: {
    airlineCode: v.string(), // Can be IATA or ICAO
    aircraftType: v.string(),
  },
  handler: async (ctx, args) => {
    const code = args.airlineCode.toUpperCase();
    const aircraftType = normalizeAircraftTypeKey(args.aircraftType);

    // Try IATA lookup first (2-letter codes)
    let image = await ctx.db
      .query("aircraftImages")
      .withIndex("by_iata_aircraft_approved", (q) =>
        q
          .eq("airlineIata", code)
          .eq("aircraftType", aircraftType)
          .eq("isApproved", true),
      )
      .first();

    // If not found, try ICAO lookup (3-letter codes)
    if (!image) {
      image = await ctx.db
        .query("aircraftImages")
        .withIndex("by_icao_aircraft_approved", (q) =>
          q
            .eq("airlineIcao", code)
            .eq("aircraftType", aircraftType)
            .eq("isApproved", true),
        )
        .first();
    }

    if (!image) return null;

    return await aircraftImageResponse(ctx, image);
  },
});

// Get all approved images
export const getApproved = query({
  args: {},
  handler: async (ctx) => {
    const images = await ctx.db
      .query("aircraftImages")
      .withIndex("by_isApproved", (q) => q.eq("isApproved", true))
      .collect();

    // Sort by IATA code then aircraft type
    const sortedImages = images.sort((a, b) => {
      const airlineCompare = a.airlineIata.localeCompare(b.airlineIata);
      if (airlineCompare !== 0) return airlineCompare;
      return a.aircraftType.localeCompare(b.aircraftType);
    });
    const uploaderDiscordUsernames = await getUploaderDiscordUsernames(
      ctx,
      sortedImages,
    );

    return await Promise.all(
      sortedImages.map((image) =>
        aircraftImageResponse(ctx, image, uploaderDiscordUsernames),
      ),
    );
  },
});

// Get pending images (PRO only - authorization handled in server action)
export const getPending = query({
  args: {},
  handler: async (ctx) => {
    try {
      await requireAdmin(ctx);
    } catch {
      return [];
    }

    const images = await ctx.db
      .query("aircraftImages")
      .withIndex("by_isApproved", (q) => q.eq("isApproved", false))
      .order("desc")
      .collect();
    const uploaderDiscordUsernames = await getUploaderDiscordUsernames(
      ctx,
      images,
    );

    return await Promise.all(
      images.map((image) =>
        aircraftImageResponse(ctx, image, uploaderDiscordUsernames),
      ),
    );
  },
});

// Get all images (PRO only)
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    try {
      await requireAdmin(ctx);
    } catch {
      return [];
    }

    const images = await ctx.db.query("aircraftImages").collect();

    // Sort: pending first (isApproved: false), then by createdAt descending
    const sortedImages = images.sort((a, b) => {
      // Pending first
      if (a.isApproved !== b.isApproved) {
        return a.isApproved ? 1 : -1;
      }
      // Then by creation time descending
      return b._creationTime - a._creationTime;
    });
    const uploaderDiscordUsernames = await getUploaderDiscordUsernames(
      ctx,
      sortedImages,
    );

    return await Promise.all(
      sortedImages.map((image) =>
        aircraftImageResponse(ctx, image, uploaderDiscordUsernames),
      ),
    );
  },
});

// Get image by ID
export const getById = query({
  args: { id: v.id("aircraftImages") },
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.id);
    if (!image) return null;

    return await aircraftImageResponse(ctx, image);
  },
});

// Check if approved image exists for airline + aircraft
export const checkApprovedExists = query({
  args: {
    airlineIata: v.string(),
    airlineIcao: v.string(),
    aircraftType: v.string(),
  },
  handler: async (ctx, args) => {
    const aircraftType = normalizeAircraftTypeKey(args.aircraftType);
    const iata = args.airlineIata.toUpperCase();
    const icao = args.airlineIcao.toUpperCase();

    // Check by IATA + ICAO + aircraft combo
    const image = await ctx.db
      .query("aircraftImages")
      .withIndex("by_iata_icao_aircraft_approved", (q) =>
        q
          .eq("airlineIata", iata)
          .eq("airlineIcao", icao)
          .eq("aircraftType", aircraftType)
          .eq("isApproved", true),
      )
      .first();

    return image !== null;
  },
});

// Check if user has pending image for airline + aircraft
export const checkPendingByUser = query({
  args: {
    airlineIata: v.string(),
    airlineIcao: v.string(),
    aircraftType: v.string(),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const aircraftType = normalizeAircraftTypeKey(args.aircraftType);
    const iata = args.airlineIata.toUpperCase();
    const icao = args.airlineIcao.toUpperCase();

    // Find pending images by this user for this combo (match IATA + ICAO + aircraft)
    const image = await ctx.db
      .query("aircraftImages")
      .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", args.uploadedBy))
      .filter((q) =>
        q.and(
          q.eq(q.field("airlineIata"), iata),
          q.eq(q.field("airlineIcao"), icao),
          q.eq(q.field("aircraftType"), aircraftType),
          q.eq(q.field("isApproved"), false),
        ),
      )
      .first();

    return image !== null;
  },
});

// Create aircraft image
export const create = mutation({
  args: {
    airlineIata: v.string(),
    airlineIcao: v.string(),
    aircraftType: v.string(),
    imageUrl: v.string(),
    imageKey: v.optional(v.string()),
    isMilitary: v.optional(v.boolean()),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const uploadedBy = await requireAuthenticatedClerkId(ctx, args.uploadedBy);

    const id = await ctx.db.insert("aircraftImages", {
      airlineIata: args.airlineIata.toUpperCase(),
      airlineIcao: args.airlineIcao.toUpperCase(),
      aircraftType: normalizeAircraftTypeKey(args.aircraftType),
      imageUrl: args.imageUrl,
      imageKey: args.imageKey,
      isMilitary: args.isMilitary,
      isApproved: false,
      uploadedBy,
    });

    const image = await ctx.db.get(id);
    if (!image) return null;

    await logAdminTelemetry(ctx, {
      actorClerkId: uploadedBy,
      action: "upload",
      resourceType: "aircraft_image",
      resourceId: image._id,
      resourceLabel: `${image.airlineIata}/${image.airlineIcao} ${image.aircraftType}`,
      targetClerkId: image.uploadedBy,
      metadata: {
        airlineIata: image.airlineIata,
        airlineIcao: image.airlineIcao,
        aircraftType: image.aircraftType,
        isMilitary: image.isMilitary ?? false,
        discordUsername: await getUploaderDiscordUsername(ctx, image.uploadedBy),
      },
    });

    return await aircraftImageResponse(ctx, image);
  },
});

// Approve aircraft image
export const approve = mutation({
  args: {
    id: v.id("aircraftImages"),
    approvedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, { actorClerkId: args.approvedBy });
    const image = await ctx.db.get(args.id);
    if (!image || image.isApproved) return;

    await ctx.db.patch(args.id, {
      isApproved: true,
      approvedBy: actor.clerkId,
      approvedAt: Date.now(),
    });

    await incrementApprovedAircraftImages(ctx, image.uploadedBy);

    await logAdminTelemetry(ctx, {
      actorClerkId: actor.clerkId,
      action: "approve",
      resourceType: "aircraft_image",
      resourceId: image._id,
      resourceLabel: `${image.airlineIata}/${image.airlineIcao} ${image.aircraftType}`,
      targetClerkId: image.uploadedBy,
      metadata: {
        airlineIata: image.airlineIata,
        airlineIcao: image.airlineIcao,
        aircraftType: image.aircraftType,
      },
    });
  },
});

// Delete aircraft image
export const remove = mutation({
  args: {
    id: v.id("aircraftImages"),
    actorClerkId: v.optional(v.string()),
    action: v.optional(v.union(v.literal("reject"), v.literal("delete"))),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, { actorClerkId: args.actorClerkId });
    const image = await ctx.db.get(args.id);
    if (!image) return;

    await ctx.db.delete(args.id);

    await logAdminTelemetry(ctx, {
      actorClerkId: actor.clerkId,
      action: args.action ?? "delete",
      resourceType: "aircraft_image",
      resourceId: image._id,
      resourceLabel: `${image.airlineIata}/${image.airlineIcao} ${image.aircraftType}`,
      targetClerkId: image.uploadedBy,
      metadata: {
        airlineIata: image.airlineIata,
        airlineIcao: image.airlineIcao,
        aircraftType: image.aircraftType,
        wasApproved: image.isApproved,
        reason: args.reason,
      },
    });
  },
});

// Bulk approve aircraft images (single mutation for multiple images)
export const bulkApprove = mutation({
  args: {
    ids: v.array(v.id("aircraftImages")),
    approvedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, { actorClerkId: args.approvedBy });
    const results: {
      id: string;
      success: boolean;
      existingImageKey?: string;
    }[] = [];
    const now = Date.now();

    for (const id of args.ids) {
      const image = await ctx.db.get(id);
      if (!image) {
        results.push({ id, success: false });
        continue;
      }

      // Check for existing approved image (by IATA + ICAO + aircraft combo)
      const existingApproved = await ctx.db
        .query("aircraftImages")
        .withIndex("by_iata_icao_aircraft_approved", (q) =>
          q
            .eq("airlineIata", image.airlineIata)
            .eq("airlineIcao", image.airlineIcao)
            .eq("aircraftType", image.aircraftType)
            .eq("isApproved", true),
        )
        .first();

      // Delete existing approved image if found (and not the same image)
      let existingImageKey: string | undefined;
      if (existingApproved && existingApproved._id !== id) {
        existingImageKey = existingApproved.imageKey ?? undefined;
        await ctx.db.delete(existingApproved._id);
        await logAdminTelemetry(ctx, {
          actorClerkId: actor.clerkId,
          action: "delete",
          resourceType: "aircraft_image",
          resourceId: existingApproved._id,
          resourceLabel: `${existingApproved.airlineIata}/${existingApproved.airlineIcao} ${existingApproved.aircraftType}`,
          targetClerkId: existingApproved.uploadedBy,
          metadata: {
            replacedByImageId: String(id),
            reason: "Replaced by bulk approval",
          },
        });
      }

      // Approve the new image
      if (!image.isApproved) {
        await incrementApprovedAircraftImages(ctx, image.uploadedBy);
      }

      await ctx.db.patch(id, {
        isApproved: true,
        approvedBy: actor.clerkId,
        approvedAt: now,
      });

      await logAdminTelemetry(ctx, {
        actorClerkId: actor.clerkId,
        action: "approve",
        resourceType: "aircraft_image",
        resourceId: image._id,
        resourceLabel: `${image.airlineIata}/${image.airlineIcao} ${image.aircraftType}`,
        targetClerkId: image.uploadedBy,
        metadata: {
          airlineIata: image.airlineIata,
          airlineIcao: image.airlineIcao,
          aircraftType: image.aircraftType,
          bulk: true,
        },
      });

      results.push({ id, success: true, existingImageKey });
    }

    return results;
  },
});

// Bulk delete aircraft images (single mutation for multiple images)
export const bulkRemove = mutation({
  args: {
    ids: v.array(v.id("aircraftImages")),
    actorClerkId: v.optional(v.string()),
    action: v.optional(v.union(v.literal("reject"), v.literal("delete"))),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, { actorClerkId: args.actorClerkId });
    const results: {
      id: string;
      success: boolean;
      imageKey?: string;
      uploadedBy?: string;
      airlineIata?: string;
      airlineIcao?: string;
      aircraftType?: string;
    }[] = [];

    for (const id of args.ids) {
      const image = await ctx.db.get(id);
      if (!image) {
        results.push({ id, success: false });
        continue;
      }

      await ctx.db.delete(id);
      await logAdminTelemetry(ctx, {
        actorClerkId: actor.clerkId,
        action: args.action ?? "delete",
        resourceType: "aircraft_image",
        resourceId: image._id,
        resourceLabel: `${image.airlineIata}/${image.airlineIcao} ${image.aircraftType}`,
        targetClerkId: image.uploadedBy,
        metadata: {
          airlineIata: image.airlineIata,
          airlineIcao: image.airlineIcao,
          aircraftType: image.aircraftType,
          wasApproved: image.isApproved,
          bulk: true,
          reason: args.reason,
        },
      });
      results.push({
        id,
        success: true,
        imageKey: image.imageKey ?? undefined,
        uploadedBy: image.uploadedBy,
        airlineIata: image.airlineIata,
        airlineIcao: image.airlineIcao,
        aircraftType: image.aircraftType,
      });
    }

    return results;
  },
});

// Check upload eligibility in one query (combines checkApprovedExists and checkPendingByUser)
export const checkUploadEligibility = query({
  args: {
    airlineIata: v.string(),
    airlineIcao: v.string(),
    aircraftType: v.string(),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const aircraftType = normalizeAircraftTypeKey(args.aircraftType);
    const iata = args.airlineIata.toUpperCase();
    const icao = args.airlineIcao.toUpperCase();

    // Check for approved images (by IATA + ICAO + aircraft combo)
    const approvedExists = await ctx.db
      .query("aircraftImages")
      .withIndex("by_iata_icao_aircraft_approved", (q) =>
        q
          .eq("airlineIata", iata)
          .eq("airlineIcao", icao)
          .eq("aircraftType", aircraftType)
          .eq("isApproved", true),
      )
      .first();

    // Check for pending image by this user (IATA + ICAO + aircraft combo)
    const pendingByUser = await ctx.db
      .query("aircraftImages")
      .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", args.uploadedBy))
      .filter((q) =>
        q.and(
          q.eq(q.field("airlineIata"), iata),
          q.eq(q.field("airlineIcao"), icao),
          q.eq(q.field("aircraftType"), aircraftType),
          q.eq(q.field("isApproved"), false),
        ),
      )
      .first();

    return {
      approvedExists: approvedExists !== null,
      pendingByUserExists: pendingByUser !== null,
    };
  },
});

// Update airline codes for an image
export const updateCodes = mutation({
  args: {
    id: v.id("aircraftImages"),
    airlineIata: v.string(),
    airlineIcao: v.string(),
    aircraftType: v.string(),
    isMilitary: v.optional(v.boolean()),
    actorClerkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, { actorClerkId: args.actorClerkId });
    const image = await ctx.db.get(args.id);
    if (!image) return null;

    await ctx.db.patch(args.id, {
      airlineIata: args.airlineIata.toUpperCase(),
      airlineIcao: args.airlineIcao.toUpperCase(),
      aircraftType: normalizeAircraftTypeKey(args.aircraftType),
      isMilitary: args.isMilitary,
    });

    await logAdminTelemetry(ctx, {
      actorClerkId: actor.clerkId,
      action: "edit",
      resourceType: "aircraft_image",
      resourceId: image._id,
      resourceLabel: `${args.airlineIata.toUpperCase()}/${args.airlineIcao.toUpperCase()} ${normalizeAircraftTypeKey(args.aircraftType)}`,
      targetClerkId: image.uploadedBy,
      metadata: {
        before: {
          airlineIata: image.airlineIata,
          airlineIcao: image.airlineIcao,
          aircraftType: image.aircraftType,
          isMilitary: image.isMilitary ?? false,
        },
        after: {
          airlineIata: args.airlineIata.toUpperCase(),
          airlineIcao: args.airlineIcao.toUpperCase(),
          aircraftType: normalizeAircraftTypeKey(args.aircraftType),
          isMilitary: args.isMilitary ?? false,
        },
      },
    });

    const updated = await ctx.db.get(args.id);
    if (!updated) return null;

    return {
      id: updated._id,
      airlineIata: updated.airlineIata,
      airlineIcao: updated.airlineIcao,
      aircraftType: updated.aircraftType,
      imageKey: updated.imageKey ?? null,
    };
  },
});

// Find existing approved image for airline + aircraft (to delete when approving new one)
export const findExistingApproved = query({
  args: {
    airlineIata: v.string(),
    airlineIcao: v.string(),
    aircraftType: v.string(),
    excludeId: v.optional(v.id("aircraftImages")),
  },
  handler: async (ctx, args) => {
    const aircraftType = normalizeAircraftTypeKey(args.aircraftType);
    const iata = args.airlineIata.toUpperCase();
    const icao = args.airlineIcao.toUpperCase();

    // Check by IATA + ICAO + aircraft combo
    const image = await ctx.db
      .query("aircraftImages")
      .withIndex("by_iata_icao_aircraft_approved", (q) =>
        q
          .eq("airlineIata", iata)
          .eq("airlineIcao", icao)
          .eq("aircraftType", aircraftType)
          .eq("isApproved", true),
      )
      .first();

    if (!image) return null;
    if (args.excludeId && image._id === args.excludeId) return null;

    return {
      id: image._id,
      imageKey: image.imageKey ?? null,
    };
  },
});

// Get count of approved images uploaded by a specific user
export const getApprovedCountByUser = query({
  args: { uploadedBy: v.string() },
  handler: async (ctx, args) => {
    const images = await ctx.db
      .query("aircraftImages")
      .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", args.uploadedBy))
      .filter((q) => q.eq(q.field("isApproved"), true))
      .collect();

    return images.length;
  },
});

export const clearLegacySubmittedDiscordUsernames = mutation({
  args: {
    systemSecret: v.string(),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireSystem(ctx, args.systemSecret);

    const batchSize = Math.max(1, Math.min(args.batchSize ?? 100, 200));
    const images = await ctx.db
      .query("aircraftImages")
      .filter((q) => q.neq(q.field("discordUsername"), undefined))
      .take(batchSize);
    let cleared = 0;

    for (const image of images) {
      if ("discordUsername" in image) {
        await ctx.db.patch(image._id, { discordUsername: undefined } as any);
        cleared += 1;
      }
    }

    return {
      scanned: images.length,
      cleared,
      hasMore: images.length === batchSize,
    };
  },
});

// Find existing approved image with full details (for conflict resolution modal)
export const findExistingApprovedFull = query({
  args: {
    airlineIata: v.string(),
    airlineIcao: v.string(),
    aircraftType: v.string(),
    excludeId: v.optional(v.id("aircraftImages")),
  },
  handler: async (ctx, args) => {
    const aircraftType = normalizeAircraftTypeKey(args.aircraftType);
    const iata = args.airlineIata.toUpperCase();
    const icao = args.airlineIcao.toUpperCase();

    // Check by IATA + ICAO + aircraft combo
    const image = await ctx.db
      .query("aircraftImages")
      .withIndex("by_iata_icao_aircraft_approved", (q) =>
        q
          .eq("airlineIata", iata)
          .eq("airlineIcao", icao)
          .eq("aircraftType", aircraftType)
          .eq("isApproved", true),
      )
      .first();

    if (!image) return null;
    if (args.excludeId && image._id === args.excludeId) return null;

    return await aircraftImageResponse(ctx, image);
  },
});
