import { auth } from "@clerk/nextjs/server";
import { convex, api } from "~/server/convex";
import { env } from "~/env";

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

  const isSuperAdmin = Boolean(
    env.ADMIN_GOOGLE_ID && user.googleId === env.ADMIN_GOOGLE_ID,
  );

  return {
    clerkId: userId,
    user,
    isAdmin: user.role === "ADMIN" || isSuperAdmin,
    isSuperAdmin,
  };
}
