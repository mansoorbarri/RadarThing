"use client";

import React, { useState, useEffect } from "react";
import { SignInButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";

export const UserAuth = () => {
  const { isSignedIn, isLoaded, user } = useUser();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isLoaded) return null;

  const baseStyle =
    "flex items-center justify-center rounded-md border font-mono text-[12px] font-semibold px-3 py-1.5 transition-all duration-200 bg-black/70 cursor-pointer";

  const cyanStyle =
    "border-cyan-400/30 text-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.4)] hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,255,255,0.6)]";

  if (isSignedIn) {
    return (
      <Link
        href="/dashboard"
        className="flex h-full items-center justify-center leading-none"
      >
        <Image
          src={user?.imageUrl ?? ""}
          alt="Account"
          width={32}
          height={32}
          className="rounded-full border border-cyan-400/50 transition-all hover:border-cyan-400 hover:shadow-[0_0_8px_rgba(0,255,255,0.4)]"
        />
      </Link>
    );
  }

  return (
    <SignInButton mode="modal">
      <button className={`${baseStyle} ${cyanStyle}`}>SIGN IN</button>
    </SignInButton>
  );
};
