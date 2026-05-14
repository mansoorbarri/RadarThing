// hooks/useProStatus.ts
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { checkIsSuperAdmin } from "~/app/actions/is-pro";
import { hasEffectiveProAccess } from "~/lib/proAccess";

const SUPER_ADMIN_CACHE_PREFIX = "radarthing.super-admin:";
const superAdminMemoryCache = new Map<string, boolean>();

function readCachedSuperAdmin(googleId: string): boolean | undefined {
  const cached = superAdminMemoryCache.get(googleId);
  if (cached !== undefined) {
    return cached;
  }

  if (typeof window === "undefined") return undefined;

  const stored = window.sessionStorage.getItem(
    `${SUPER_ADMIN_CACHE_PREFIX}${googleId}`,
  );
  if (stored === null) return undefined;

  const value = stored === "1";
  superAdminMemoryCache.set(googleId, value);
  return value;
}

function writeCachedSuperAdmin(googleId: string, isSuperAdmin: boolean) {
  superAdminMemoryCache.set(googleId, isSuperAdmin);

  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(
    `${SUPER_ADMIN_CACHE_PREFIX}${googleId}`,
    isSuperAdmin ? "1" : "0",
  );
}

export const useProStatus = () => {
  const { user, isLoaded } = useUser();
  const clerkId = user?.id;

  // Real-time query - auto-updates when data changes in Convex
  const dbUser = useQuery(
    api.users.getByClerkId,
    clerkId ? { clerkId } : "skip",
  );

  // Check for env-based super admin (break-glass access)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isCheckingSuperAdmin, setIsCheckingSuperAdmin] = useState(false);

  useEffect(() => {
    if (dbUser === undefined) return;
    if (dbUser === null) {
      setIsSuperAdmin(false);
      setIsCheckingSuperAdmin(false);
      return;
    }

    const googleId = dbUser.googleId;

    // Role-based admins should retain access to admin-only tabs without the break-glass lookup.
    if (dbUser.role === "ADMIN") {
      setIsSuperAdmin(true);
      setIsCheckingSuperAdmin(false);
      return;
    }

    if (!googleId) {
      setIsSuperAdmin(false);
      setIsCheckingSuperAdmin(false);
      return;
    }

    const cached = readCachedSuperAdmin(googleId);
    if (cached !== undefined) {
      setIsSuperAdmin(cached);
      setIsCheckingSuperAdmin(false);
      return;
    }

    let cancelled = false;
    setIsCheckingSuperAdmin(true);

    checkIsSuperAdmin(googleId)
      .then((result) => {
        if (cancelled) return;
        writeCachedSuperAdmin(googleId, result);
        setIsSuperAdmin(result);
      })
      .catch(() => {
        if (cancelled) return;
        setIsSuperAdmin(false);
      })
      .finally(() => {
        if (cancelled) return;
        setIsCheckingSuperAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dbUser]);

  const isLoading =
    !isLoaded || (clerkId && (dbUser === undefined || isCheckingSuperAdmin));
  const isRoleAdmin = dbUser?.role === "ADMIN";
  const isAdminUser = isRoleAdmin || isSuperAdmin;
  const isProUser = hasEffectiveProAccess(dbUser);

  return {
    isProUser: isProUser || isSuperAdmin, // Super admins also have PRO access
    isAdminUser,
    isSuperAdmin,
    isLoading: Boolean(isLoading),
  };
};
