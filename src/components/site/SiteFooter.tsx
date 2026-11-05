import Link from "next/link";
import { PrivacySettingsButton } from "~/components/privacy/PrivacySettingsButton";

const FOOTER_GROUPS = [
  {
    heading: "Product",
    links: [
      { href: "/radar", label: "Live radar" },
      { href: "/leaderboard", label: "Leaderboard" },
      { href: "/aircraft-images", label: "Aircraft gallery" },
      { href: "/pricing", label: "Pricing" },
      // Redirects to the .user.js file, which Tampermonkey intercepts, so it
      // must be a normal anchor rather than a client-side route.
      { href: "/userscript", label: "Install the GeoFS script", native: true },
    ],
  },
  {
    heading: "Help",
    links: [
      { href: "/guides", label: "Guides" },
      { href: "/guides/getting-started", label: "Getting started" },
      { href: "/contact", label: "Contact" },
      {
        href: "https://discord.gg/pbQF4txdRC",
        label: "Discord community",
        external: true,
      },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/about", label: "About" },
      { href: "/privacy", label: "Privacy" },
      { href: "/cookies", label: "Cookies" },
      { href: "/terms", label: "Terms" },
      { href: "/copyright", label: "Copyright" },
    ],
  },
] as const;

/** One footer for every website page with the full set of links. */
export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`relative z-10 border-t border-white/10 bg-black/30 ${className}`}
    >
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 md:grid-cols-4">
        <div>
          <p className="text-sm font-semibold text-white">RadarThing</p>
          <p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">
            The live flight radar for GeoFS pilots and controllers.
          </p>
          <p className="mt-4 text-xs text-slate-400">
            © {new Date().getFullYear()} RadarThing
          </p>
        </div>
        {FOOTER_GROUPS.map((group) => (
          <nav key={group.heading} aria-label={group.heading}>
            <p className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
              {group.heading}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {group.links.map((link) => (
                <li key={link.href}>
                  {"external" in link && link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : "native" in link && link.native ? (
                    <a
                      href={link.href}
                      className="text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
              {group.heading === "Legal" && (
                <li>
                  <PrivacySettingsButton className="cursor-pointer text-slate-400 transition-colors hover:text-white" />
                </li>
              )}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
