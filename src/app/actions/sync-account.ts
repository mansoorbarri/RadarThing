"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "~/server/convex";
import { env } from "~/env";

// Identity fields used for authorization must come from Clerk, never the browser.
export async function syncCurrentAccount() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) throw new Error("Unauthorized");
  const client = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
  client.setAuth(token);
  return await client.mutation(api.users.storeUser, {
    googleId: user.externalAccounts.find(
      (account) =>
        account.provider === "oauth_google" || account.provider === "google",
    )?.externalId,
    systemSecret: env.CONVEX_SYSTEM_SECRET,
  });
}
