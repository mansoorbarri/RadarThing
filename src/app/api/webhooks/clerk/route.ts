import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { convex, api } from "~/server/convex";

const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;

function getDiscordConnection(data: any):
  | { hasDiscord: boolean; username?: string }
  | null {
  if (!Array.isArray(data.external_accounts)) return null;

  const discordAccount = data.external_accounts.find((account: any) => {
    const provider =
      typeof account.provider === "string"
        ? account.provider.replace(/^oauth_/, "")
        : "";
    return provider === "discord";
  });

  if (!discordAccount) {
    return { hasDiscord: false };
  }

  const username =
    typeof discordAccount.username === "string"
      ? discordAccount.username.trim()
      : "";

  return {
    hasDiscord: true,
    username: username || undefined,
  };
}

export async function POST(req: Request) {
  const headerList = await headers();
  const payload = await req.text();

  const svixId = headerList.get("svix-id");
  const svixTimestamp = headerList.get("svix-timestamp");
  const svixSignature = headerList.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new NextResponse("Missing svix headers", { status: 400 });
  }

  const wh = new Webhook(CLERK_WEBHOOK_SECRET);

  let evt: any;
  try {
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const { type, data } = evt;

  if (type === "user.created" || type === "user.updated") {
    const discordConnection = getDiscordConnection(data);

    if (discordConnection) {
      await convex.mutation(api.users.updateDiscordUsername, {
        clerkId: data.id,
        discordUsername: discordConnection.hasDiscord
          ? discordConnection.username
          : undefined,
        systemSecret: process.env.CONVEX_SYSTEM_SECRET,
      });
    }
  }

  if (type === "user.deleted") {
    await convex.mutation(api.users.softDelete, {
      clerkId: data.id,
      systemSecret: process.env.CONVEX_SYSTEM_SECRET,
    });
  }

  if (type === "subscription.created" || type === "subscription.updated") {
    const userId = data.payer?.user_id ?? null;
    const email = data.payer?.email ?? null;

    const hasActiveItem =
      Array.isArray(data.items) &&
      data.items.some(
        (item: any) => item.status === "active" && item.plan?.slug === "pro",
      );

    if (!userId && !email) {
      return NextResponse.json({ ok: true });
    }

    const role = hasActiveItem ? "PRO" : "FREE";

    // Try to find and update user by clerkId first
    if (userId) {
      const userByClerk = await convex.query(api.users.getByClerkId, {
        clerkId: userId,
      });
      if (userByClerk && !userByClerk.isDeleted) {
        await convex.mutation(api.users.updateByClerkId, {
          clerkId: userId,
          role,
          systemSecret: process.env.CONVEX_SYSTEM_SECRET,
        });
        console.log("ROLE UPDATE by clerkId:", userId, role);
        return NextResponse.json({ ok: true });
      }
    }

    // Try by email
    if (email) {
      const userByEmail = await convex.query(api.users.getByEmail, { email });
      if (userByEmail && !userByEmail.isDeleted) {
        await convex.mutation(api.users.update, {
          id: userByEmail._id,
          role,
          systemSecret: process.env.CONVEX_SYSTEM_SECRET,
        });
        console.log("ROLE UPDATE by email:", email, role);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
