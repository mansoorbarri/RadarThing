import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

export const getById = query({
  args: {
    id: v.id("virtualAirlineAircraftImages"),
  },
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.id);
    if (!image) return null;

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
  },
});

export const getByVirtualAirlineId = query({
  args: {
    virtualAirlineId: v.id("virtualAirlines"),
  },
  handler: async (ctx, args) => {
    const images = await ctx.db
      .query("virtualAirlineAircraftImages")
      .withIndex("by_virtualAirlineId", (q) =>
        q.eq("virtualAirlineId", args.virtualAirlineId),
      )
      .collect();

    return images
      .sort((a, b) => a.aircraftType.localeCompare(b.aircraftType))
      .map((image) => ({
        id: image._id,
        virtualAirlineId: image.virtualAirlineId,
        aircraftType: image.aircraftType,
        imageUrl: image.imageUrl,
        imageKey: image.imageKey ?? null,
        uploadedBy: image.uploadedBy,
        createdAt: image._creationTime,
        updatedAt: image.updatedAt,
      }));
  },
});

export const upsert = mutation({
  args: {
    virtualAirlineId: v.id("virtualAirlines"),
    aircraftType: v.string(),
    imageUrl: v.string(),
    imageKey: v.optional(v.string()),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const aircraftType = normalizeAircraftTypeKey(args.aircraftType);
    const existingImage = await ctx.db
      .query("virtualAirlineAircraftImages")
      .withIndex("by_virtualAirlineId_aircraftType", (q) =>
        q
          .eq("virtualAirlineId", args.virtualAirlineId)
          .eq("aircraftType", aircraftType),
      )
      .first();

    const now = Date.now();

    if (existingImage) {
      await ctx.db.patch(existingImage._id, {
        imageUrl: args.imageUrl,
        imageKey: args.imageKey,
        uploadedBy: args.uploadedBy,
        updatedAt: now,
      });

      const updatedImage = await ctx.db.get(existingImage._id);

      return {
        image: updatedImage
          ? {
              id: updatedImage._id,
              virtualAirlineId: updatedImage.virtualAirlineId,
              aircraftType: updatedImage.aircraftType,
              imageUrl: updatedImage.imageUrl,
              imageKey: updatedImage.imageKey ?? null,
              uploadedBy: updatedImage.uploadedBy,
              createdAt: updatedImage._creationTime,
              updatedAt: updatedImage.updatedAt,
            }
          : null,
        replacedImageKey:
          existingImage.imageKey && existingImage.imageKey !== args.imageKey
            ? existingImage.imageKey
            : null,
      };
    }

    const id = await ctx.db.insert("virtualAirlineAircraftImages", {
      virtualAirlineId: args.virtualAirlineId,
      aircraftType,
      imageUrl: args.imageUrl,
      imageKey: args.imageKey,
      uploadedBy: args.uploadedBy,
      updatedAt: now,
    });

    const image = await ctx.db.get(id);

    return {
      image: image
        ? {
            id: image._id,
            virtualAirlineId: image.virtualAirlineId,
            aircraftType: image.aircraftType,
            imageUrl: image.imageUrl,
            imageKey: image.imageKey ?? null,
            uploadedBy: image.uploadedBy,
            createdAt: image._creationTime,
            updatedAt: image.updatedAt,
          }
        : null,
      replacedImageKey: null,
    };
  },
});

export const remove = mutation({
  args: {
    id: v.id("virtualAirlineAircraftImages"),
  },
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.id);
    if (!image) return null;

    await ctx.db.delete(args.id);

    return {
      id: image._id,
      imageKey: image.imageKey ?? null,
      virtualAirlineId: image.virtualAirlineId,
      aircraftType: image.aircraftType,
    };
  },
});
