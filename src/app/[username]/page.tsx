import { notFound, redirect } from "next/navigation";
import { api, convex } from "~/server/convex";

export default async function DiscordProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const user = await convex.query(api.users.getByProfileIdentifier, {
    profileIdentifier: username,
  });

  if (!user) notFound();

  redirect(`/pilot/${user._id}`);
}
