import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const send = internalAction({
  args: { id: v.id("moderationActions") },
  handler: async (ctx, args) => {
    const record = await ctx.runQuery(internal.moderation.emailRecord, args);
    if (
      !record ||
      record.emailStatus === "sent" ||
      record.emailStatus === "failed"
    )
      return;
    let error: string | undefined;
    try {
      // All automatic retries stay within Resend's 24-hour idempotency window.
      if (Date.now() - record.createdAt >= 23 * 60 * 60 * 1000)
        throw new Error("Email retry window expired");
      const key = process.env.RESEND_API_KEY;
      if (!key) throw new Error("RESEND_API_KEY is not configured in Convex");
      const banned = record.kind === "ban";
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `moderation/${record._id}`,
        },
        body: JSON.stringify({
          from: "RadarThing <noreply@radarthing.com>",
          to: [record.targetEmail],
          subject: banned
            ? "Your RadarThing account has been banned"
            : "A warning about your RadarThing account",
          text: `${banned ? "Your RadarThing account has been banned until the super-admin lifts the ban." : "You have received a warning on RadarThing. Please acknowledge it when you next visit RT."}\n\nReason:\n${record.reason}\n\nIssued: ${new Date(record.createdAt).toISOString()}\n\nReview the site rules: https://radarthing.com/terms\n\n${banned ? "You can still manage your account and billing. A ban does not cancel an existing subscription." : "Your account remains available."}`,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok)
        throw new Error(`Email provider returned HTTP ${response.status}`);
    } catch (failure) {
      error =
        failure instanceof Error ? failure.message : "Email sending failed";
    }
    await ctx.runMutation(internal.moderation.emailResult, {
      id: args.id,
      sent: !error,
      error,
    });
  },
});
