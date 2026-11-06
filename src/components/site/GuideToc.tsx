"use client";

import { useEffect, useState } from "react";

/**
 * "On this page" list that marks the section being read. On wide screens it
 * sits in the sticky sidebar so the highlight stays in view; on phones it's
 * inline under the guide's introduction.
 */
export function GuideToc({
  sections,
  variant = "inline",
}: {
  sections: { id: string; title: string }[];
  variant?: "inline" | "sidebar";
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    // The current section is the last heading that has scrolled above 35% of
    // the viewport; this works the same scrolling up as down.
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.35;
      let current: string | null = null;
      for (const section of sections) {
        const heading = document.getElementById(section.id);
        if (heading && heading.getBoundingClientRect().top <= line)
          current = section.id;
      }
      setActiveId(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sections]);

  const links = sections.map((section) => {
    const isActive = section.id === activeId;
    return (
      <li
        key={section.id}
        className={variant === "inline" ? "!mb-1 !pl-0 !leading-7" : undefined}
      >
        <a
          href={`#${section.id}`}
          aria-current={isActive ? "location" : undefined}
          className={
            variant === "inline"
              ? `!no-underline hover:!text-cyan-200 ${isActive ? "!text-cyan-200" : "!text-slate-300"}`
              : `block border-l-2 py-1.5 pl-4 text-sm leading-6 ${isActive ? "border-cyan-300 text-cyan-200" : "border-white/10 text-slate-400 hover:border-white/40 hover:text-white"}`
          }
        >
          {section.title}
        </a>
      </li>
    );
  });

  if (variant === "sidebar") {
    return (
      <nav aria-label="On this page" className="mb-8">
        <p className="mb-2 font-mono text-[11px] tracking-[0.18em] text-slate-400 uppercase">
          On this page
        </p>
        <ol>{links}</ol>
      </nav>
    );
  }

  return (
    <nav
      aria-label="On this page"
      className="my-8 border-l-2 border-cyan-300/40 bg-cyan-300/[0.03] px-5 py-4 lg:hidden"
    >
      <p className="!mt-0 !mb-2 font-mono !text-xs !leading-5 tracking-widest !text-slate-400 uppercase">
        On this page
      </p>
      <ol className="!my-0 !list-none columns-1 gap-8 !pl-0 sm:columns-2">
        {links}
      </ol>
    </nav>
  );
}
