import { convex, api } from "./convex";

export async function assertCurrentAccountActive(clerkId: string) {
  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (user?.activeBanId || user?.isDeleted)
    throw new Error("Account access restricted");
}
