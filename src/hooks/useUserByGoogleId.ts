"use client";

import { useQuery } from "convex/react";
import { useRef, useEffect, useCallback } from "react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

type User = Doc<"users">;

// Global cache shared across all hook instances
// Key: googleId, Value: { user, timestamp }
const userCache = new Map<string, { user: User | null; timestamp: number }>();

// Cache duration: 5 minutes (users rarely change)
const CACHE_DURATION_MS = 5 * 60 * 1000;

function getCachedUser(googleId: string): User | null | undefined {
  const cached = userCache.get(googleId);
  if (!cached) return undefined; // Not in cache
  if (Date.now() - cached.timestamp > CACHE_DURATION_MS) {
    userCache.delete(googleId);
    return undefined; // Expired
  }
  return cached.user;
}

function setCachedUser(googleId: string, user: User | null): void {
  userCache.set(googleId, { user, timestamp: Date.now() });
}

/**
 * Hook that fetches a user by their Google ID with client-side caching.
 * This significantly reduces Convex function calls by caching results
 * for 5 minutes and sharing the cache across all component instances.
 *
 * @param googleId - The Google ID to look up, or undefined/null to skip
 * @returns The user object if found, null if not found, undefined if loading
 */
export function useUserByGoogleId(
  googleId: string | undefined | null,
): User | null | undefined {
  // Track whether we've already cached a result from Convex
  const hasCachedRef = useRef(false);

  // Check cache first
  const cachedResult = googleId ? getCachedUser(googleId) : undefined;

  // Only query Convex if:
  // 1. We have a googleId
  // 2. Result is not in cache (cachedResult === undefined means not in cache, null means cached as not found)
  const shouldQuery = Boolean(googleId) && cachedResult === undefined;

  const convexResult = useQuery(
    api.users.getByGoogleId,
    shouldQuery && googleId ? { googleId } : "skip",
  );

  // Update cache when Convex returns a result
  useEffect(() => {
    if (
      googleId &&
      shouldQuery &&
      convexResult !== undefined &&
      !hasCachedRef.current
    ) {
      setCachedUser(googleId, convexResult);
      hasCachedRef.current = true;
    }
  }, [googleId, shouldQuery, convexResult]);

  // Reset the cached flag when googleId changes
  useEffect(() => {
    hasCachedRef.current = false;
  }, [googleId]);

  // Return cached result if available, otherwise return Convex result
  if (!googleId) return undefined;
  if (cachedResult !== undefined) return cachedResult;
  return convexResult;
}

/**
 * Manually clear a user from the cache (useful after mutations)
 */
export function invalidateUserCache(googleId: string): void {
  userCache.delete(googleId);
}

/**
 * Clear the entire user cache
 */
export function clearUserCache(): void {
  userCache.clear();
}
