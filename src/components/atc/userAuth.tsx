"use client";

import React, { useState, useEffect, useRef } from "react";
import { SignOutButton, useUser } from "@clerk/nextjs";
import Image from "next/image";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { GoogleSignInButton } from "~/components/auth/GoogleSignInButton";
import { QuietErrorBoundary } from "~/components/QuietErrorBoundary";
import { useProStatus } from "~/hooks/useProStatus";

const MENU_LINK_CLASS =
  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-cyan-400/10 hover:text-cyan-400";

/**
 * Role-dependent menu links (Admin, VA Admin). These need Convex, so they live in their own
 * component behind an error boundary: if a query fails, the menu (and any
 * page or error page showing the header) still renders without them.
 */
const RoleMenuLinks = ({ onNavigate }: { onNavigate: () => void }) => {
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const { isAdminUser } = useProStatus();
  const managedVirtualAirlines = useQuery(
    api.virtualAirlines.getManagedByAdmin,
    user?.id && isAuthenticated ? { adminClerkId: user.id } : "skip",
  );

  return (
    <>
      {isAdminUser && (
        <Link href="/admin" onClick={onNavigate} className={MENU_LINK_CLASS}>
          <User className="h-4 w-4" />
          Admin
        </Link>
      )}
      {(managedVirtualAirlines?.length ?? 0) > 0 && (
        <Link href="/va-admin" onClick={onNavigate} className={MENU_LINK_CLASS}>
          <User className="h-4 w-4" />
          VA Admin
        </Link>
      )}
    </>
  );
};

export const UserAuth = ({
  hidePersonalInfo = false,
}: {
  hidePersonalInfo?: boolean;
}) => {
  const { isSignedIn, isLoaded, user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) {
      document.addEventListener("mousedown", handler);
      document.addEventListener("keydown", onKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!mounted || !isLoaded) return null;

  const baseStyle =
    "flex min-h-9 items-center justify-center whitespace-nowrap rounded-md border text-[12px] font-semibold px-2.5 py-1.5 sm:px-3 sm:text-[13px] transition-all duration-200 bg-black/70 cursor-pointer";

  const cyanStyle =
    "border-cyan-400/30 text-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.4)] hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,255,255,0.6)]";

  if (isSignedIn) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Account menu"
          className="flex h-full cursor-pointer items-center justify-center rounded-full leading-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
        >
          {user?.imageUrl ? (
            <Image
              src={user.imageUrl}
              alt="Account"
              width={32}
              height={32}
              sizes="32px"
              className={`rounded-full border border-cyan-400/50 transition-all duration-300 ease-out will-change-[filter] hover:border-cyan-400 hover:shadow-[0_0_8px_rgba(0,255,255,0.4)] ${
                hidePersonalInfo ? "blur-[5px] select-none" : ""
              }`}
            />
          ) : (
            <div className="h-8 w-8 rounded-full border border-cyan-400/50 bg-cyan-400/10" />
          )}
        </button>

        {open && (
          <div className="absolute top-full right-0 z-50 mt-2 w-44 rounded-xl border border-cyan-400/30 bg-black/90 p-1.5 shadow-[0_0_15px_rgba(0,255,255,0.1)] backdrop-blur-xl">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className={MENU_LINK_CLASS}
            >
              <User className="h-4 w-4" />
              Dashboard
            </Link>
            <QuietErrorBoundary source="account_menu_role_links">
              <RoleMenuLinks onNavigate={() => setOpen(false)} />
            </QuietErrorBoundary>
            <SignOutButton redirectUrl="/radar">
              <button className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-cyan-400/10 hover:text-cyan-400">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </SignOutButton>
          </div>
        )}
      </div>
    );
  }

  return (
    <GoogleSignInButton>
      <button type="button" className={`${baseStyle} ${cyanStyle}`}>
        Sign in
      </button>
    </GoogleSignInButton>
  );
};
