"use client";

export const BIRTHDAY_CTF_FLAG = "RT0NT0P";
export const BIRTHDAY_CTF_TARGET_SECONDS = 210;
export const BIRTHDAY_CTF_EVENT = "radarthing:birthday-ctf-hint";
export const BIRTHDAY_CTF_SEEN_HINTS_KEY =
  "radarthing.birthday_ctf.seen_hints.v1";
export const BIRTHDAY_CTF_COMPLETED_KEY =
  "radarthing.birthday_ctf.completed.v1";

export type BirthdayCtfHintId =
  | "own-flight-clock"
  | "own-flight-hold"
  | "upload-image"
  | "search"
  | "settings"
  | "airport"
  | "charts"
  | "charts-side-view"
  | "dashboard"
  | "leaderboard";

export const birthdayCtfHints: Record<BirthdayCtfHintId, string> = {
  "own-flight-clock":
    "Your aircraft is on scope. Start the birthday watch when you spot yourself.",
  "own-flight-hold":
    "Ownship timing note: tower wrote the hold as 2 minutes and 90 seconds.",
  "upload-image":
    "Upload bay note: some clocks accept strange clearances like 2:90.",
  search: "Search ping received. The target is not a callsign, it is a time.",
  settings:
    "Settings opened. If a timer has too many seconds, carry them into minutes.",
  airport:
    "Airport selected. Hold short until 2 minutes plus 90 seconds has passed.",
  charts: "Chart drawer clue: 2:90 belongs on the stopwatch as 3:30.",
  "charts-side-view":
    "Chart side view says the birthday fix is exactly 210 seconds from start.",
  dashboard:
    "Dashboard dispatch: the flag appears only after a clean stop at 03:30.",
  leaderboard:
    "Leaderboard timing: stop on 210 seconds and the birthday squawk appears.",
};

export function dispatchBirthdayCtfHint(hintId: BirthdayCtfHintId) {
  if (typeof window === "undefined") return;

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(BIRTHDAY_CTF_SEEN_HINTS_KEY) ?? "[]",
    );
    const seenHints = new Set<string>(Array.isArray(parsed) ? parsed : []);
    seenHints.add(hintId);
    window.localStorage.setItem(
      BIRTHDAY_CTF_SEEN_HINTS_KEY,
      JSON.stringify([...seenHints]),
    );
  } catch {
    window.localStorage.setItem(
      BIRTHDAY_CTF_SEEN_HINTS_KEY,
      JSON.stringify([hintId]),
    );
  }

  window.dispatchEvent(
    new CustomEvent<{ hintId: BirthdayCtfHintId }>(BIRTHDAY_CTF_EVENT, {
      detail: { hintId },
    }),
  );
}

export function formatBirthdayCtfTimer(totalSeconds: number) {
  const boundedSeconds = Math.max(0, Math.floor(totalSeconds));

  if (boundedSeconds <= 120) {
    const minutes = Math.floor(boundedSeconds / 60);
    const seconds = boundedSeconds % 60;
    return `00:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  const secondsAfterTwoMinutes = boundedSeconds - 120;
  return `00:02:${secondsAfterTwoMinutes.toString().padStart(2, "0")}`;
}
