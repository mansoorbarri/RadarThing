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

## Architecture Overview

This is a Next.js 15 aviation radar tracking application using the App Router pattern with Convex as the backend database.

### Directory Structure

- `src/app/` - App Router pages and API routes
- `src/components/` - React components (atc/, map/, airports/, ui/, providers/)
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utilities including `aircraft-store.ts` (pub/sub for aircraft positions)
- `src/server/` - Server-only utilities (Convex client, Uploadthing)
- `src/services/` - External service integrations
- `convex/` - Convex schema and functions

### Key Patterns

**Real-time Data Flow:**
- Live aircraft positions come via SSE from `sse.radarthing.com`
- `useAircraftStream()` hook connects to the stream and updates `AircraftStore`
- `AircraftStore` is a custom pub/sub class managing flight positions and paths
- Convex handles persistent user data with real-time React hooks

**Map Rendering:**
- Leaflet map is dynamically imported with SSR disabled
- Aircraft markers use `leaflet-marker-rotation` for heading display

**Authentication & Authorization:**
- Clerk for authentication (middleware in `src/middleware.ts`)
- Three user roles: FREE, PRO, ADMIN (stored in Convex `users` table)
- `useProStatus()` hook checks subscription status
- Admin access also granted via `ADMIN_GOOGLE_ID` env var

### Convex Schema

Key tables in `convex/schema.ts`:
- `users` - Clerk integration, subscription tier (FREE/PRO/ADMIN), Stripe customer ID
- `flights` - Flight recordings with route data, statistics
- `aircraftImages` - Community aircraft photos with approval workflow
- `missingImageNotifications` - Discord webhook queue for missing images

### API Routes

- `/api/webhooks/clerk/` - User lifecycle events
- `/api/webhooks/stripe/` - Payment events sync to Convex
- `/api/uploadthing/` - Aircraft image uploads
- `/api/charts/[icao]/` - Airport taxi charts
- `/api/weather/*` - Aviation weather (NOTAMs, SIGMETs, AIRMETs)

### External Services

| Service | Purpose |
|---------|---------|
| Convex | Backend database with real-time sync |
| Clerk | Authentication |
| Stripe | Subscriptions and payments |
| Uploadthing | Image hosting |
| PostHog | Analytics |
| Resend | Email |
| AVWX/OpenWeatherMap | Aviation weather data |

### Path Alias

Use `~/` for imports from `src/`:
```typescript
import { something } from "~/lib/utils";
```

### Environment Variables

Validated in `src/env.js` using T3 Env. Server-side vars include Clerk, Stripe, Uploadthing, Resend keys. Client-side vars are prefixed with `NEXT_PUBLIC_`. NEVER add `.optional()` unless told so. Add new environment variables to `.env.example`. 

### New Features
When adding new features, make sure to add PostHog hooks **IF** it makes sense. For example, adding it on an upload button to upload airport charts would not make sense but it would make sense to add the posthog hook for clicking the button to go to the page for uploading the airport charts.
