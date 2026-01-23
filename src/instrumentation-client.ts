import * as Sentry from "@sentry/nextjs";

// Export for Next.js navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Only initialize Sentry in production
if (process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Performance monitoring
    tracesSampleRate: 0.1, // Capture 10% of transactions

    // Session replay for debugging user issues
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Filter out noisy errors
    ignoreErrors: [
      // Browser extensions
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      // Network errors that users can't control
      "Network request failed",
      "Failed to fetch",
      "Load failed",
      // AbortController cancellations
      "AbortError",
    ],

    beforeSend(event) {
      if (process.env.NODE_ENV !== "production") {
        return null;
      }
      return event;
    },
  });
}
