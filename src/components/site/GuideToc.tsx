"use client";

import { useEffect, useState } from "react";

/**
 * "On this page" list that marks the section currently being read, so long
 * guides keep the reader oriented.
 */
export function GuideToc({
  sections,
}: {
  sections: { id: string; title: string }[];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const headings = sections
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      // A heading counts as current once it reaches the top third.
      { rootMargin: "0px 0px -66% 0px" },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="On this page"
      className="my-8 border-l-2 border-cyan-300/40 bg-cyan-300/[0.03] px-5 py-4"
    >
      <p className="!mt-0 !mb-2 font-mono !text-xs !leading-5 tracking-widest !text-slate-400 uppercase">
        On this page
      </p>
      <ol className="!my-0 !list-none columns-1 gap-8 !pl-0 sm:columns-2">
        {sections.map((section) => {
          const isActive = section.id === activeId;
          return (
            <li key={section.id} className="!mb-1 !pl-0 !leading-7">
              <a
                href={`#${section.id}`}
                aria-current={isActive ? "location" : undefined}
                className={`!no-underline hover:!text-cyan-200 ${isActive ? "!text-cyan-200" : "!text-slate-300"}`}
              >
                {section.title}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
