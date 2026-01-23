"use client";

import React, { useState, useEffect } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

export const UserAuth = () => {
  const { isSignedIn, isLoaded } = useUser();
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
      <div className="flex h-full items-center justify-center leading-none">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "border border-cyan-400/50 w-8 h-8",
              userButtonTrigger: "focus:shadow-none focus:outline-none",
            },
          }}
        />
      </div>
    );
  }

  return (
    <SignInButton mode="modal">
      <button className={`${baseStyle} ${cyanStyle}`}>SIGN IN</button>
    </SignInButton>
  );
};
