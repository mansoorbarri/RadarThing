import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { getGuide, guides } from "~/lib/guides";

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
          {guides.map((entry) => (
            <Link
              key={entry.slug}
              href={`/guides/${entry.slug}`}
              aria-current={slug === entry.slug ? "page" : undefined}
              className={`border-l-2 py-3 pl-4 text-sm leading-6 ${slug === entry.slug ? "border-cyan-300 text-cyan-200" : "border-white/10 text-slate-400 hover:border-white/40 hover:text-white"}`}
            >
              {entry.title}
            </Link>
          ))}
        </nav>
      </aside>
      <article className="max-w-3xl min-w-0 [&_a]:text-cyan-200 [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-white [&_h1]:mb-7 [&_h1]:text-4xl [&_h1]:leading-tight [&_h1]:font-semibold [&_h1]:tracking-tight md:[&_h1]:text-5xl [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:border-t [&_h2]:border-white/10 [&_h2]:pt-8 [&_h2]:text-xl [&_h2]:font-medium [&_li]:mb-3 [&_li]:leading-8 [&_li]:text-slate-300 [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-5 [&_p]:leading-8 [&_p]:text-slate-300 [&_ul]:list-disc [&_ul]:pl-6">
        <Markdown>{guide.markdown}</Markdown>
        <div className="mt-14 border-t border-white/10 pt-6 text-sm text-slate-400">
          Need a hand? <Link href="/contact">Contact support</Link>.
        </div>
      </article>
    </div>
  );
}
