/**
 * Turns a caught error into text that's fit to show a person.
 *
 * Clerk and ConvexError carry readable messages, and so do errors our own
 * code throws. Server and network errors ("[CONVEX M(...)] [Request ID …]
 * Server Error", "Failed to fetch") don't, so those get the fallback.
 */
export function toUserMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const clerkErrors = (
      error as { errors?: { longMessage?: string; message?: string }[] }
    ).errors;
    const clerkMessage =
      clerkErrors?.[0]?.longMessage ?? clerkErrors?.[0]?.message;
    if (clerkMessage) return clerkMessage;

    const data = (error as { data?: unknown }).data;
    if (typeof data === "string" && data.trim()) return data;
    if (
      data &&
      typeof data === "object" &&
      typeof (data as { message?: unknown }).message === "string"
    ) {
      return (data as { message: string }).message;
    }
  }
  if (error instanceof Error) {
    const message = error.message.trim();
    const looksInternal =
      /\[CONVEX|Request ID|Server Error|Uncaught|fetch failed|Failed to fetch|NetworkError|Load failed|^\w*Error\b/i.test(
        message,
      );
    if (message && !looksInternal && message.length <= 200) return message;
  }
  return fallback;
}
