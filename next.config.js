/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import { env } from "./src/env.js";
import { withPostHogConfig } from "@posthog/nextjs-config";

// PostHog requests go through our own domain so ad blockers that block
// *.posthog.com do not drop analytics from users who opted in.
const POSTHOG_PROXY_PATH = "/rt";
const posthogHost = env.NEXT_PUBLIC_POSTHOG_HOST.replace(/\/$/, "");
const posthogAssetsHost = posthogHost.replace(
  ".i.posthog.com",
  "-assets.i.posthog.com",
);

/** @type {import("next").NextConfig} */
const config = {
  // PostHog API paths end in a slash; redirecting them would break ingestion.
  skipTrailingSlashRedirect: true,
  // Skip during build - CI already runs these
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.ufs.sh",
        pathname: "/f/**",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: `${POSTHOG_PROXY_PATH}/static/:path*`,
        destination: `${posthogAssetsHost}/static/:path*`,
      },
      {
        source: `${POSTHOG_PROXY_PATH}/array/:path*`,
        destination: `${posthogAssetsHost}/array/:path*`,
      },
      {
        source: `${POSTHOG_PROXY_PATH}/:path*`,
        destination: `${posthogHost}/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/userscript",
        destination: "/userscript/radarthing.user.js",
        permanent: false,
      },
      {
        source: "/loader",
        destination: "/userscript/radarthing.loader.js",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // A full script-src/default-src allowlist is intentionally not set
            // here: the app loads maps, ads, Clerk, Stripe, Convex, UploadThing
            // and PostHog, so a nonce-based policy needs its own report-only
            // rollout to avoid breaking production. These host-agnostic
            // directives harden against injection with no breakage risk:
            // object-src 'none' blocks <object>/<embed> vectors and base-uri
            // 'self' blocks <base>-tag hijacking of relative URLs.
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://klmgeofsvirtual.github.io; base-uri 'self'; object-src 'none'",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default withPostHogConfig(config, {
  personalApiKey: env.POSTHOG_API_KEY,
  projectId: env.POSTHOG_PROJECT_ID,
  host: env.NEXT_PUBLIC_POSTHOG_HOST,
});
