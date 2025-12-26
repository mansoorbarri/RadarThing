import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "~/server/db";

const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  // 1. Get the headers and body
  const headerList = await headers();
  const payload = await req.text();

  const svix_id = headerList.get("svix-id");
  const svix_timestamp = headerList.get("svix-timestamp");
  const svix_signature = headerList.get("svix-signature");

  // 2. If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new NextResponse("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // 3. Create a new Svix instance with your secret.
  const wh = new Webhook(CLERK_WEBHOOK_SECRET);

  let evt: any;

  // 4. Verify the payload with the headers
  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new NextResponse("Error occured", {
      status: 400,
    });
  }

  // 5. Handle the webhook events
  const { type, data } = evt;

  // Sync Create or Update
  if (type === "user.created" || type === "user.updated") {
    const email = data.email_addresses?.[0]?.email_address;

    if (!email) {
      return NextResponse.json({ message: "No email found" }, { status: 400 });
    }

    await db.user.upsert({
      where: { clerkId: data.id },
      update: {
        email: email,
        username: data.username ?? null,
      },
      create: {
        clerkId: data.id,
        googleId: data.external_accounts?.[0]?.google_id,
        email: email,
        username: data.username ?? null,
      },
    });
    
    console.log(`✅ User ${data.id} synced to DB`);
  }

  // Handle Deletion
  if (type === "user.deleted") {
    try {
      await db.user.delete({
        where: { clerkId: data.id },
      });
      console.log(`❌ User ${data.id} deleted from DB`);
    } catch (error) {
      // Catch error if user was already deleted from DB
      console.error("Error deleting user:", error);
    }
  }

  return NextResponse.json({ ok: true });
}