"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { initPostHog, posthog } from "~/lib/posthog";

const isProduction = process.env.NODE_ENV === "production";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    initPostHog();
  }, []);

  // Identify user when logged in (production only)
  useEffect(() => {
    if (!isProduction) return;
    if (!isLoaded) return;

    if (user) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
        created_at: user.createdAt?.toISOString(),
      });
    } else {
      posthog.reset();
    }
  }, [user, isLoaded]);

  // Track pageviews (production only)
  useEffect(() => {
    if (!isProduction) return;
    if (pathname) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url = url + "?" + searchParams.toString();
      }
      posthog.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams]);

  return <>{children}</>;
}
