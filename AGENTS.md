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

Userscript:
```bash
bun run build:userscript   # Rebuild userscript installer, loader, manifest, and bundles after userscript changes
```
Do not hand-edit generated userscript artifacts in `public/userscript/` or `radarthing.user.js`. Edit the source files, then run `bun run build:userscript`.
Generated userscript artifacts are gitignored and should not be committed.

## Other Parts of the project 
This app uses a SSE stream to get the flight data. The SSE code is in ../radar-sse.

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

### Userscript Workflow

Editable userscript source files:
- `userscript.js`
- `seabus.js`
- `jth.js`
- `userscript-src/radarthing-runtime.js`
- `userscript-src/config.json` only when changing the userscript version or hosted base URL
- `userscript-src/config.json` also controls the public `/userscript` and `/loader` URLs embedded in the generated installer
- `scripts/build-userscript.mjs` only when changing the userscript build pipeline

Generated userscript artifacts:
- `radarthing.user.js`
- `public/userscript/radarthing.user.js`
- `public/userscript/radarthing.loader.js`
- `public/userscript/radarthing.bundle.js`
- `public/userscript/latest.json`
- `public/userscript/releases/<version>/radarthing.bundle.js`

Commit rules for userscript changes:
- Always commit the edited source files listed above.
- Do not commit generated userscript artifacts. They are gitignored.
- Never manually patch generated userscript artifacts. Rebuild them from source instead.
- Run `bun run build:userscript` locally when testing userscript changes.
- The main app `build` script regenerates userscript artifacts automatically before `next build`, so deploys still include them.

End-user install flow:
- Tampermonkey users install `/userscript`.
- That installer loads `/loader`.
- The loader reads `/userscript/latest.json` and loads the current bundle, falling back to `/userscript/radarthing.bundle.js` if needed.
- Console users open GeoFS, paste the loader snippet shown on the homepage into DevTools Console, and run it.
- Console installs are not persistent across full page reloads, so users must rerun the snippet or save it as a DevTools Snippet/bookmarklet.
