import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  // Capture 100% of errors, sample 10% of transactions for performance
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [Sentry.replayIntegration()],

  beforeSend(event) {
    // Filter out hydration errors caused by browser extensions modifying the DOM
    // eslint-disable-next-line @typescript-eslint/dot-notation
    if (event.extra?.["__serialized__"]?.message?.includes?.("Hydration")) return null;
    if (event.message?.includes?.("Hydration")) return null;
    if (
      typeof event.metadata?.title === "string" &&
      event.metadata.title.includes("Hydration")
    ) {
      return null;
    }

    return event;
  },
});
