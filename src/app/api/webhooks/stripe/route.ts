import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { convex, api } from "~/server/convex";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Events that can affect subscription state
const SUBSCRIPTION_EVENTS: Stripe.Event.Type[] = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_succeeded",
];

/**
 * Syncs subscription data from Stripe to Convex
 */
async function syncStripeSubscription(stripeCustomerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    limit: 1,
    status: "all",
  });

  const subscription = subscriptions.data[0];

  if (!subscription) {
    await convex.mutation(api.users.updateByStripeCustomerId, {
      stripeCustomerId,
      role: "FREE",
      systemSecret: process.env.BOT_API_SECRET,
    });
    return { status: "none" };
  }

  // User should have PRO access if:
  // - Subscription is active or trialing
  // - Even if canceled, they keep access until period ends
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

  // Skip events we don't care about
  if (!SUBSCRIPTION_EVENTS.includes(event.type)) {
    return NextResponse.json({ received: true, skipped: true });
  }

  try {
    console.log(`[Stripe Webhook] Processing ${event.type}`);

    // Handle checkout.session.completed specially to store customer ID
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const clerkId = session.metadata?.clerkId;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (clerkId && customerId) {
        // Store Stripe IDs on user
        await convex.mutation(api.users.updateByClerkId, {
          clerkId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          systemSecret: process.env.BOT_API_SECRET,
        });

        // Sync subscription state
        await syncStripeSubscription(customerId);
        console.log(`[Stripe Webhook] User ${clerkId} checkout completed`);
      }

      return NextResponse.json({ received: true });
    }

    // For all other events, get customerId and sync
    const eventData = event.data.object as { customer?: string };
    const customerId = eventData.customer;

    if (typeof customerId !== "string") {
      console.warn(`[Stripe Webhook] No customer ID in ${event.type} event`);
      return NextResponse.json({ received: true });
    }

    const result = await syncStripeSubscription(customerId);
    console.log(
      `[Stripe Webhook] ${event.type} - Customer ${customerId} synced:`,
      result,
    );

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Stripe Webhook] Error processing event:", err);
    // Still return 200 to prevent Stripe from retrying
    return NextResponse.json({ received: true, error: "Processing failed" });
  }
}
