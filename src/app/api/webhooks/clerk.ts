import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "~/server/db";

const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const payload = await req.text();
  const headerList = await headers();

  const svixHeaders = {
    "svix-id": headerList.get("svix-id")!,
    "svix-timestamp": headerList.get("svix-timestamp")!,
    "svix-signature": headerList.get("svix-signature")!,
  };

  let evt: any;

  try {
    const wh = new Webhook(CLERK_WEBHOOK_SECRET);
    evt = wh.verify(payload, svixHeaders);
  } catch (err) {
    console.error("Webhook verification failed", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const { type, data } = evt;

  // ✅ Handle user creation
  if (type === "user.created") {
    const email = data.email_addresses?.[0]?.email_address;

    if (!email) {
      return NextResponse.json({ ok: true });
    }

    await db.user.create({
      data: {
        clerkId: data.id,
        email,
        username: data.username ?? null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}