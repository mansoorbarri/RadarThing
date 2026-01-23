import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { convex, api } from "~/server/convex";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
      process.env.STRIPE_WEBHOOK_SECRET!
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

        await convex.mutation(api.users.updateByClerkId, {
          clerkId: session.metadata.userId,
          role: "PRO",
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
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

        await convex.mutation(api.users.updateByStripeCustomerId, {
          stripeCustomerId: subscription.customer as string,
          role: shouldBeProUser ? "PRO" : "FREE",
        });

        console.log(`✅ User role set to: ${shouldBeProUser ? "PRO" : "FREE"}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        console.log("=== Subscription Deleted ===");
        console.log("Customer:", subscription.customer);

        await convex.mutation(api.users.updateByStripeCustomerId, {
          stripeCustomerId: subscription.customer as string,
          role: "FREE",
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
      { status: 500 }
    );
  }
}
