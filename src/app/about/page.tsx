import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "~/components/legal/LegalPage";
import { FREE_RECENT_FLIGHTS_LIMIT } from "~/lib/flightHistory";
import { guides } from "~/lib/guides";

export const metadata: Metadata = {
  title: "About",
  description:
    "About RadarThing, the independent community flight radar for the GeoFS flight simulator: what it does, how it works, and how it is funded.",
  alternates: { canonical: "/about" },
};

const linkClass = "text-cyan-300 underline-offset-4 hover:underline";

export default function AboutPage() {
  return (
    <LegalPage
      eyebrow="About RadarThing"
      title="Built for the GeoFS community"
      summary="RadarThing is an independent live flight radar for the GeoFS flight simulator. It turns simulator traffic into a shared picture of the sky, with live tracking, flight records, weather, airport charts, and pilot statistics."
      lastUpdated="2 November 2026"
    >
      <LegalSection title="What RadarThing does">
        <p>
          GeoFS is a free, browser-based flight simulator flown by pilots all
          over the world. Inside the simulator, each pilot sees the aircraft
          near them. RadarThing shows the bigger picture: every participating
          flight on one live map, with the details a controller or a curious
          spectator would want to see.
        </p>
        <p>
          Select a flight to see its altitude, speed, heading, squawk, route,
          and next waypoint. Search by callsign, pilot, or airport. Follow an
          aircraft across an ocean, watch a busy airport during an event, or
          replay your own flight afterwards to see how your approach really
          went.
        </p>
      </LegalSection>

      <LegalSection title="How it works">
        <p>
          Pilots install a small userscript that runs inside GeoFS. When a pilot
          enters their departure, arrival, and callsign and chooses Transmit,
          the script sends that flight&apos;s position and telemetry to
          RadarThing every few seconds. The radar receives those updates as a
          live stream and draws them on the map.
        </p>
        <p>
          Only pilots who have installed the tracker and chosen to transmit
          appear on the radar. RadarThing does not read or display any other
          GeoFS traffic. When a flight ends, it is saved to the pilot&apos;s
          history, where it can be replayed, shared, and counted towards their
          statistics.
        </p>
      </LegalSection>

      <LegalSection title="Features">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            A live radar with OpenStreetMap, OpenAIP, and controller-style Radar
            Mode layers.
          </li>
          <li>
            Flight history, replay, and shareable replay links for every
            recorded flight.
          </li>
          <li>
            Pilot profiles with totals, streaks, and favourite aircraft, routes,
            and airports, plus community leaderboards and challenges.
          </li>
          <li>
            Airport METARs, a live precipitation overlay, and airport charts.
          </li>
          <li>
            Conflict alerts, history trails, and track lines for community
            controllers.
          </li>
          <li>
            Support for virtual airlines, community aircraft imagery, and ACARS
            flight updates.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Free and Pro">
        <p>
          Live tracking, the radar, airport METARs, the precipitation overlay,
          and your {FREE_RECENT_FLIGHTS_LIMIT} most recent flights are free.
          RadarThing Pro is an optional subscription that adds full flight
          history, worldwide airport charts, aviation weather overlays such as
          AIRMETs and SIGMETs, Radar Mode, and conflict alerts. Pro
          subscriptions and advertising shown to free users pay for the servers,
          data, and development that keep the service running. See{" "}
          <Link href="/pricing" className={linkClass}>
            pricing
          </Link>{" "}
          for current details.
        </p>
      </LegalSection>

      <LegalSection title="Guides for pilots">
        <p>
          The{" "}
          <Link href="/guides" className={linkClass}>
            RadarThing guides
          </Link>{" "}
          contain {guides.length} practical articles for GeoFS pilots. They
          cover setting up the tracker, reading flight telemetry and squawk
          codes, decoding METARs, reading airport charts, radio phraseology, and
          planning a realistic flight from start to finish. New pilots should
          start with{" "}
          <Link href="/guides/getting-started" className={linkClass}>
            Getting started
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Community and moderation">
        <p>
          Aircraft images are contributed by pilots and reviewed by moderators
          before they appear. Virtual airline registrations are reviewed before
          they become active, and ACARS updates are screened automatically and
          can be reported by any signed-in user. Accounts that abuse these
          features can be warned or banned. If you see something that breaks the
          rules, or content you believe infringes your rights, please{" "}
          <Link href="/contact" className={linkClass}>
            contact us
          </Link>{" "}
          or use the{" "}
          <Link href="/copyright" className={linkClass}>
            copyright contact
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Independence">
        <p>
          RadarThing is an independent community project. It is not an official
          GeoFS product and is not affiliated with GeoFS, any airline, or any
          aviation authority. Virtual airlines shown on RadarThing are community
          groups and are not connected to real airlines.
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
