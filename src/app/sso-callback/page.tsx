"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

export default function SsoCallbackPage() {
  return (
    <main
      id="main-content"
      className="bg-site flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center text-slate-200"
    >
      <Loader2
        className="h-8 w-8 animate-spin text-cyan-300 motion-reduce:animate-none"
        aria-hidden="true"
      />
      <p role="status" className="text-base">
        Signing you in…
      </p>
      {/* Completes the Google sign-in and redirects when it's done. */}
      <AuthenticateWithRedirectCallback />
    </main>
  );
}
