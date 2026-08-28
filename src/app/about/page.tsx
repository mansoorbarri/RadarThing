import type { Metadata } from "next";
import { LegalPage, LegalSection } from "~/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "About",
  description: "About RadarThing, the community flight radar for GeoFS.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <LegalPage
      eyebrow="Service overview"
      title="Built for the GeoFS community"
      summary="RadarThing turns simulator traffic into a clearer shared operating picture, with live tracking, flight records, weather, community charts, and pilot statistics."
    >
      <LegalSection title="What RadarThing does">
        <p>
          A lightweight userscript sends participating pilots&apos; simulator
          activity to the RadarThing service. The web radar organises that data
          into searchable live traffic, routes, replays, airport activity, and
          public pilot pages. Core tracking is free; Pro funds additional data
          and infrastructure.
        </p>
      </LegalSection>
      <LegalSection title="Community and independence">
        <p>
          Aircraft imagery and airport charts are contributed by users and
          reviewed before publication. RadarThing is an independent community
          project and is not an official aviation source or an official GeoFS
          product.
        </p>
      </LegalSection>
      <LegalSection title="Safety boundary">
        <p>
          Everything on RadarThing is for flight-simulator and community use.
          Never rely on it for real-world navigation, flight planning, traffic
          separation, weather avoidance, or operational decisions.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
