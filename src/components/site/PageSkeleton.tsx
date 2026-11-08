import { SiteHeader } from "~/components/site/SiteHeader";

/**
 * Route-level loading state: the real header straight away and a quiet
 * placeholder for the content, instead of a blank page.
 */
export function PageSkeleton({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="bg-site min-h-screen text-white">
      <SiteHeader />
      <main
        id="main-content"
        aria-busy="true"
        className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12"
      >
        <p role="status" className="sr-only">
          {label}
        </p>
        <div className="animate-pulse space-y-6 motion-reduce:animate-none">
          <div className="h-9 w-56 rounded-lg bg-white/[0.06]" />
          <div className="h-4 w-80 max-w-full rounded bg-white/[0.04]" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="h-28 rounded-2xl bg-white/[0.04]" />
            <div className="h-28 rounded-2xl bg-white/[0.04]" />
            <div className="h-28 rounded-2xl bg-white/[0.04]" />
          </div>
          <div className="h-72 rounded-2xl bg-white/[0.04]" />
        </div>
      </main>
    </div>
  );
}

/**
 * Loading state shaped like the gallery and chart pages: title, filter bar
 * and a card grid, so the page doesn't jump when it arrives.
 */
export function GridPageSkeleton({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="bg-site min-h-screen text-white">
      <SiteHeader />
      <main
        id="main-content"
        aria-busy="true"
        className="mx-auto max-w-6xl px-6 py-12"
      >
        <p role="status" className="sr-only">
          {label}
        </p>
        <div className="animate-pulse motion-reduce:animate-none">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-3 h-9 w-40 rounded-full bg-white/[0.06]" />
              <div className="mb-2 h-9 w-56 rounded-lg bg-white/[0.06]" />
              <div className="h-4 w-72 max-w-full rounded bg-white/[0.04]" />
            </div>
            <div className="h-12 w-36 rounded-xl bg-white/[0.06]" />
          </div>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row">
            <div className="h-10 flex-1 rounded-lg bg-white/[0.05]" />
            <div className="flex gap-3">
              <div className="h-10 w-32 rounded-lg bg-white/[0.05]" />
              <div className="h-10 w-32 rounded-lg bg-white/[0.05]" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-white/10 bg-black/40"
              >
                <div className="aspect-video bg-white/[0.05]" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-24 rounded bg-white/[0.06]" />
                  <div className="h-3 w-32 rounded bg-white/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
