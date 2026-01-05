"use server";

import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { db } from "~/server/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  //   apiVersion: "2024-12-18.acacia",
});

export async function createPortalSession() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    throw new Error("No Stripe customer found");
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${baseUrl}`,
  });

  return session.url;
}
