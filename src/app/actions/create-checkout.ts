"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { convex, api } from "~/server/convex";
import { MIN_STRIPE_TRIAL_MS, hasUsedTrial } from "~/lib/proAccess";

function getSubscriptionData(
  dbUser: {
    trialEndsAt?: number;
    trialStartedAt?: number;
    stripeSubscriptionId?: string;
  } | null,
): Stripe.Checkout.SessionCreateParams.SubscriptionData | undefined {
  if (!hasUsedTrial(dbUser)) return { trial_period_days: 7 };

  // Subscribing during the no-card trial keeps the remaining trial days.
  const trialEndsAt = dbUser?.trialEndsAt;
  if (
    !dbUser?.stripeSubscriptionId &&
    typeof trialEndsAt === "number" &&
    trialEndsAt - Date.now() > MIN_STRIPE_TRIAL_MS
  ) {
    return { trial_end: Math.floor(trialEndsAt / 1000) };
  }

  // Already had a trial or a past subscription, so billing starts right away.
  return undefined;
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function createCheckoutSession() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) throw new Error("Unauthorized");

  const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
  const email = user.emailAddresses[0]?.emailAddress;

  // Get existing user from Convex
  const dbUser = await convex.query(api.users.getByClerkId, {
    clerkId: userId,
  });
  if (dbUser?.activeBanId || dbUser?.isDeleted)
    throw new Error("Account access restricted");
  let stripeCustomerId = dbUser?.stripeCustomerId;
  const subscriptionData = getSubscriptionData(dbUser);

  // Create Stripe customer if user doesn't have one
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: {
        clerkId: userId,
      },
    });
    stripeCustomerId = customer.id;

    // Store the customer ID in Convex (use updateByClerkId to handle all cases)
    await convex.mutation(api.users.updateByClerkId, {
      clerkId: userId,
      stripeCustomerId: customer.id,
      systemSecret: process.env.CONVEX_SYSTEM_SECRET,
    });
  }

  // Always create checkout with customer ID (not customer_email)
  try {
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      mode: "subscription",
      allow_promotion_codes: true,
      subscription_data: subscriptionData,
      success_url: `${baseUrl}/checkout/success`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: {
        clerkId: userId,
      },
    });

    return session.url;
  } catch (err) {
    // If the stored Stripe customer no longer exists (e.g. test/live mode mismatch),
    // create a new one and retry
    if (
      err instanceof Stripe.errors.StripeInvalidRequestError &&
      err.code === "resource_missing" &&
      err.param === "customer"
    ) {
      const customer = await stripe.customers.create({
        email,
        metadata: { clerkId: userId },
      });

      await convex.mutation(api.users.updateByClerkId, {
        clerkId: userId,
        stripeCustomerId: customer.id,
        systemSecret: process.env.CONVEX_SYSTEM_SECRET,
      });

      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        line_items: [
          {
            price: process.env.STRIPE_PRICE_ID!,
            quantity: 1,
          },
        ],
        mode: "subscription",
        allow_promotion_codes: true,
        subscription_data: subscriptionData,
        success_url: `${baseUrl}/checkout/success`,
        cancel_url: `${baseUrl}/pricing`,
        metadata: {
          clerkId: userId,
        },
      });

      return session.url;
    }

    throw err;
  }
}
