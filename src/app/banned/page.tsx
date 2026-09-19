import Link from "next/link";

// Signed-in banned accounts see the account notice from ModerationGate.
export default function BannedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Link href="/radar" className="text-cyan-400 underline">
        Return to RadarThing
      </Link>
    </main>
  );
}
