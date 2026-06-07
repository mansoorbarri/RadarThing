import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";
import { api } from "../../convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

// Server-side Convex client for use in server actions and API routes
export const convex = new ConvexHttpClient(convexUrl);

export async function getAuthenticatedConvex() {
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  const client = new ConvexHttpClient(convexUrl);

  if (token) {
    client.setAuth(token);
  }

  return client;
}

// Export the api for typed queries/mutations
export { api };
