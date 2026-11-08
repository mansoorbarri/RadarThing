import { SiteHeader } from "~/components/site/SiteHeader";

/** Placeholder rows, shaped like the real leaderboard rows. */
export function LeaderboardSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 sm:gap-4 sm:p-4"
        >
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-white/10 sm:h-9 sm:w-9" />
          <div className="flex-1">
            <div className="h-4 w-20 animate-pulse rounded bg-white/10 sm:w-28" />
          </div>
          <div className="h-4 w-14 animate-pulse rounded bg-white/10 sm:hidden" />
          <div className="hidden items-center gap-6 sm:flex">
            <div className="h-4 w-12 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-14 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-12 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-14 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Route loading state with the same header, title and row shapes as the
 * leaderboard, so the page doesn't jump when it arrives.
 */
export function LeaderboardPageSkeleton() {
  return (
    <div className="leaderboard-theme-surface bg-site min-h-screen text-white">
      <SiteHeader tone="themed" />
      <main
        id="main-content"
        aria-busy="true"
        className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12"
      >
        <p role="status" className="sr-only">
          Loading the leaderboard…
        </p>
        <div className="mb-6 flex items-center gap-3 sm:mb-8">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-white/10 sm:h-12 sm:w-12" />
          <div>
            <div className="mb-2 h-6 w-36 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-64 max-w-full animate-pulse rounded bg-white/[0.06]" />
          </div>
        </div>
        <div className="mb-6 h-11 w-full max-w-xl animate-pulse rounded-xl bg-white/[0.05]" />
        <LeaderboardSkeleton />
      </main>
    </div>
  );
}
