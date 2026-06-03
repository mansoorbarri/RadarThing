import { auth } from "@clerk/nextjs/server";
import { convex, api } from "~/server/convex";
import { hasEffectiveProAccess } from "~/lib/proAccess";

const SUPER_ADMIN_EMAIL = "mansoor.eb.ak@gmail.com";

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

  if (!user) {
    return {
      clerkId: userId,
      user: null,
      isAdmin: false,
      isSuperAdmin: false,
    };
  }

  const isSuperAdmin = user.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;

  return {
    clerkId: userId,
    user,
    isAdmin: user.role === "ADMIN" || isSuperAdmin,
    isSuperAdmin,
    isPro: hasEffectiveProAccess(user) || isSuperAdmin,
  };
}
