import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { getGuide, getGuidesByCategory, guides } from "~/lib/guides";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return guides.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = guides.find((entry) => entry.slug === slug);
  if (!guide) notFound();
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      type: "article",
      title: guide.title,
      description: guide.description,
      url: `/guides/${guide.slug}`,
      modifiedTime: guide.updated,
    },
  };
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const articleStyles = [
  "max-w-3xl min-w-0",
  "[&_a]:text-cyan-200 [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-white",
  "[&_h1]:mb-6 [&_h1]:text-4xl [&_h1]:leading-tight [&_h1]:font-semibold [&_h1]:tracking-tight md:[&_h1]:text-5xl",
  "[&_h1+p]:text-lg [&_h1+p]:text-slate-300",
  "[&_h2]:mt-14 [&_h2]:mb-4 [&_h2]:scroll-mt-8 [&_h2]:border-t [&_h2]:border-white/10 [&_h2]:pt-8 [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:text-white",
  "[&_h3]:mt-9 [&_h3]:mb-3 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-cyan-100",
  "[&_p]:my-5 [&_p]:leading-8 [&_p]:text-slate-300",
  "[&_strong]:font-semibold [&_strong]:text-white",
  "[&_li]:mb-2.5 [&_li]:pl-1 [&_li]:leading-8 [&_li]:text-slate-300 [&_li_p]:my-0",
  "[&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-5 [&_ul]:list-disc [&_ul]:pl-6 [&_li::marker]:text-cyan-300/70",
  "[&_blockquote]:my-6 [&_blockquote]:border-l-2 [&_blockquote]:border-cyan-300/50 [&_blockquote]:bg-cyan-300/[0.04] [&_blockquote]:px-5 [&_blockquote]:py-1 [&_blockquote_p]:text-slate-200",
  "[&_code]:rounded [&_code]:bg-white/[0.07] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-cyan-100",
  "[&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-black/40 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:leading-6",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
].join(" ");

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) notFound();
  const categories = getGuidesByCategory();
  const category = categories.find((entry) => entry.id === guide.category);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: guide.title,
    description: guide.description,
    dateModified: guide.updated,
    url: `https://radarthing.com/guides/${guide.slug}`,
    publisher: {
      "@type": "Organization",
      name: "RadarThing",
      url: "https://radarthing.com",
    },
  };

  return (
    <div className="grid gap-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <aside>
        <Link
          href="/guides"
          className="font-mono text-xs tracking-widest text-cyan-300 uppercase hover:underline"
        >
          ← All guides
        </Link>
        <nav
          aria-label="Guide navigation"
          className="mt-6 hidden flex-col gap-7 lg:sticky lg:top-8 lg:flex lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pb-8"
        >
          {categories.map((section) => (
            <div key={section.id}>
              <p className="mb-2 font-mono text-[11px] tracking-[0.18em] text-slate-500 uppercase">
                {section.title}
              </p>
              <div className="flex flex-col">
                {section.guides.map((entry) => (
                  <Link
                    key={entry.slug}
                    href={`/guides/${entry.slug}`}
                    aria-current={slug === entry.slug ? "page" : undefined}
                    className={`border-l-2 py-1.5 pl-4 text-sm leading-6 ${slug === entry.slug ? "border-cyan-300 text-cyan-200" : "border-white/10 text-slate-400 hover:border-white/40 hover:text-white"}`}
                  >
                    {entry.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <p className="mb-6 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs tracking-wider text-slate-500 uppercase">
          {category ? (
            <span className="text-cyan-300/80">{category.title}</span>
          ) : null}
          <span aria-hidden="true">·</span>
          <span>{guide.readingMinutes} min read</span>
          <span aria-hidden="true">·</span>
          <span>
            Updated{" "}
            <time dateTime={guide.updated}>
              {dateFormatter.format(new Date(`${guide.updated}T00:00:00Z`))}
            </time>
          </span>
        </p>
        <article className={articleStyles}>
          <Markdown>{guide.markdown}</Markdown>
        </article>
        <nav
          aria-label="More guides"
          className="mt-16 grid max-w-3xl gap-4 border-t border-white/10 pt-8 sm:grid-cols-2"
        >
          {guide.previous ? (
            <Link
              href={`/guides/${guide.previous.slug}`}
              className="group border border-white/10 p-5 transition-colors hover:border-cyan-300/40 hover:bg-cyan-300/5"
            >
              <span className="font-mono text-xs tracking-widest text-slate-500 uppercase">
                ← Previous
              </span>
              <span className="mt-2 block text-slate-200 group-hover:text-cyan-200">
                {guide.previous.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {guide.next ? (
            <Link
              href={`/guides/${guide.next.slug}`}
              className="group border border-white/10 p-5 text-right transition-colors hover:border-cyan-300/40 hover:bg-cyan-300/5"
            >
              <span className="font-mono text-xs tracking-widest text-slate-500 uppercase">
                Next →
              </span>
              <span className="mt-2 block text-slate-200 group-hover:text-cyan-200">
                {guide.next.title}
              </span>
            </Link>
          ) : null}
        </nav>
        <p className="mt-10 max-w-3xl text-sm text-slate-400">
          Spotted something out of date or need a hand?{" "}
          <Link
            href="/contact"
            className="text-cyan-200 underline underline-offset-4 hover:text-white"
          >
            Contact support
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
