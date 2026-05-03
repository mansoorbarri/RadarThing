"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";

import { Analytics } from "~/lib/analytics";
import { cn } from "~/lib/utils";

export function LandingTracker({
  event,
  variant,
}: {
  event: "landing_gallery_viewed" | "landing_variant_viewed";
  variant?: string;
}) {
  useEffect(() => {
    Analytics.track(event, variant ? { variant } : undefined);
  }, [event, variant]);

  return null;
}

interface LandingCtaLinkProps {
  children: ReactNode;
  className?: string;
  href: string;
  source: string;
  variant: string;
  external?: boolean;
}

export function LandingCtaLink({
  children,
  className,
  href,
  source,
  variant,
  external = false,
}: LandingCtaLinkProps) {
  const handleClick = () => {
    Analytics.track("landing_cta_clicked", {
      href,
      source,
      variant,
    });
  };

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={cn(className)}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} onClick={handleClick} className={cn(className)}>
      {children}
    </Link>
  );
}
