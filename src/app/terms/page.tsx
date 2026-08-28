import type { Metadata } from "next";
import { LegalPage, LegalSection } from "~/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing use of RadarThing and its userscript.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Operating agreement"
      title="Terms of service"
      summary="These terms govern RadarThing’s website, live radar, accounts, subscriptions, community uploads, and browser userscript."
    >
      <LegalSection title="Using RadarThing">
        <p>
          You must be at least 13 and legally able to agree to these terms. Keep
          your account secure and provide accurate information. Do not disrupt,
          probe, scrape at harmful rates, reverse engineer protected services,
          evade access controls, transmit malware, impersonate others, or use
          RadarThing unlawfully.
        </p>
      </LegalSection>

      <LegalSection title="Simulator only">
        <p>
          RadarThing is a community tool for the GeoFS flight simulator. It is
          not affiliated with or endorsed by GeoFS, airlines, aviation
          authorities, or data providers unless expressly stated. Radar,
          weather, chart, route, and ATC information must not be used for real
          aviation, navigation, safety, or emergency decisions.
        </p>
      </LegalSection>

      <LegalSection title="Userscript licence and behaviour">
        <p>
          The RadarThing userscript connects GeoFS simulator activity to
          RadarThing and may expose simulator controls described on the install
          page. Install it only on devices and accounts you are authorised to
          use. You may disable or uninstall it through your userscript manager
          at any time. The project&apos;s source-code licence applies where
          stated; these service terms do not grant rights to RadarThing branding
          or hosted data.
        </p>
      </LegalSection>

      <LegalSection title="Community submissions">
        <p>
          You retain ownership of content you submit. You confirm that you own
          it or have permission to upload, reproduce, and share it. You grant
          RadarThing a worldwide, non-exclusive, royalty-free licence to host,
          reproduce, resize, moderate, display, and distribute it for operating
          and promoting the service. Do not submit unlawful, unsafe, deceptive,
          hateful, sexually explicit, privacy-invasive, or rights-infringing
          material.
        </p>
        <p>
          We may reject or remove submissions and suspend upload access. Review
          does not transfer responsibility for the content to RadarThing. See
          the copyright page to report disputed material.
        </p>
      </LegalSection>

      <LegalSection title="Free service, advertising, and Pro">
        <p>
          The free tier may contain clearly identified third-party advertising.
          Do not click ads artificially or encourage others to do so. Pro
          subscriptions are billed by Stripe at the price and interval shown at
          checkout and continue until cancelled. Applicable taxes, cancellation
          rights, and refund rights required by law still apply.
        </p>
      </LegalSection>

      <LegalSection title="Availability and termination">
        <p>
          Features, limits, data sources, and availability may change. We may
          suspend access to protect the service or enforce these terms. You may
          stop using RadarThing, uninstall the userscript, cancel Pro, or delete
          your account at any time.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers and liability">
        <p>
          RadarThing is provided on an “as available” basis without guarantees
          that data is complete, current, or uninterrupted. Nothing in these
          terms excludes liability that cannot lawfully be excluded. Otherwise,
          to the fullest extent permitted by law, RadarThing is not liable for
          indirect or consequential loss arising from use of the service.
        </p>
      </LegalSection>

      <LegalSection title="Contact and changes">
        <p>
          Questions may be sent to support@radarthing.com. We may update these
          terms and will identify material updates by changing the date above or
          giving an in-product notice. Continued use after an update takes
          effect means the updated terms apply.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
