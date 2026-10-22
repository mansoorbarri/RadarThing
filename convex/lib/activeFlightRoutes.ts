import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function deleteRouteChunks(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const chunks = await ctx.db
    .query("activeFlightRouteChunks")
    .withIndex("by_userId_startIndex", (q) => q.eq("userId", userId))
    .collect();
  for (const chunk of chunks) await ctx.db.delete(chunk._id);
  return chunks.length;
}

export async function readRouteCoords(
  ctx: QueryCtx,
  userId: Id<"users">,
  routeVersion: string,
) {
  const chunks = await ctx.db
    .query("activeFlightRouteChunks")
    .withIndex("by_userId_startIndex", (q) => q.eq("userId", userId))
    .collect();
  return chunks
    .filter((chunk) => chunk.routeVersion === routeVersion)
    .sort((a, b) => a.startIndex - b.startIndex)
    .flatMap((chunk) => chunk.coords as unknown[]);
}
