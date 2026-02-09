import type { Metadata } from "next";
import { convex, api } from "~/server/convex";
import type { Id } from "../../../../convex/_generated/dataModel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const stats = await convex.query(api.flights.getStatsById, {
      userId: id as Id<"users">,
    });

    const callsign = stats?.pilotCallsign ?? "Unknown Pilot";
    const flights = stats?.totalFlights ?? 0;
    const distance = stats?.totalDistanceNm ?? 0;

    const title = `${callsign} - Pilot Profile`;
    const description = `${callsign} on RadarThing: ${flights} flights, ${distance.toLocaleString()} nm flown. View flight stats, routes, and history.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  } catch {
    return {
      title: "Pilot Profile",
      description: "View pilot stats and flight history on RadarThing.",
    };
  }
}

export default function PilotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
