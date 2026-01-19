"use server";

import { auth } from "@clerk/nextjs/server";
import { convex, api } from "~/server/convex";

export async function getUserGoogleId(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  return user?.googleId ?? null;
}
