"use client";

import React from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

export const UserAuth = () => {
  const { isSignedIn, user, isLoaded } = useUser();

  if (!isLoaded) return null;

  const baseStyle =
    "flex items-center rounded-md border font-mono text-[12px] font-semibold px-3 py-1.5 transition-all duration-200 bg-black/70 cursor-pointer";

  // Match the "Live" cyan indicator style
  const cyanStyle =
    "border-cyan-400/30 text-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.4)] hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(0,255,255,0.6)]";

  if (isSignedIn) {
    return (
      <div className="">
        <UserButton 
          appearance={{
            elements: {
              avatarBox: "border border-cyan-400/50"
            }
          }}
        />
      </div>
    );
  }

  return (
    <SignInButton mode="modal">
      <button className={`${baseStyle} ${cyanStyle}`}>
        SIGN IN
      </button>
    </SignInButton>
  );
};