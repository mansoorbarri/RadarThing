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
    >
      <LegalSection title="General support">
        <p>
          Email{" "}
          <a className="text-cyan-200" href="mailto:support@radarthing.com">
            support@radarthing.com
          </a>{" "}
          or visit the{" "}
          <a
            className="text-cyan-200"
            href="https://discord.gg/pbQF4txdRC"
            target="_blank"
            rel="noopener noreferrer"
          >
            RadarThing Discord community
          </a>
          . Do not send passwords, payment-card numbers, or other secrets.
        </p>
      </LegalSection>
      <LegalSection title="Privacy requests">
        <p>
          Email privacy@radarthing.com for access, correction, deletion,
          objection, consent, or data-protection questions. Include the email
          address associated with your account; we may need to verify identity.
        </p>
      </LegalSection>
      <LegalSection title="Copyright and safety">
        <p>
          Email copyright@radarthing.com for rights reports. For urgent abuse or
          safety concerns, email support@radarthing.com with the relevant URL,
          callsign, username, and supporting details.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
