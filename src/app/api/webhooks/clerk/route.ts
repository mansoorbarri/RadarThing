import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { convex, api } from "~/server/convex";

const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;

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

  if (type === "user.created") {
    const email =
      data.email_addresses?.find(
        (e: any) => e.id === data.primary_email_address_id
      )?.email_address ?? null;

    if (!email) {
      return NextResponse.json({ ok: true });
    }

    const googleId =
      data.external_accounts?.find(
        (acc: any) => acc.provider === "oauth_google"
      )?.provider_user_id ?? null;

    // Check if user exists by clerkId or email
    const existing = await convex.query(api.users.findByClerkIdOrEmail, {
      clerkId: data.id,
      email,
    });

    if (existing) {
      // Update existing user (undelete if needed)
      await convex.mutation(api.users.undeleteAndUpdate, {
        id: existing._id,
        clerkId: data.id,
        email,
        googleId: googleId ?? undefined,
      });
    } else {
      // Create new user
      await convex.mutation(api.users.create, {
        clerkId: data.id,
        email,
        googleId: googleId ?? undefined,
      });
    }
  }

  if (type === "user.updated") {
    const existing = await convex.query(api.users.getByClerkId, {
      clerkId: data.id,
    });

    if (existing && !existing.isDeleted) {
      const email =
        data.email_addresses?.find(
          (e: any) => e.id === data.primary_email_address_id
        )?.email_address ?? existing.email;

      await convex.mutation(api.users.updateByClerkId, {
        clerkId: data.id,
        email,
      });
    }
  }

  if (type === "user.deleted") {
    await convex.mutation(api.users.softDelete, {
      clerkId: data.id,
    });
  }

  if (type === "subscription.created" || type === "subscription.updated") {
    const userId = data.payer?.user_id ?? null;
    const email = data.payer?.email ?? null;

    const hasActiveItem =
      Array.isArray(data.items) &&
      data.items.some(
        (item: any) => item.status === "active" && item.plan?.slug === "pro"
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
        });
        console.log("ROLE UPDATE by email:", email, role);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
