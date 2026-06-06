"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { convex, api } from "~/server/convex";

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
  let stripeCustomerId = dbUser?.stripeCustomerId;

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
      systemSecret: process.env.BOT_API_SECRET,
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
      subscription_data: {
        trial_period_days: 7,
      },
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
        systemSecret: process.env.BOT_API_SECRET,
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
        subscription_data: {
          trial_period_days: 7,
        },
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
