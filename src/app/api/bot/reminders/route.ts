import { NextResponse } from "next/server";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { convex, api } from "~/server/convex";
import { env } from "~/env";

type BotAction =
  | "lookupUser"
  | "createReminder"
  | "listActive"
  | "listChallengeEvents"
  | "markChallengeEventCreated"
  | "markTriggered"
  | "markSent"
  | "markCompleted"
  | "markCancelled"
  | "markFailed";

function isAuthorized(request: Request): boolean {
  return request.headers.get("x-bot-secret") === env.BOT_API_SECRET;
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function getString(
  body: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = body[key];
  return typeof value === "string" ? value.trim() : undefined;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const body = (await request.json()) as Record<string, unknown>;
  const action = body.action as BotAction | undefined;

  if (!action) {
    return badRequest("Missing action");
  }

  switch (action) {
    case "lookupUser": {
      const discordUsername = getString(body, "discordUsername");
      if (!discordUsername) return badRequest("Missing discordUsername");

      const user = await convex.query(api.users.getByDiscordUsername, {
        discordUsername,
      });

      if (!user) {
        return NextResponse.json({ found: false });
      }

      return NextResponse.json({
        found: true,
        user: {
          id: user._id,
          googleId: user.googleId ?? null,
          discordUsername: user.discordUsername ?? null,
        },
      });
    }

    case "createReminder": {
      const userIdValue = getString(body, "userId");
      const userId = userIdValue as Id<"users"> | undefined;
      const googleId = getString(body, "googleId");
      const discordUsername = getString(body, "discordUsername");
      const discordUserId = getString(body, "discordUserId");
      const callsign = getString(body, "callsign");
      const waypointIdent = getString(body, "waypointIdent");
      const intervalSeconds = Number(body.intervalSeconds);
      const durationSeconds = Number(body.durationSeconds);

      if (
        !userId ||
        !googleId ||
        !discordUsername ||
        !discordUserId ||
        !callsign ||
        !waypointIdent ||
        !Number.isFinite(intervalSeconds) ||
        !Number.isFinite(durationSeconds)
      ) {
        return badRequest("Missing or invalid reminder fields");
      }

      const reminderId = await convex.mutation(api.waypointReminders.create, {
        userId,
        googleId,
        discordUsername,
        discordUserId,
        callsign,
        waypointIdent,
        intervalSeconds,
        durationSeconds,
      });

      return NextResponse.json({ success: true, reminderId });
    }

    case "listActive": {
      const reminders = await convex.query(
        api.waypointReminders.listActive,
        {},
      );
      return NextResponse.json({ reminders });
    }

    case "listChallengeEvents": {
      const challenges = await convex.query(
        api.challenges.listForBotAnnouncements,
        {
          includeExisting: false,
        },
      );
      return NextResponse.json({ challenges });
    }

    case "markChallengeEventCreated": {
      const challengeIdValue = getString(body, "challengeId");
      const challengeId = challengeIdValue as Id<"challenges"> | undefined;
      const discordEventId = getString(body, "discordEventId");
      const discordEventUrl = getString(body, "discordEventUrl");

      if (!challengeId || !discordEventId) {
        return badRequest("Missing challengeId or discordEventId");
      }

      await convex.mutation(api.challenges.updateDiscordEvent, {
        challengeId,
        discordEventId,
        discordEventUrl,
      });

      return NextResponse.json({ success: true });
    }

    case "markTriggered": {
      const idValue = getString(body, "id");
      const id = idValue as Id<"waypointReminders"> | undefined;
      const triggeredAt = Number(body.triggeredAt);
      if (!id || !Number.isFinite(triggeredAt)) {
        return badRequest("Missing or invalid trigger payload");
      }

      const reminder = await convex.mutation(
        api.waypointReminders.markTriggered,
        {
          id,
          triggeredAt,
        },
      );
      return NextResponse.json({ success: true, reminder });
    }

    case "markSent": {
      const idValue = getString(body, "id");
      const id = idValue as Id<"waypointReminders"> | undefined;
      const sentAt = Number(body.sentAt);
      if (!id || !Number.isFinite(sentAt)) {
        return badRequest("Missing or invalid sent payload");
      }

      const reminder = await convex.mutation(api.waypointReminders.markSent, {
        id,
        sentAt,
      });
      return NextResponse.json({ success: true, reminder });
    }

    case "markCompleted":
    case "markCancelled":
    case "markFailed": {
      const idValue = getString(body, "id");
      const id = idValue as Id<"waypointReminders"> | undefined;
      const completedAt = Number(body.completedAt);
      const failureReason = getString(body, "failureReason");

      if (!id || !Number.isFinite(completedAt)) {
        return badRequest("Missing or invalid completion payload");
      }

      const status =
        action === "markCompleted"
          ? "completed"
          : action === "markCancelled"
            ? "cancelled"
            : "failed";

      const reminder = await convex.mutation(api.waypointReminders.markStatus, {
        id,
        status,
        completedAt,
        failureReason,
      });

      return NextResponse.json({ success: true, reminder });
    }

    default:
      return badRequest("Unsupported action");
  }
}
