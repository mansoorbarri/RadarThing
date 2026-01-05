"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";

export async function isPro() {
  const { userId } = await auth();
  if (!userId) return false;

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { role: true },
  });

  return user?.role === "PRO";
}