import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export const getByCode = query({
  args: {
    codes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedCodes = Array.from(
      new Set(args.codes.map(normalizeCode).filter((code) => code.length >= 2)),
    );

    for (const code of normalizedCodes) {
      const iataMatch = await ctx.db
        .query("airlineLogos")
        .withIndex("by_airlineIata", (q) => q.eq("airlineIata", code))
        .first();

      if (iataMatch) {
        return iataMatch;
      }

      const icaoMatch = await ctx.db
        .query("airlineLogos")
        .withIndex("by_airlineIcao", (q) => q.eq("airlineIcao", code))
        .first();

      if (icaoMatch) {
        return icaoMatch;
      }
    }

    return null;
  },
});

export const upsert = mutation({
  args: {
    airlineIata: v.string(),
    airlineIcao: v.string(),
    slug: v.string(),
    sourceAsset: v.string(),
    sourceUrl: v.string(),
    contentType: v.optional(v.string()),
    cachedUrl: v.optional(v.string()),
    imageKey: v.optional(v.string()),
    lastFetchedAt: v.number(),
    lastCachedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const airlineIata = normalizeCode(args.airlineIata);
    const airlineIcao = normalizeCode(args.airlineIcao);
    const slug = args.slug.trim();

    let existing = await ctx.db
      .query("airlineLogos")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();

    if (!existing) {
      existing = await ctx.db
        .query("airlineLogos")
        .withIndex("by_airlineIata", (q) => q.eq("airlineIata", airlineIata))
        .first();
    }

    if (!existing) {
      existing = await ctx.db
        .query("airlineLogos")
        .withIndex("by_airlineIcao", (q) => q.eq("airlineIcao", airlineIcao))
        .first();
    }

    const patch = {
      airlineIata,
      airlineIcao,
      slug,
      sourceAsset: args.sourceAsset,
      sourceUrl: args.sourceUrl,
      contentType: args.contentType,
      cachedUrl: args.cachedUrl,
      imageKey: args.imageKey,
      lastFetchedAt: args.lastFetchedAt,
      lastCachedAt: args.lastCachedAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("airlineLogos", patch);
  },
});
