import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "~/server/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  //   apiVersion: "2024-12-18.acacia",
});

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        console.log("=== Checkout Session Completed ===");
        console.log("Customer ID:", session.customer);
        console.log("Subscription ID:", session.subscription);
        console.log("Metadata:", JSON.stringify(session.metadata, null, 2));
        console.log("================================");

        if (!session.metadata?.userId) {
          console.warn("⚠️  No userId in session metadata - skipping update");
          return NextResponse.json({ received: true, skipped: true });
        }

        console.log("Updating user:", session.metadata.userId);

        await db.user.update({
          where: { clerkId: session.metadata.userId },
          data: {
            role: "PRO",
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
          },
        });

        console.log("✅ User upgraded to PRO successfully");
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;

        console.log("=== Subscription Updated ===");
        console.log("Status:", subscription.status);
        console.log("Cancel at period end:", subscription.cancel_at_period_end);

        const shouldBeProUser =
          subscription.status === "active" &&
          !subscription.cancel_at_period_end;

        await db.user.update({
          where: { stripeCustomerId: subscription.customer as string },
          data: {
            role: shouldBeProUser ? "PRO" : "FREE",
          },
        });

        console.log(`✅ User role set to: ${shouldBeProUser ? "PRO" : "FREE"}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        console.log("=== Subscription Deleted ===");
        console.log("Customer:", subscription.customer);

        await db.user.update({
          where: { stripeCustomerId: subscription.customer as string },
          data: { role: "FREE" },
        });

        console.log("User downgraded to FREE");
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
