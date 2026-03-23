# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A modern, real-time flight radar for the GeoFS flight simulator. Built with Next.js 15, React 19, and Convex.

## Build and Development Commands

**Never run build or dev server unless explicitly asked.**

```bash
bun lint              # ESLint
bun typecheck         # TypeScript check
bun run check         # Run lint + typecheck together
bun run format:write  # Prettier auto-format
```

Supporting services for local development:
```bash
bun run cf            # Cloudflare tunnel (radarthing-dev)
bun run stripe        # Stripe webhook listener → localhost:3000/api/webhooks/stripe
```

Convex:
```bash
bunx convex dev       # Run after any changes in convex/ folder
```
Notify me to run deploy command when there are changes in the Convex folder.

## Design Guidelines

- Always create dark websites unless explicitly specified
- Use shadcn for components and icons
- Use Tailwind for CSS
- Use TypeScript; only use JS if there's no TS solution or it's objectively better

### Environment Variables

Validated in `src/env.js` using T3 Env. Server-side vars include Clerk, Stripe, Uploadthing, Resend keys. Client-side vars are prefixed with `NEXT_PUBLIC_`. NEVER add `.optional()` unless told so. Add new environment variables to `.env.example`. 

### New Features
When adding new features, make sure to add PostHog hooks **IF** it makes sense. For example, adding it on an upload button to upload airport charts would not make sense but it would make sense to add the posthog hook for clicking the button to go to the page for uploading the airport charts.

### What's New Notifications
When a new user-facing feature is added, add an entry to the top of the `changelog` array in `src/lib/changelog.ts`. This automatically triggers a toast notification and shows an unread dot on the megaphone icon in the radar header (`src/components/ui/WhatsNew.tsx`) for all users on their next visit.

### SSE Stream
this project using a SSE stream to get the flight details. this is located at @../radar-sse/. 
