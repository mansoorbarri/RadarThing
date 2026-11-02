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
      modifiedTime: guide.updated,
    },
    twitter: {
      card: "summary",
      title: guide.title,
      description: guide.description,
    },
  };
}
export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) notFound();
  return (
    <div className="grid gap-12 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-20">
      <aside>
        <Link
          href="/guides"
          className="font-mono text-xs tracking-widest text-cyan-300 uppercase hover:underline"
        >
          ← All guides
        </Link>
        <nav
          aria-label="Guide navigation"
          className="mt-6 flex flex-col gap-1 lg:sticky lg:top-8"
        >
          {getGuidesByCategory().map(({ category, guides: categoryGuides }) => (
            <div key={category} className="mb-4">
              <p className="mb-1 font-mono text-[10px] tracking-[0.2em] text-slate-500 uppercase">
                {category}
              </p>
              {categoryGuides.map((entry) => (
                <Link
                  key={entry.slug}
                  href={`/guides/${entry.slug}`}
                  aria-current={slug === entry.slug ? "page" : undefined}
                  className={`block border-l-2 py-2 pl-4 text-sm leading-6 ${slug === entry.slug ? "border-cyan-300 text-cyan-200" : "border-white/10 text-slate-400 hover:border-white/40 hover:text-white"}`}
                >
                  {entry.title}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <article className="max-w-3xl min-w-0 [&_a]:text-cyan-200 [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-white [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-cyan-100 [&_h1]:mb-7 [&_h1]:text-4xl [&_h1]:leading-tight [&_h1]:font-semibold [&_h1]:tracking-tight md:[&_h1]:text-5xl [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:border-t [&_h2]:border-white/10 [&_h2]:pt-8 [&_h2]:text-xl [&_h2]:font-medium [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-lg [&_h3]:font-medium [&_li]:mb-3 [&_li]:leading-8 [&_li]:text-slate-300 [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-5 [&_p]:leading-8 [&_p]:text-slate-300 [&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-black/40 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:leading-6 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:text-white [&_ul]:list-disc [&_ul]:pl-6">
        <div className="mb-6 font-mono text-xs tracking-widest text-slate-500 uppercase">
          {guide.category} · Updated{" "}
          <time dateTime={guide.updated}>
            {new Date(`${guide.updated}T00:00:00Z`).toLocaleDateString(
              "en-GB",
              {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              },
            )}
          </time>
        </div>
        <Markdown>{guide.markdown}</Markdown>
        {(guide.previous ?? guide.next) && (
          <nav
            aria-label="More guides"
            className="mt-14 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-2"
          >
            {guide.previous ? (
              <Link
                href={`/guides/${guide.previous.slug}`}
                className="block border border-white/10 p-4 !no-underline hover:border-cyan-300/40"
              >
                <span className="block font-mono text-xs text-slate-500 uppercase">
                  ← Previous
                </span>
                <span className="mt-1 block text-white">
                  {guide.previous.title}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {guide.next && (
              <Link
                href={`/guides/${guide.next.slug}`}
                className="block border border-white/10 p-4 text-right !no-underline hover:border-cyan-300/40"
              >
                <span className="block font-mono text-xs text-slate-500 uppercase">
                  Next →
                </span>
                <span className="mt-1 block text-white">
                  {guide.next.title}
                </span>
              </Link>
            )}
          </nav>
        )}
        <div className="mt-10 border-t border-white/10 pt-6 text-sm text-slate-400">
          Need a hand? <Link href="/contact">Contact support</Link>.
        </div>
      </article>
    </div>
  );
}
