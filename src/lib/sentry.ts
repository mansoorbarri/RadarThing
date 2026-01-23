import * as Sentry from "@sentry/nextjs";

/**
 * Set Sentry user context for error tracking
 * Call this when user signs in
 */
export function setSentryUser(supportId: string | null) {
  if (process.env.NODE_ENV !== "production") return;

  if (supportId) {
    Sentry.setUser({ id: supportId });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Capture an error with optional extra context
 */
export function captureError(
  error: Error | string,
  context?: Record<string, unknown>
) {
  if (process.env.NODE_ENV !== "production") {
    console.error("[Dev Error]", error, context);
    return;
  }

  if (typeof error === "string") {
    Sentry.captureMessage(error, {
      level: "error",
      extra: context,
    });
  } else {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

/**
 * Add breadcrumb for debugging user flow
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
) {
  if (process.env.NODE_ENV !== "production") return;

  Sentry.addBreadcrumb({
    message,
    category,
    level: "info",
    data,
  });
}
