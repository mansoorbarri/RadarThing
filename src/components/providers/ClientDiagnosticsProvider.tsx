"use client";

import { useEffect } from "react";
import { Analytics } from "~/lib/analytics";
import {
  describeElement,
  getClientDiagnosticsContext,
  isEditableElement,
} from "~/lib/clientDiagnostics";

const EARLY_FOCUS_WINDOW_MS = 8000;
const USER_INTENT_GRACE_MS = 1200;
const VIEWPORT_MISMATCH_THRESHOLD_PX = 140;

function getRejectionDetails(reason: unknown) {
  if (reason instanceof Error) {
    return {};
  }

  if (
    typeof reason === "string" ||
    typeof reason === "number" ||
    typeof reason === "boolean"
  ) {
    return { rejection_value: String(reason).slice(0, 300) };
  }

  if (reason === null || reason === undefined) {
    return { rejection_value: String(reason) };
  }

  return {
    rejection_value_type:
      typeof reason === "object" && reason?.constructor?.name
        ? reason.constructor.name
        : typeof reason,
  };
}

export function ClientDiagnosticsProvider() {
  useEffect(() => {
    const mountedAt = Date.now();
    let lastUserIntentAt = 0;
    let hasReportedUnexpectedFocus = false;
    let hasReportedViewportMismatch = false;

    const markUserIntent = () => {
      lastUserIntentAt = Date.now();
    };

    const reportViewportMismatch = (source: string) => {
      if (hasReportedViewportMismatch) return;
      if (!window.visualViewport) return;
      if (isEditableElement(document.activeElement)) return;

      const viewportHeightDiff = Math.round(
        Math.abs(window.innerHeight - window.visualViewport.height),
      );

      if (viewportHeightDiff < VIEWPORT_MISMATCH_THRESHOLD_PX) return;

      hasReportedViewportMismatch = true;
      Analytics.track("client_viewport_mismatch_detected", {
        source,
        viewport_height_diff_px: viewportHeightDiff,
        ...getClientDiagnosticsContext(),
      });
    };

    const handleWindowError = (event: ErrorEvent) => {
      Analytics.captureException(
        event.error ?? new Error(event.message || "Unknown client error"),
        {
          source: "window_error",
          filename: event.filename || undefined,
          lineno: event.lineno || undefined,
          colno: event.colno || undefined,
          ...getClientDiagnosticsContext(),
        },
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      Analytics.captureException(
        event.reason instanceof Error
          ? event.reason
          : new Error("Unhandled promise rejection"),
        {
          source: "unhandled_rejection",
          ...getRejectionDetails(event.reason),
          ...getClientDiagnosticsContext(),
        },
      );
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof Element ? event.target : null;

      if (!isEditableElement(target)) return;

      const msSinceMount = Date.now() - mountedAt;
      const msSinceUserIntent = Date.now() - lastUserIntentAt;

      if (msSinceMount > EARLY_FOCUS_WINDOW_MS) return;
      if (msSinceUserIntent <= USER_INTENT_GRACE_MS) return;
      if (hasReportedUnexpectedFocus) return;

      hasReportedUnexpectedFocus = true;
      Analytics.track("client_unexpected_focus_detected", {
        source: "focusin",
        ms_since_mount: msSinceMount,
        ms_since_user_intent: msSinceUserIntent,
        ...describeElement(target),
        ...getClientDiagnosticsContext(),
      });
    };

    const handleViewportResize = () => {
      reportViewportMismatch("visual_viewport_resize");
    };

    const handleWindowResize = () => {
      reportViewportMismatch("window_resize");
    };

    const rafId = window.requestAnimationFrame(() => {
      reportViewportMismatch("initial_animation_frame");
    });

    const timeoutId = window.setTimeout(() => {
      reportViewportMismatch("initial_timeout");
    }, 1500);

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("focusin", handleFocusIn, true);
    window.addEventListener("pointerdown", markUserIntent, true);
    window.addEventListener("touchstart", markUserIntent, true);
    window.addEventListener("mousedown", markUserIntent, true);
    window.addEventListener("keydown", markUserIntent, true);
    window.addEventListener("resize", handleWindowResize);
    window.addEventListener("orientationchange", handleWindowResize);
    window.visualViewport?.addEventListener("resize", handleViewportResize);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
      window.removeEventListener("focusin", handleFocusIn, true);
      window.removeEventListener("pointerdown", markUserIntent, true);
      window.removeEventListener("touchstart", markUserIntent, true);
      window.removeEventListener("mousedown", markUserIntent, true);
      window.removeEventListener("keydown", markUserIntent, true);
      window.removeEventListener("resize", handleWindowResize);
      window.removeEventListener("orientationchange", handleWindowResize);
      window.visualViewport?.removeEventListener("resize", handleViewportResize);
    };
  }, []);

  return null;
}
