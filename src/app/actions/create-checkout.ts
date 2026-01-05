"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  //   apiVersion: "2024-12-18.acacia",
});

export async function createCheckoutSession() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) throw new Error("Unauthorized");

  const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    customer_email: user.emailAddresses[0]?.emailAddress,
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
    success_url: `${baseUrl}?success=true`,
    cancel_url: `${baseUrl}/pricing`,
    metadata: {
      userId: userId,
    },
  });

  return session.url;
}
