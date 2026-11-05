import Link from "next/link";
import { SiteFooter } from "~/components/site/SiteFooter";
import { SiteHeader } from "~/components/site/SiteHeader";

// Signed-in banned accounts see the account notice from ModerationGate.
// Anyone else who lands here gets a normal page with a way back.
export default function BannedPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#02090d] text-slate-100">
      <SiteHeader />
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center px-6 py-16"
      >
        <h1 className="text-3xl font-semibold text-white">
          Nothing to show here
        </h1>
        <p className="mt-3 text-slate-300">
          This page is only used for account restrictions. If you think your
          account was restricted by mistake, contact us.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/radar"
            className="rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-black hover:bg-cyan-300"
          >
            Back to the radar
          </Link>
          <Link
            href="/contact"
            className="rounded-lg border border-white/15 px-5 py-3 font-medium text-white hover:bg-white/5"
          >
            Contact us
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
