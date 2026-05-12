import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and public API routes that never use Clerk auth.
    "/((?!_next|api/weather|api/userscript/charts|api/bot/reminders|api/webhooks|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/((api|trpc)(?!/weather|/userscript/charts|/bot/reminders|/webhooks).*)",
  ],
};
