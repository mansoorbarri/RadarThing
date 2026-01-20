import { PostHog } from "posthog-node";

const isProduction = process.env.NODE_ENV === "production";

let posthogClient: PostHog | null = null;

export function getPostHogClient() {
  if (!isProduction) return null;

  if (!posthogClient) {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      console.warn("PostHog key not found for server-side tracking");
      return null;
    }

    posthogClient = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

export const serverAnalytics = {
  // User lifecycle events
  userSignedUp: (userId: string, properties?: { email?: string; authMethod?: string }) => {
    const client = getPostHogClient();
    if (!client) return;

    client.capture({
      distinctId: userId,
      event: "user_signed_up",
      properties: {
        ...properties,
        $set: {
          email: properties?.email,
          auth_method: properties?.authMethod,
          signed_up_at: new Date().toISOString(),
        },
      },
    });
  },

  userDeleted: (userId: string) => {
    const client = getPostHogClient();
    if (!client) return;

    client.capture({
      distinctId: userId,
      event: "user_deleted",
    });
  },

  // Subscription events
  checkoutInitiated: (userId: string, properties?: { email?: string }) => {
    const client = getPostHogClient();
    if (!client) return;

    client.capture({
      distinctId: userId,
      event: "checkout_initiated",
      properties,
    });
  },

  subscriptionCreated: (userId: string, properties?: { customerId?: string; subscriptionId?: string }) => {
    const client = getPostHogClient();
    if (!client) return;

    client.capture({
      distinctId: userId,
      event: "subscription_created",
      properties: {
        ...properties,
        $set: {
          is_pro: true,
          upgraded_at: new Date().toISOString(),
        },
      },
    });
  },

  subscriptionCancelled: (userId: string, customerId: string) => {
    const client = getPostHogClient();
    if (!client) return;

    client.capture({
      distinctId: customerId,
      event: "subscription_cancelled",
      properties: {
        user_id: userId,
        $set: {
          is_pro: false,
          cancelled_at: new Date().toISOString(),
        },
      },
    });
  },

  subscriptionUpdated: (customerId: string, properties: { status: string; isPro: boolean }) => {
    const client = getPostHogClient();
    if (!client) return;

    client.capture({
      distinctId: customerId,
      event: "subscription_updated",
      properties: {
        ...properties,
        $set: {
          is_pro: properties.isPro,
        },
      },
    });
  },

  // Identify user with properties
  identifyUser: (userId: string, properties: Record<string, unknown>) => {
    const client = getPostHogClient();
    if (!client) return;

    client.identify({
      distinctId: userId,
      properties,
    });
  },

  // Error tracking
  errorOccurred: (userId: string, properties: { error: string; context?: string; stack?: string }) => {
    const client = getPostHogClient();
    if (!client) return;

    client.capture({
      distinctId: userId,
      event: "error_occurred",
      properties,
    });
  },

  // Flush events (call at end of request handlers)
  flush: async () => {
    const client = getPostHogClient();
    if (client) {
      await client.flush();
    }
  },
};
