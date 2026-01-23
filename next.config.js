/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import("next").NextConfig} */
const config = {
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
        hostname: "8knm0qcclu.ufs.sh",
        pathname: "/f/*",
      },
      {
        protocol: "https",
        hostname: "82ohxjlwgh.ufs.sh",
        pathname: "/f/*",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
};

export default withSentryConfig(config, {
  // Sentry organization and project
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only upload source maps in production builds
  silent: !process.env.CI,

  // Upload source maps to Sentry
  widenClientFileUpload: true,

  // Source maps configuration
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Webpack configuration
  webpack: {
    // Tree-shake Sentry debug logging
    treeshake: {
      removeDebugLogging: true,
    },
    // Automatically instrument React components
    reactComponentAnnotation: {
      enabled: true,
    },
  },

  // Route browser requests to Sentry through a Next.js rewrite
  tunnelRoute: "/monitoring",
});
