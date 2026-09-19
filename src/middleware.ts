import { clerkMiddleware } from "@clerk/nextjs/server";

import { fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "../convex/_generated/api";

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();
  if (!userId) return;
  const path = request.nextUrl.pathname;
  // Keep account management, legal information, and authentication available.
  if (
    ["/banned", "/terms", "/privacy", "/sso-callback"].some(
      (route) => path === route || path.startsWith(`${route}/`),
    )
  )
    return;
  const user = await fetchQuery(api.users.getByClerkId, { clerkId: userId });
  if (!user?.activeBanId) return;
  if (path.startsWith("/api/") || request.method !== "GET")
    return NextResponse.json({ error: "Account banned" }, { status: 403 });
  return NextResponse.redirect(new URL("/banned", request.url));
});

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and public API routes that never use Clerk auth.
    "/((?!_next|api/weather|api/userscript/charts|api/userscript/tracking-status|api/bot/reminders|api/webhooks|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
