import { auth } from "@clerk/nextjs/server";
import { convex, api } from "~/server/convex";
import { hasEffectiveProAccess } from "~/lib/proAccess";

const SUPER_ADMIN_GOOGLE_ID = "101233162035372298523";

export async function getCurrentAccessContext() {
  const { userId } = await auth();

  if (!userId) {
    return {
      clerkId: null,
      user: null,
      isAdmin: false,
      isSuperAdmin: false,
    };
  }

  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  const isSuperAdmin = user?.googleId === SUPER_ADMIN_GOOGLE_ID;

  if (!user) {
    return {
      clerkId: userId,
      user: null,
      isAdmin: isSuperAdmin,
      isSuperAdmin,
      isPro: isSuperAdmin,
    };
  }

  return {
    clerkId: userId,
    user,
    isAdmin: user.role === "ADMIN" || isSuperAdmin,
    isSuperAdmin,
    isPro: hasEffectiveProAccess(user) || isSuperAdmin,
  };
}
