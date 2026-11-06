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
