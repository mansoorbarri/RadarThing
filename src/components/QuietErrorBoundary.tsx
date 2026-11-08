"use client";

import { Component, type ReactNode } from "react";
import { Analytics } from "~/lib/analytics";

/**
 * Contains a failure in an optional part of the UI (e.g. a Convex query that
 * throws) so it renders `fallback` instead of taking the whole page, or the
 * error page itself, down with it.
 */
export class QuietErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; source: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    Analytics.captureException(error, { source: this.props.source });
  }

  render() {
    return this.state.failed
      ? (this.props.fallback ?? null)
      : this.props.children;
  }
}
