import type { Metadata } from "next";
import RtDayDashboard from "./RtDayDashboard";

export const metadata: Metadata = {
  title: "RT Day — Let's make radar history",
  description:
    "Celebrate RadarThing's birthday. Follow the live radar as we aim to beat 50 simultaneous flights.",
  alternates: { canonical: "/rtday" },
};

export default function RtDayPage() {
  return <RtDayDashboard />;
}
