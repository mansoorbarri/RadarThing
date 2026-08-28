import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    CLERK_SECRET_KEY: z.string(),
    CLERK_WEBHOOK_SECRET: z.string(),
    STRIPE_SECRET_KEY: z.string(),
    STRIPE_WEBHOOK_SECRET: z.string(),
    STRIPE_PRICE_ID: z.string(),
    UPLOADTHING_TOKEN: z.string(),
    RESEND_API_KEY: z.string(),
    POSTHOG_API_KEY: z.string(),
    POSTHOG_PROJECT_ID: z.string(),
    AVIAPAGES_API_KEY: z.string().optional(),
    AVWX_TOKEN: z.string(),
    OPENWEATHERMAP_API_KEY: z.string(),
    CONVEX_SYSTEM_SECRET: z.string(),
    VSTRIPS_INTEGRATION_SECRET: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_URL: z.string(),
    NEXT_PUBLIC_CONVEX_URL: z.string().url(),
    NEXT_PUBLIC_OPENAIP_API_KEY: z.string(),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string(),
    NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT: z.string().optional(),
    NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT: z.string().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_OPENAIP_API_KEY: process.env.NEXT_PUBLIC_OPENAIP_API_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
    UPLOADTHING_TOKEN: process.env.UPLOADTHING_TOKEN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
    POSTHOG_PROJECT_ID: process.env.POSTHOG_PROJECT_ID,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT:
      process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT,
    NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT:
      process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT,
    AVIAPAGES_API_KEY: process.env.AVIAPAGES_API_KEY,
    AVWX_TOKEN: process.env.AVWX_TOKEN,
    OPENWEATHERMAP_API_KEY: process.env.OPENWEATHERMAP_API_KEY,
    CONVEX_SYSTEM_SECRET: process.env.CONVEX_SYSTEM_SECRET,
    VSTRIPS_INTEGRATION_SECRET: process.env.VSTRIPS_INTEGRATION_SECRET,
  },
  /**
   * Skip validation explicitly via `SKIP_ENV_VALIDATION`, or automatically on Vercel preview
   * deployments where not every production secret is available.
   */
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.VERCEL_ENV === "preview",
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
