import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get approved image for a specific airline + aircraft type
// Accepts either IATA (2-letter) or ICAO (3-letter) code
export const getApprovedImage = query({
  args: {
    airlineCode: v.string(), // Can be IATA or ICAO
    aircraftType: v.string(),
  },
  handler: async (ctx, args) => {
    const code = args.airlineCode.toUpperCase();
    const aircraftType = args.aircraftType.toUpperCase();

    // Try IATA lookup first (2-letter codes)
    let image = await ctx.db
      .query("aircraftImages")
      .withIndex("by_iata_aircraft_approved", (q) =>
        q
          .eq("airlineIata", code)
          .eq("aircraftType", aircraftType)
          .eq("isApproved", true)
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
            .eq("isApproved", true)
        )
        .first();
    }

    if (!image) return null;

    return {
      id: image._id,
      airlineIata: image.airlineIata,
      airlineIcao: image.airlineIcao,
      aircraftType: image.aircraftType,
      imageUrl: image.imageUrl,
      imageKey: image.imageKey ?? null,
      discordUsername: image.discordUsername ?? null,
      isApproved: image.isApproved,
      uploadedBy: image.uploadedBy,
      approvedBy: image.approvedBy ?? null,
      approvedAt: image.approvedAt ?? null,
      createdAt: image._creationTime,
      updatedAt: image._creationTime,
    };
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
    return images
      .sort((a, b) => {
        const airlineCompare = a.airlineIata.localeCompare(b.airlineIata);
        if (airlineCompare !== 0) return airlineCompare;
        return a.aircraftType.localeCompare(b.aircraftType);
      })
      .map((image) => ({
        id: image._id,
        airlineIata: image.airlineIata,
        airlineIcao: image.airlineIcao,
        aircraftType: image.aircraftType,
        imageUrl: image.imageUrl,
        imageKey: image.imageKey ?? null,
        discordUsername: image.discordUsername ?? null,
        isApproved: image.isApproved,
        uploadedBy: image.uploadedBy,
        approvedBy: image.approvedBy ?? null,
        approvedAt: image.approvedAt ?? null,
        createdAt: image._creationTime,
        updatedAt: image._creationTime,
      }));
  },
});

// Get pending images (PRO only - authorization handled in server action)
export const getPending = query({
  args: {},
  handler: async (ctx) => {
    const images = await ctx.db
      .query("aircraftImages")
      .withIndex("by_isApproved", (q) => q.eq("isApproved", false))
      .order("desc")
      .collect();

    return images.map((image) => ({
      id: image._id,
      airlineIata: image.airlineIata,
      airlineIcao: image.airlineIcao,
      aircraftType: image.aircraftType,
      imageUrl: image.imageUrl,
      imageKey: image.imageKey ?? null,
      discordUsername: image.discordUsername ?? null,
      isApproved: image.isApproved,
      uploadedBy: image.uploadedBy,
      approvedBy: image.approvedBy ?? null,
      approvedAt: image.approvedAt ?? null,
      createdAt: image._creationTime,
      updatedAt: image._creationTime,
    }));
  },
});

// Get all images (PRO only)
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const images = await ctx.db.query("aircraftImages").collect();

    // Sort: pending first (isApproved: false), then by createdAt descending
    return images
      .sort((a, b) => {
        // Pending first
        if (a.isApproved !== b.isApproved) {
          return a.isApproved ? 1 : -1;
        }
        // Then by creation time descending
        return b._creationTime - a._creationTime;
      })
      .map((image) => ({
        id: image._id,
        airlineIata: image.airlineIata,
        airlineIcao: image.airlineIcao,
        aircraftType: image.aircraftType,
        imageUrl: image.imageUrl,
        imageKey: image.imageKey ?? null,
        discordUsername: image.discordUsername ?? null,
        isApproved: image.isApproved,
        uploadedBy: image.uploadedBy,
        approvedBy: image.approvedBy ?? null,
        approvedAt: image.approvedAt ?? null,
        createdAt: image._creationTime,
        updatedAt: image._creationTime,
      }));
  },
});

// Get image by ID
export const getById = query({
  args: { id: v.id("aircraftImages") },
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.id);
    if (!image) return null;

    return {
      id: image._id,
      airlineIata: image.airlineIata,
      airlineIcao: image.airlineIcao,
      aircraftType: image.aircraftType,
      imageUrl: image.imageUrl,
      imageKey: image.imageKey ?? null,
      discordUsername: image.discordUsername ?? null,
      isApproved: image.isApproved,
      uploadedBy: image.uploadedBy,
      approvedBy: image.approvedBy ?? null,
      approvedAt: image.approvedAt ?? null,
      createdAt: image._creationTime,
      updatedAt: image._creationTime,
    };
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
    const aircraftType = args.aircraftType.toUpperCase();
    const iata = args.airlineIata.toUpperCase();
    const icao = args.airlineIcao.toUpperCase();

    // Check by IATA
    const iataImage = await ctx.db
      .query("aircraftImages")
      .withIndex("by_iata_aircraft_approved", (q) =>
        q
          .eq("airlineIata", iata)
          .eq("aircraftType", aircraftType)
          .eq("isApproved", true)
      )
      .first();
    if (iataImage) return true;

    // Check by ICAO
    const icaoImage = await ctx.db
      .query("aircraftImages")
      .withIndex("by_icao_aircraft_approved", (q) =>
        q
          .eq("airlineIcao", icao)
          .eq("aircraftType", aircraftType)
          .eq("isApproved", true)
      )
      .first();
    if (icaoImage) return true;

    return false;
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
    const aircraftType = args.aircraftType.toUpperCase();
    const iata = args.airlineIata.toUpperCase();
    const icao = args.airlineIcao.toUpperCase();

    // Find pending images by this user for this combo (match either IATA or ICAO)
    const image = await ctx.db
      .query("aircraftImages")
      .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", args.uploadedBy))
      .filter((q) =>
        q.and(
          q.eq(q.field("aircraftType"), aircraftType),
          q.eq(q.field("isApproved"), false),
          q.or(
            q.eq(q.field("airlineIata"), iata),
            q.eq(q.field("airlineIcao"), icao)
          )
        )
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
    discordUsername: v.optional(v.string()),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("aircraftImages", {
      airlineIata: args.airlineIata.toUpperCase(),
      airlineIcao: args.airlineIcao.toUpperCase(),
      aircraftType: args.aircraftType.toUpperCase(),
      imageUrl: args.imageUrl,
      imageKey: args.imageKey,
      discordUsername: args.discordUsername,
      isApproved: false,
      uploadedBy: args.uploadedBy,
    });

    const image = await ctx.db.get(id);
    if (!image) return null;

    return {
      id: image._id,
      airlineIata: image.airlineIata,
      airlineIcao: image.airlineIcao,
      aircraftType: image.aircraftType,
      imageUrl: image.imageUrl,
      imageKey: image.imageKey ?? null,
      discordUsername: image.discordUsername ?? null,
      isApproved: image.isApproved,
      uploadedBy: image.uploadedBy,
      approvedBy: image.approvedBy ?? null,
      approvedAt: image.approvedAt ?? null,
      createdAt: image._creationTime,
      updatedAt: image._creationTime,
    };
  },
});

// Approve aircraft image
export const approve = mutation({
  args: {
    id: v.id("aircraftImages"),
    approvedBy: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isApproved: true,
      approvedBy: args.approvedBy,
      approvedAt: Date.now(),
    });
  },
});

// Delete aircraft image
export const remove = mutation({
  args: { id: v.id("aircraftImages") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Bulk approve aircraft images (single mutation for multiple images)
export const bulkApprove = mutation({
  args: {
    ids: v.array(v.id("aircraftImages")),
    approvedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const results: { id: string; success: boolean; existingImageKey?: string }[] = [];
    const now = Date.now();

    for (const id of args.ids) {
      const image = await ctx.db.get(id);
      if (!image) {
        results.push({ id, success: false });
        continue;
      }

      // Check for existing approved image (by IATA)
      let existingApproved = await ctx.db
        .query("aircraftImages")
        .withIndex("by_iata_aircraft_approved", (q) =>
          q
            .eq("airlineIata", image.airlineIata)
            .eq("aircraftType", image.aircraftType)
            .eq("isApproved", true)
        )
        .first();

      // If not found, check by ICAO
      if (!existingApproved) {
        existingApproved = await ctx.db
          .query("aircraftImages")
          .withIndex("by_icao_aircraft_approved", (q) =>
            q
              .eq("airlineIcao", image.airlineIcao)
              .eq("aircraftType", image.aircraftType)
              .eq("isApproved", true)
          )
          .first();
      }

      // Delete existing approved image if found (and not the same image)
      let existingImageKey: string | undefined;
      if (existingApproved && existingApproved._id !== id) {
        existingImageKey = existingApproved.imageKey ?? undefined;
        await ctx.db.delete(existingApproved._id);
      }

      // Approve the new image
      await ctx.db.patch(id, {
        isApproved: true,
        approvedBy: args.approvedBy,
        approvedAt: now,
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
  },
  handler: async (ctx, args) => {
    const results: { id: string; success: boolean; imageKey?: string; uploadedBy?: string; airlineIata?: string; airlineIcao?: string; aircraftType?: string }[] = [];

    for (const id of args.ids) {
      const image = await ctx.db.get(id);
      if (!image) {
        results.push({ id, success: false });
        continue;
      }

      await ctx.db.delete(id);
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
    const aircraftType = args.aircraftType.toUpperCase();
    const iata = args.airlineIata.toUpperCase();
    const icao = args.airlineIcao.toUpperCase();

    // Check for approved images (by IATA)
    let approvedExists = await ctx.db
      .query("aircraftImages")
      .withIndex("by_iata_aircraft_approved", (q) =>
        q.eq("airlineIata", iata).eq("aircraftType", aircraftType).eq("isApproved", true)
      )
      .first();

    // Check by ICAO if not found
    if (!approvedExists) {
      approvedExists = await ctx.db
        .query("aircraftImages")
        .withIndex("by_icao_aircraft_approved", (q) =>
          q.eq("airlineIcao", icao).eq("aircraftType", aircraftType).eq("isApproved", true)
        )
        .first();
    }

    // Check for pending image by this user
    const pendingByUser = await ctx.db
      .query("aircraftImages")
      .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", args.uploadedBy))
      .filter((q) =>
        q.and(
          q.eq(q.field("aircraftType"), aircraftType),
          q.eq(q.field("isApproved"), false),
          q.or(q.eq(q.field("airlineIata"), iata), q.eq(q.field("airlineIcao"), icao))
        )
      )
      .first();

    return {
      approvedExists: approvedExists !== null,
      pendingByUserExists: pendingByUser !== null,
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
    const aircraftType = args.aircraftType.toUpperCase();
    const iata = args.airlineIata.toUpperCase();
    const icao = args.airlineIcao.toUpperCase();

    // Check by IATA
    let image = await ctx.db
      .query("aircraftImages")
      .withIndex("by_iata_aircraft_approved", (q) =>
        q
          .eq("airlineIata", iata)
          .eq("aircraftType", aircraftType)
          .eq("isApproved", true)
      )
      .first();

    // If not found, check by ICAO
    if (!image) {
      image = await ctx.db
        .query("aircraftImages")
        .withIndex("by_icao_aircraft_approved", (q) =>
          q
            .eq("airlineIcao", icao)
            .eq("aircraftType", aircraftType)
            .eq("isApproved", true)
        )
        .first();
    }

    if (!image) return null;
    if (args.excludeId && image._id === args.excludeId) return null;

    return {
      id: image._id,
      imageKey: image.imageKey ?? null,
    };
  },
});

