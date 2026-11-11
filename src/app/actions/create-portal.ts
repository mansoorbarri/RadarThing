"use server";

import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { convex, api } from "~/server/convex";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function createPortalSession() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await convex.query(api.users.getByClerkId, {
    clerkId: userId,
    systemSecret: process.env.CONVEX_SYSTEM_SECRET,
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
