import type { Metadata } from "next";
import Link from "next/link";
import { GuideSearch } from "~/components/site/GuideSearch";
import { getGuidesByCategory, guides } from "~/lib/guides";

export const metadata: Metadata = {
  title: "Help & Guides",
  description:
    "Guides for GeoFS pilots: tracking flights on RadarThing, reading METARs and airport charts, radio phraseology, flight planning, and community features.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  const categories = getGuidesByCategory();

  return (
    <>
      <p className="mb-5 font-mono text-xs tracking-[0.22em] text-cyan-300 uppercase">
        RadarThing / Field manual
      </p>
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-6xl">
        A clearer view of your next flight.
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
        {guides.length} guides for GeoFS pilots. Set up your tracker, learn the
        radar, and fly more realistic flights with practical explanations of
        weather, charts, navigation, and radio calls.
      </p>

      <GuideSearch
        guides={categories.flatMap((category) =>
          category.guides.map((guide) => ({
            slug: guide.slug,
            title: guide.title,
            description: guide.description,
            category: category.title,
          })),
        )}
      />

      <nav
        aria-label="Guide sections"
        className="mt-8 flex flex-wrap gap-3 text-sm"
      >
        {categories.map((category) => (
          <a
            key={category.id}
            href={`#${category.id}`}
            className="inline-flex min-h-10 items-center border border-white/15 px-4 py-2 text-slate-300 transition-colors hover:border-cyan-300/50 hover:text-cyan-200"
          >
            {category.title}
          </a>
        ))}
      </nav>

      {categories.map((category) => (
        <section
          key={category.id}
          id={category.id}
          aria-labelledby={`${category.id}-title`}
          className="mt-16 scroll-mt-8"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2
              id={`${category.id}-title`}
              className="text-2xl font-semibold tracking-tight text-white"
            >
              {category.title}
            </h2>
            <p className="text-slate-400">{category.description}</p>
          </div>
          <div className="mt-6 border-t border-white/15">
            {category.guides.map((guide) => (
              <Link
                key={guide.slug}
                href={`/guides/${guide.slug}`}
                className="group grid gap-2 border-b border-white/15 py-6 transition-colors hover:bg-cyan-300/5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6 sm:px-4"
              >
                <div>
                  <h3 className="text-lg font-medium text-white group-hover:text-cyan-200">
                    {guide.title}
                  </h3>
                  <p className="mt-1.5 leading-7 text-slate-400">
                    {guide.description}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className="hidden text-xl text-cyan-300 transition-transform group-hover:translate-x-1 sm:block"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <p className="mt-16 text-slate-400">
        Can&apos;t find what you need?{" "}
        <Link
          href="/contact"
          className="text-cyan-200 underline underline-offset-4"
        >
          Contact support
        </Link>{" "}
        with the step you reached and what happened.
      </p>
    </>
  );
}
