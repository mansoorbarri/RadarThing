import type { Metadata } from "next";
import { LegalPage, LegalSection } from "~/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact RadarThing for support, privacy, or rights requests.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <LegalPage
      eyebrow="Contact frequencies"
      title="Contact RadarThing"
      summary="Use the route that matches your request so it reaches the right queue."
      lastUpdated="2 November 2026"
    >
      <LegalSection title="General support">
        <p>
          Email{" "}
          <a
            className="text-cyan-200 underline underline-offset-4 hover:text-white"
            href="mailto:support@radarthing.com"
          >
            support@radarthing.com
          </a>{" "}
          or visit the{" "}
          <a
            className="text-cyan-200 underline underline-offset-4 hover:text-white"
            href="https://discord.gg/pbQF4txdRC"
            target="_blank"
            rel="noopener noreferrer"
          >
            RadarThing Discord community
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          . Do not send passwords, payment-card numbers, or other secrets.
        </p>
      </LegalSection>
      <LegalSection title="Privacy requests">
        <p>
          Email{" "}
          <a
            className="text-cyan-200 underline underline-offset-4 hover:text-white"
            href="mailto:privacy@radarthing.com"
          >
            privacy@radarthing.com
          </a>{" "}
          for access, correction, deletion, objection, consent, or
          data-protection questions. Include the email address associated with
          your account; we may need to verify identity.
        </p>
      </LegalSection>
      <LegalSection title="Copyright and safety">
        <p>
          Email{" "}
          <a
            className="text-cyan-200 underline underline-offset-4 hover:text-white"
            href="mailto:copyright@radarthing.com"
          >
            copyright@radarthing.com
          </a>{" "}
          for rights reports. For urgent abuse or safety concerns, email{" "}
          <a
            className="text-cyan-200 underline underline-offset-4 hover:text-white"
            href="mailto:support@radarthing.com"
          >
            support@radarthing.com
          </a>{" "}
          with the relevant URL, callsign, username, and supporting details.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
