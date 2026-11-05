"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { UserAuth } from "~/components/atc/userAuth";
import { SystemThemeLogo } from "~/components/ui/SystemThemeLogo";

export const SITE_NAV_LINKS = [
  { href: "/radar", label: "Radar" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/aircraft-images", label: "Gallery" },
  { href: "/guides", label: "Guides" },
  { href: "/pricing", label: "Pricing" },
] as const;

interface SiteHeaderProps {
  /**
   * "dark" is for pages that are always dark (landing, guides, legal).
   * "themed" follows the light/dark theme surfaces used by the app pages.
   */
  tone?: "dark" | "themed";
  className?: string;
  /** Hide the signed-in user's name/avatar (privacy mode on the dashboard). */
  hidePersonalInfo?: boolean;
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * One header for every website page, so people can always get from any page
 * to the radar, leaderboard, gallery, guides, pricing and their account.
 */
export function SiteHeader({
  tone = "dark",
  className = "",
  hidePersonalInfo = false,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const linkClass = (href: string) =>
    `rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none ${
      isActive(pathname, href)
        ? "font-semibold text-cyan-300 underline decoration-2 underline-offset-8"
        : "text-slate-300 hover:text-white"
    }`;

  const accountLabel = isLoaded && isSignedIn ? "Your account" : "Sign in";

  return (
    <header
      className={`relative z-20 border-b border-white/10 bg-black/40 backdrop-blur-xl ${className}`}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6"
      >
        <Link
          href="/"
          aria-label="RadarThing home"
          className="flex shrink-0 items-center rounded-md focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
        >
          {tone === "themed" ? (
            <span className="block h-[30px] w-[100px]">
              <SystemThemeLogo alt="RadarThing" width={100} height={30} />
            </span>
          ) : (
            <Image
              src="/logo-white.svg"
              alt="RadarThing"
              width={110}
              height={33}
              priority
            />
          )}
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {SITE_NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={
                  isActive(pathname, link.href) ? "page" : undefined
                }
                className={linkClass(link.href)}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <div className="flex h-9 items-center">
            <UserAuth hidePersonalInfo={hidePersonalInfo} />
          </div>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-200 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none md:hidden"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          id={menuId}
          className="border-t border-white/10 bg-black/80 px-4 pb-4 md:hidden"
        >
          <ul className="flex flex-col py-2">
            {[
              ...SITE_NAV_LINKS,
              // Signed-out users already have the Sign in button in the bar.
              ...(isLoaded && isSignedIn
                ? [{ href: "/dashboard", label: accountLabel }]
                : []),
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={
                    isActive(pathname, link.href) ? "page" : undefined
                  }
                  className={`flex min-h-11 items-center ${linkClass(link.href)}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
