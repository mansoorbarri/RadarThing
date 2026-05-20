# RadarThing

A modern, real-time flight radar for the GeoFS flight simulator. Built with Next.js 15, React 19, and Convex. Features professional-grade ATC tools, METAR overlays, airport charts integration, and a clean dark interface designed for serious flight simulation enthusiasts.

## Design

- Don't create AI slop with basic and cliché designs
- Always create dark websites unless explicitly specified
- Use shadcn for components and icons
- Use Tailwind for CSS

## Technical Stack

When creating a new app:

- Use Clerk for auth, Convex for DB, Stripe for payment, Zod for validation, UploadThing for files
- Always use T3-stack
- Use TypeScript where possible; only use JS if there's no TS solution or it's objectively better—then exclude in `tsconfig` and lint
- Use pnpm for package management and script execution
- **Never run build or dev server unless explicitly asked**

## Lint and Typecheck

```bash
pnpm lint
pnpm typecheck
```

## Convex

- Always run `pnpm run convex:dev` whenever you make any changes in the `convex/` folder
- Notify me to run deploy command when there are changes in the Convex folder

## Environment Variables

- When something requires an env var, add it in `src/env.js`
- Don't use `.optional()` on any environment variable unless explicitly specified
- Add new environment variables to `.env.example`

## CI/CD

When creating a new project:

- Create a GitHub workflow to run lint and typecheck on pull requests and pushes to main
- Disable Vercel's default Git integration deployments (use `vercel --prod` manually or GitHub Actions with Vercel CLI instead)
