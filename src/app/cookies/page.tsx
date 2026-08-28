import type { Metadata } from "next";
import { LegalPage, LegalSection } from "~/components/legal/LegalPage";
import { CookieChoices } from "./CookieChoices";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Cookies and local storage used by RadarThing.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Storage manifest"
      title="Cookies and local storage"
      summary="RadarThing uses small amounts of browser storage to operate the radar, remember choices, measure the service with permission, and support advertising on the free tier."
    >
      <LegalSection title="Essential storage">
        <p>
          Clerk authentication cookies protect sign-in sessions. RadarThing also
          stores map position, layer settings, display preferences, recently
          used features, consent choices, and anonymous live-tracker state.
          These items provide functions you request and cannot all be disabled
          through our controls; clearing site data in your browser removes them.
        </p>
      </LegalSection>

      <LegalSection title="Optional analytics">
        <p>
          If you allow analytics, PostHog stores a pseudonymous device and
          session identifier and receives page views, selected product events,
          and diagnostic information. Inputs are masked for session recording.
          Analytics stays off until you choose to allow it and respects browser
          Do Not Track signals.
        </p>
      </LegalSection>

      <LegalSection title="Advertising storage">
        <p>
          On free-tier content pages, Google and participating advertising
          vendors may use cookies, local storage, IP addresses, and similar
          identifiers for ad delivery, measurement, frequency controls, fraud
          prevention, and—where you consent—personalisation. Google&apos;s
          certified consent platform records and communicates these choices in
          regulated regions.
        </p>
      </LegalSection>

      <LegalSection title="Change your choices">
        <CookieChoices />
      </LegalSection>
    </LegalPage>
  );
}
