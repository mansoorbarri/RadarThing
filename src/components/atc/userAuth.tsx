"use client";

import React, { useState, useEffect, useRef } from "react";
import { SignInButton, SignOutButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { LogOut, User } from "lucide-react";

export const UserAuth = () => {
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
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!mounted || !isLoaded) return null;

  const baseStyle =
    "flex items-center justify-center rounded-md border font-mono text-[12px] font-semibold px-3 py-1.5 transition-all duration-200 bg-black/70 cursor-pointer";

  const cyanStyle =
    "border-cyan-400/30 text-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.4)] hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,255,255,0.6)]";

  if (isSignedIn) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen(!open)}
          className="flex h-full cursor-pointer items-center justify-center leading-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={user?.imageUrl ?? ""}
            alt="Account"
            width={32}
            height={32}
            className="rounded-full border border-cyan-400/50 transition-all hover:border-cyan-400 hover:shadow-[0_0_8px_rgba(0,255,255,0.4)]"
          />
        </button>

        {open && (
          <div className="absolute top-full right-0 z-50 mt-2 w-44 rounded-xl border border-cyan-400/30 bg-black/90 p-1.5 shadow-[0_0_15px_rgba(0,255,255,0.1)] backdrop-blur-xl">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-cyan-400/10 hover:text-cyan-400"
            >
              <User className="h-4 w-4" />
              Account
            </Link>
            <SignOutButton redirectUrl="/radar">
              <button className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-cyan-400/10 hover:text-cyan-400">
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </SignOutButton>
          </div>
        )}
      </div>
    );
  }

  return (
    <SignInButton mode="modal">
      <button className={`${baseStyle} ${cyanStyle}`}>SIGN IN</button>
    </SignInButton>
  );
};
