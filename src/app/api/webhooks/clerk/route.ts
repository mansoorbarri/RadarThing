import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { Role } from "@prisma/client";

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
        (e: any) => e.id === data.primary_email_address_id,
      )?.email_address ?? null;

    if (!email) {
      return NextResponse.json({ ok: true });
    }

    const googleId =
      data.external_accounts?.find(
        (acc: any) => acc.provider === "oauth_google",
      )?.provider_user_id ?? null;

    const existing = await db.user.findFirst({
      where: {
        OR: [{ clerkId: data.id }, { email }],
      },
    });

    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          clerkId: data.id,
          email,
          googleId,
          isDeleted: false,
          deletedAt: null,
          role: Role.FREE,
        },
      });
    } else {
      await db.user.create({
        data: {
          clerkId: data.id,
          email,
          googleId,
          role: Role.FREE,
        },
      });
    }
  }

  if (type === "user.updated") {
    const existing = await db.user.findUnique({
      where: { clerkId: data.id },
    });

    if (existing && !existing.isDeleted) {
      const email =
        data.email_addresses?.find(
          (e: any) => e.id === data.primary_email_address_id,
        )?.email_address ?? existing.email;

      await db.user.update({
        where: { id: existing.id },
        data: {
          email,
        },
      });
    }
  }

  if (type === "user.deleted") {
    await db.user.updateMany({
      where: { clerkId: data.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        role: Role.FREE,
      },
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

    const result = await db.user.updateMany({
      where: {
        isDeleted: false,
        OR: [
          ...(userId ? [{ clerkId: userId }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
      data: {
        role: hasActiveItem ? Role.PRO : Role.FREE,
      },
    });

    console.log("ROLE UPDATE COUNT:", result.count);
  }
  return NextResponse.json({ ok: true });
}
