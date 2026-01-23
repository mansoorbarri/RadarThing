import * as Sentry from "@sentry/nextjs";

// Only initialize Sentry in production
if (process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Performance monitoring
    tracesSampleRate: 0.1,

    // Spotlight for local dev debugging (disabled in prod)
    spotlight: false,

    beforeSend(event) {
      if (process.env.NODE_ENV !== "production") {
        return null;
      }
      return event;
    },
  });
}
