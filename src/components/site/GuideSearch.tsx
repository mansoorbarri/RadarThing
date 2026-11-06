"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { slugify } from "~/lib/slugify";

export interface GuideSearchEntry {
  slug: string;
  title: string;
  description: string;
  category: string;
  /** Section headings, so a search can match inside a guide. */
  sections?: string[];
}

/** Filters the guides by title, description or section as you type. */
export function GuideSearch({ guides }: { guides: GuideSearchEntry[] }) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const resultsId = useId();

  const results = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return null;
    return guides
      .filter((guide) => {
        const haystack =
          `${guide.title} ${guide.description} ${guide.category} ${(guide.sections ?? []).join(" ")}`.toLowerCase();
        return terms.every((term) => haystack.includes(term));
      })
      .map((guide) => {
        // When the match is inside the guide, point straight at that section.
        const intro = `${guide.title} ${guide.description}`.toLowerCase();
        const section = terms.every((term) => intro.includes(term))
          ? undefined
          : guide.sections?.find((heading) =>
              terms.some((term) => heading.toLowerCase().includes(term)),
            );
        return { ...guide, matchedSection: section };
      });
  }, [guides, query]);

  return (
    <div className="mt-10 max-w-2xl">
      <label htmlFor={inputId} className="sr-only">
        Search the guides
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the guides, e.g. squawk, METAR, not appearing"
          aria-controls={resultsId}
          autoComplete="off"
          className="h-12 w-full border border-white/15 bg-white/[0.03] pr-4 pl-11 text-base text-white placeholder:text-slate-400 focus:border-cyan-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40"
        />
      </div>
      {/* Always present so screen readers announce the count reliably;
          the list itself isn't read out on every keystroke. */}
      <p aria-live="polite" className="sr-only">
        {results
          ? results.length === 0
            ? `No guides match ${query.trim()}`
            : `${results.length} ${results.length === 1 ? "guide" : "guides"} found`
          : ""}
      </p>
      <div id={resultsId}>
        {results && (
          <div className="mt-3 border border-white/10 bg-black/30">
            <p className="border-b border-white/10 px-4 py-2 text-sm text-slate-400">
              {results.length === 0
                ? `No guides match "${query.trim()}".`
                : `${results.length} ${results.length === 1 ? "guide" : "guides"} found`}
            </p>
            {results.length > 0 && (
              <ul>
                {results.map((guide) => (
                  <li
                    key={guide.slug}
                    className="border-b border-white/5 last:border-b-0"
                  >
                    <Link
                      href={`/guides/${guide.slug}${guide.matchedSection ? `#${slugify(guide.matchedSection)}` : ""}`}
                      className="block px-4 py-3 hover:bg-cyan-300/5 focus-visible:bg-cyan-300/5 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none focus-visible:ring-inset"
                    >
                      <span className="block font-medium text-white">
                        {guide.title}
                      </span>
                      {guide.matchedSection && (
                        <span className="mt-0.5 block text-sm text-cyan-200">
                          Section: {guide.matchedSection}
                        </span>
                      )}
                      <span className="mt-0.5 block text-sm text-slate-400">
                        {guide.category} · {guide.description}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {results.length === 0 && (
              <p className="px-4 py-3 text-sm text-slate-300">
                Try a shorter word, or{" "}
                <Link
                  href="/contact"
                  className="text-cyan-200 underline underline-offset-4"
                >
                  ask us
                </Link>
                .
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
