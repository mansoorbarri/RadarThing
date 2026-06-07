"use server";

import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { convex, api } from "~/server/convex";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Syncs subscription data from Stripe to Convex
 * Called after checkout success and by webhooks
 */
export async function syncStripeSubscription(stripeCustomerId: string) {
  // Fetch latest subscription from Stripe
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    limit: 1,
    status: "all",
  });

  const subscription = subscriptions.data[0];

  if (!subscription) {
    // No subscription found - user is FREE
    await convex.mutation(api.users.updateByStripeCustomerId, {
      stripeCustomerId,
      role: "FREE",
      systemSecret: process.env.BOT_API_SECRET,
    });
    return { status: "none" as const };
  }

  // User should have PRO access if subscription is active or trialing
  // Even if cancel_at_period_end is true, they keep access until period ends
  const shouldBePro =
    subscription.status === "active" || subscription.status === "trialing";

  await convex.mutation(api.users.updateByStripeCustomerId, {
    stripeCustomerId,
    role: shouldBePro ? "PRO" : "FREE",
    systemSecret: process.env.BOT_API_SECRET,
  });

  return {
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

/**
 * Sync current user's subscription after checkout
 */
export async function syncAfterCheckout() {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  let stripeCustomerId = user?.stripeCustomerId;

  // If no customer ID stored, try to find it from Stripe using clerkId metadata
  if (!stripeCustomerId) {
    const customers = await stripe.customers.search({
      query: `metadata["clerkId"]:"${userId}"`,
      limit: 1,
    });

    if (customers.data[0]) {
      stripeCustomerId = customers.data[0].id;
      // Store it for future use
      await convex.mutation(api.users.updateByClerkId, {
        clerkId: userId,
        stripeCustomerId,
        systemSecret: process.env.BOT_API_SECRET,
      });
    }
  }

  if (!stripeCustomerId) {
    return { success: false, error: "No Stripe customer found" };
  }

  try {
    const result = await syncStripeSubscription(stripeCustomerId);
    return { success: true, ...result };
  } catch (error) {
    console.error("Failed to sync subscription:", error);
    return { success: false, error: "Sync failed" };
  }
}
