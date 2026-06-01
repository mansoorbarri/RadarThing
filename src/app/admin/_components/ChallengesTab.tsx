"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  Flag,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import type { Id } from "../../../../convex/_generated/dataModel";
import { api } from "../../../../convex/_generated/api";
import { Analytics } from "~/lib/analytics";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type ChallengeCadence = "weekly" | "monthly" | "custom";
type ChallengeMode = "auto" | "manual";
type ChallengeRuleType =
  | "visit_airport"
  | "visit_airport_count"
  | "depart_airport"
  | "arrive_airport"
  | "route"
  | "aircraft_type"
  | "flight_count"
  | "min_duration"
  | "min_distance"
  | "manual";

interface ChallengeRuleForm {
  ruleType: ChallengeRuleType;
  targetAirport: string;
  targetDepartureAirport: string;
  targetArrivalAirport: string;
  targetAircraftType: string;
  requiredAirportCount: string;
  requiredFlightCount: string;
  minDurationMinutes: string;
  minDistanceNm: string;
}

interface ChallengeForm {
  title: string;
  description: string;
  cadence: ChallengeCadence;
  mode: ChallengeMode;
  rules: ChallengeRuleForm[];
  startAt: string;
  durationDays: string;
  isPublished: boolean;
}

const challengeCadenceSchema = z.union([
  z.literal("weekly"),
  z.literal("monthly"),
  z.literal("custom"),
]);
const challengeModeSchema = z.union([z.literal("auto"), z.literal("manual")]);
const challengeRuleTypeSchema = z.union([
  z.literal("visit_airport"),
  z.literal("visit_airport_count"),
  z.literal("depart_airport"),
  z.literal("arrive_airport"),
  z.literal("route"),
  z.literal("aircraft_type"),
  z.literal("flight_count"),
  z.literal("min_duration"),
  z.literal("min_distance"),
  z.literal("manual"),
]);

const optionalNumberSchema = z.preprocess(
  (value) =>
    typeof value === "number" && !Number.isFinite(value) ? undefined : value,
  z.number().optional(),
);

const challengeRulePayloadSchema = z.object({
  ruleType: challengeRuleTypeSchema,
  targetAirport: z.string().trim().toUpperCase().optional(),
  targetDepartureAirport: z.string().trim().toUpperCase().optional(),
  targetArrivalAirport: z.string().trim().toUpperCase().optional(),
  targetAircraftType: z.string().trim().toUpperCase().optional(),
  requiredAirportCount: optionalNumberSchema,
  requiredFlightCount: optionalNumberSchema,
  minDurationMinutes: optionalNumberSchema,
  minDistanceNm: optionalNumberSchema,
});

const challengePayloadSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Challenge title must be 3-80 characters")
      .max(80, "Challenge title must be 3-80 characters"),
    description: z
      .string()
      .trim()
      .min(8, "Challenge description must be 8-300 characters")
      .max(300, "Challenge description must be 8-300 characters"),
    cadence: challengeCadenceSchema,
    mode: challengeModeSchema,
    ruleType: challengeRuleTypeSchema,
    targetAirport: z.string().trim().toUpperCase().optional(),
    targetDepartureAirport: z.string().trim().toUpperCase().optional(),
    targetArrivalAirport: z.string().trim().toUpperCase().optional(),
    targetAircraftType: z.string().trim().toUpperCase().optional(),
    requiredAirportCount: optionalNumberSchema,
    requiredFlightCount: optionalNumberSchema,
    minDurationMinutes: optionalNumberSchema,
    minDistanceNm: optionalNumberSchema,
    rules: z.array(challengeRulePayloadSchema).min(1).max(8),
    startAt: z
      .number({ invalid_type_error: "Challenge start time is invalid" })
      .finite("Challenge start time is invalid"),
    durationDays: optionalNumberSchema,
    isPublished: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const durationDays =
      value.cadence === "weekly"
        ? 7
        : value.cadence === "monthly"
          ? 30
          : value.durationDays;

    if (
      typeof durationDays !== "number" ||
      !Number.isFinite(durationDays) ||
      durationDays <= 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Custom challenges need a duration above 0 days",
        path: ["durationDays"],
      });
    }

    const rules = value.rules.length > 0 ? value.rules : [value];

    if (value.mode === "manual") {
      if (rules.length !== 1 || rules[0]?.ruleType !== "manual") {
        ctx.addIssue({
          code: "custom",
          message: "Manual challenges must use the manual rule type",
          path: ["ruleType"],
        });
      }
      return;
    }

    if (rules.some((rule) => rule.ruleType === "manual")) {
      ctx.addIssue({
        code: "custom",
        message: "Automatic challenges need concrete auto rules",
        path: ["ruleType"],
      });
    }

    for (const [index, rule] of rules.entries()) {
      if (
        ["visit_airport", "depart_airport", "arrive_airport"].includes(
          rule.ruleType,
        ) &&
        !rule.targetAirport
      ) {
        ctx.addIssue({
          code: "custom",
          message: "This challenge needs an airport code",
          path: ["rules", index, "targetAirport"],
        });
      }

      if (
        rule.ruleType === "route" &&
        (!rule.targetDepartureAirport || !rule.targetArrivalAirport)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Route challenges need both departure and arrival airports",
          path: ["rules", index, "targetDepartureAirport"],
        });
      }

      if (rule.ruleType === "aircraft_type" && !rule.targetAircraftType) {
        ctx.addIssue({
          code: "custom",
          message: "Aircraft challenges need an aircraft type",
          path: ["rules", index, "targetAircraftType"],
        });
      }

      if (
        rule.ruleType === "visit_airport_count" &&
        (!rule.requiredAirportCount || rule.requiredAirportCount <= 0)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Airport count challenges need a visit count above 0",
          path: ["rules", index, "requiredAirportCount"],
        });
      }

      if (
        rule.ruleType === "flight_count" &&
        (!rule.requiredFlightCount || rule.requiredFlightCount <= 0)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Flight count challenges need a flight count above 0",
          path: ["rules", index, "requiredFlightCount"],
        });
      }

      if (
        rule.ruleType === "min_duration" &&
        (!rule.minDurationMinutes || rule.minDurationMinutes <= 0)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Minimum duration challenges need a duration above 0",
          path: ["rules", index, "minDurationMinutes"],
        });
      }

      if (
        rule.ruleType === "min_distance" &&
        (!rule.minDistanceNm || rule.minDistanceNm <= 0)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Minimum distance challenges need a distance above 0",
          path: ["rules", index, "minDistanceNm"],
        });
      }
    }
  });

function toLocalInputValue(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function defaultDurationDays(cadence: ChallengeCadence) {
  if (cadence === "monthly") return "30";
  if (cadence === "custom") return "3";
  return "7";
}

function defaultWindow(cadence: ChallengeCadence) {
  const start = new Date();
  start.setMinutes(0, 0, 0);

  return {
    startAt: toLocalInputValue(start.getTime()),
    durationDays: defaultDurationDays(cadence),
  };
}

function createInitialRule(
  ruleType: ChallengeRuleType = "visit_airport",
): ChallengeRuleForm {
  return {
    ruleType,
    targetAirport: "",
    targetDepartureAirport: "",
    targetArrivalAirport: "",
    targetAircraftType: "",
    requiredAirportCount: "",
    requiredFlightCount: "",
    minDurationMinutes: "",
    minDistanceNm: "",
  };
}

function ruleFormFromChallengeRule(rule: {
  ruleType: ChallengeRuleType;
  targetAirport: string | null;
  targetDepartureAirport: string | null;
  targetArrivalAirport: string | null;
  targetAircraftType: string | null;
  requiredAirportCount: number | null;
  requiredFlightCount: number | null;
  minDurationMinutes: number | null;
  minDistanceNm: number | null;
}) {
  return {
    ruleType: rule.ruleType,
    targetAirport: rule.targetAirport ?? "",
    targetDepartureAirport: rule.targetDepartureAirport ?? "",
    targetArrivalAirport: rule.targetArrivalAirport ?? "",
    targetAircraftType: rule.targetAircraftType ?? "",
    requiredAirportCount:
      rule.requiredAirportCount !== null
        ? String(rule.requiredAirportCount)
        : "",
    requiredFlightCount:
      rule.requiredFlightCount !== null ? String(rule.requiredFlightCount) : "",
    minDurationMinutes:
      rule.minDurationMinutes !== null ? String(rule.minDurationMinutes) : "",
    minDistanceNm:
      rule.minDistanceNm !== null ? String(rule.minDistanceNm) : "",
  };
}

function ruleFormToPayload(rule: ChallengeRuleForm) {
  return {
    ruleType: rule.ruleType,
    targetAirport: rule.targetAirport || undefined,
    targetDepartureAirport: rule.targetDepartureAirport || undefined,
    targetArrivalAirport: rule.targetArrivalAirport || undefined,
    targetAircraftType: rule.targetAircraftType || undefined,
    requiredAirportCount: rule.requiredAirportCount
      ? Number(rule.requiredAirportCount)
      : undefined,
    requiredFlightCount: rule.requiredFlightCount
      ? Number(rule.requiredFlightCount)
      : undefined,
    minDurationMinutes: rule.minDurationMinutes
      ? Number(rule.minDurationMinutes)
      : undefined,
    minDistanceNm: rule.minDistanceNm ? Number(rule.minDistanceNm) : undefined,
  };
}

function createInitialForm(): ChallengeForm {
  const window = defaultWindow("weekly");
  return {
    title: "",
    description: "",
    cadence: "weekly",
    mode: "auto",
    rules: [createInitialRule()],
    startAt: window.startAt,
    durationDays: window.durationDays,
    isPublished: true,
  };
}

function formatChallengeWindow(startAt: number, endAt: number) {
  return `${new Date(startAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })} - ${new Date(endAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function describeRule(challenge: {
  mode: ChallengeMode;
  ruleType: ChallengeRuleType;
  targetAirport: string | null;
  targetDepartureAirport: string | null;
  targetArrivalAirport: string | null;
  targetAircraftType: string | null;
  requiredAirportCount: number | null;
  requiredFlightCount: number | null;
  minDurationMinutes: number | null;
  minDistanceNm: number | null;
  rules?: {
    ruleType: ChallengeRuleType;
    targetAirport: string | null;
    targetDepartureAirport: string | null;
    targetArrivalAirport: string | null;
    targetAircraftType: string | null;
    requiredAirportCount: number | null;
    requiredFlightCount: number | null;
    minDurationMinutes: number | null;
    minDistanceNm: number | null;
  }[];
}) {
  if (challenge.mode === "manual") return "Manual review challenge";

  const rules =
    challenge.rules && challenge.rules.length > 0
      ? challenge.rules
      : [challenge];

  return rules.map((rule) => describeSingleRule(rule)).join(" + ");
}

function describeSingleRule(rule: {
  ruleType: ChallengeRuleType;
  targetAirport: string | null;
  targetDepartureAirport: string | null;
  targetArrivalAirport: string | null;
  targetAircraftType: string | null;
  requiredAirportCount: number | null;
  requiredFlightCount: number | null;
  minDurationMinutes: number | null;
  minDistanceNm: number | null;
}) {
  switch (rule.ruleType) {
    case "visit_airport":
      return `Visit ${rule.targetAirport}`;
    case "visit_airport_count":
      return `Visit ${rule.requiredAirportCount} unique airports`;
    case "depart_airport":
      return `Depart ${rule.targetAirport}`;
    case "arrive_airport":
      return `Arrive at ${rule.targetAirport}`;
    case "route":
      return `Route ${rule.targetDepartureAirport} -> ${rule.targetArrivalAirport}`;
    case "aircraft_type":
      return `Aircraft ${rule.targetAircraftType}`;
    case "flight_count":
      return `Complete ${rule.requiredFlightCount} flights`;
    case "min_duration":
      return `At least ${rule.minDurationMinutes} minutes`;
    case "min_distance":
      return `At least ${rule.minDistanceNm} nm`;
    default:
      return "Manual review challenge";
  }
}

export function ChallengesTab() {
  const challenges = useQuery(api.challenges.listAdmin, {});
  const pendingReviews = useQuery(api.challenges.listPendingReviews, {});
  const createChallenge = useMutation(api.challenges.create);
  const updateChallenge = useMutation(api.challenges.update);
  const togglePublished = useMutation(api.challenges.togglePublished);
  const removeChallenge = useMutation(api.challenges.remove);
  const reviewSubmission = useMutation(api.challenges.reviewSubmission);

  const [editingId, setEditingId] = useState<Id<"challenges"> | null>(null);
  const [form, setForm] = useState<ChallengeForm>(() => createInitialForm());
  const [isSaving, setIsSaving] = useState(false);
  const [busyReviewId, setBusyReviewId] =
    useState<Id<"challengeCompletions"> | null>(null);
  const [busyChallengeId, setBusyChallengeId] =
    useState<Id<"challenges"> | null>(null);

  const reviewCount = pendingReviews?.length ?? 0;
  const isEditing = editingId !== null;

  const sortedChallenges = useMemo(() => challenges ?? [], [challenges]);

  function resetForm(nextCadence: ChallengeCadence = "weekly") {
    const window = defaultWindow(nextCadence);
    setEditingId(null);
    setForm({
      ...createInitialForm(),
      cadence: nextCadence,
      startAt: window.startAt,
      durationDays: window.durationDays,
    });
  }

  function loadChallengeIntoForm(
    challenge: NonNullable<typeof challenges>[number],
  ) {
    const rules =
      challenge.rules && challenge.rules.length > 0
        ? challenge.rules
        : [
            {
              ruleType: challenge.ruleType,
              targetAirport: challenge.targetAirport,
              targetDepartureAirport: challenge.targetDepartureAirport,
              targetArrivalAirport: challenge.targetArrivalAirport,
              targetAircraftType: challenge.targetAircraftType,
              requiredAirportCount: challenge.requiredAirportCount,
              requiredFlightCount: challenge.requiredFlightCount,
              minDurationMinutes: challenge.minDurationMinutes,
              minDistanceNm: challenge.minDistanceNm,
            },
          ];

    setEditingId(challenge.id);
    setForm({
      title: challenge.title,
      description: challenge.description,
      cadence: challenge.cadence,
      mode: challenge.mode,
      rules: rules.map(ruleFormFromChallengeRule),
      startAt: toLocalInputValue(challenge.startAt),
      durationDays: String(challenge.durationDays),
      isPublished: challenge.isPublished,
    });
  }

  async function handleSubmit() {
    const startAt = new Date(form.startAt).getTime();
    const durationDays = Number(form.durationDays);
    const ruleForms =
      form.mode === "manual" ? [createInitialRule("manual")] : form.rules;
    const rules = ruleForms.map(ruleFormToPayload);
    const primaryRule = rules[0] ?? ruleFormToPayload(createInitialRule());

    const payload = {
      title: form.title,
      description: form.description,
      cadence: form.cadence,
      mode: form.mode,
      ...primaryRule,
      rules,
      startAt,
      durationDays,
      isPublished: form.isPublished,
    };

    const parsedPayload = challengePayloadSchema.safeParse(payload);
    if (!parsedPayload.success) {
      const messages = Array.from(
        new Set(parsedPayload.error.issues.map((issue) => issue.message)),
      );
      toast.error(messages[0] ?? "Fix the challenge fields before saving", {
        description:
          messages.length > 1 ? messages.slice(1).join("\n") : undefined,
      });
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await updateChallenge({
          challengeId: editingId,
          ...parsedPayload.data,
        });
        toast.success("Challenge updated");
      } else {
        await createChallenge(parsedPayload.data);
        Analytics.track("challenge_created", {
          cadence: parsedPayload.data.cadence,
          mode: parsedPayload.data.mode,
          rule_type: parsedPayload.data.ruleType,
          rule_count: parsedPayload.data.rules.length,
          is_published: parsedPayload.data.isPublished,
        });
        toast.success("Challenge created");
      }

      resetForm(form.cadence);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save challenge";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(
    challengeId: Id<"challenges">,
    isPublished: boolean,
  ) {
    setBusyChallengeId(challengeId);
    try {
      await togglePublished({
        challengeId,
        isPublished: !isPublished,
      });
      toast.success(
        isPublished ? "Challenge unpublished" : "Challenge published",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not update challenge";
      toast.error(message);
    } finally {
      setBusyChallengeId(null);
    }
  }

  async function handleRemove(challengeId: Id<"challenges">) {
    setBusyChallengeId(challengeId);
    try {
      await removeChallenge({ challengeId });
      if (editingId === challengeId) {
        resetForm(form.cadence);
      }
      toast.success("Challenge deleted");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not delete challenge";
      toast.error(message);
    } finally {
      setBusyChallengeId(null);
    }
  }

  async function handleReview(
    completionId: Id<"challengeCompletions">,
    decision: "approve" | "reject",
  ) {
    setBusyReviewId(completionId);
    try {
      await reviewSubmission({ completionId, decision });
      Analytics.track("challenge_submission_reviewed", {
        decision,
      });
      toast.success(
        decision === "approve" ? "Submission approved" : "Submission rejected",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not review submission";
      toast.error(message);
    } finally {
      setBusyReviewId(null);
    }
  }

  function updateRule(index: number, values: Partial<ChallengeRuleForm>) {
    setForm((current) => ({
      ...current,
      rules: current.rules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...values } : rule,
      ),
    }));
  }

  function addRule() {
    setForm((current) => ({
      ...current,
      rules: [...current.rules, createInitialRule()],
    }));
  }

  function removeRule(index: number) {
    setForm((current) => ({
      ...current,
      rules: current.rules.filter((_, ruleIndex) => ruleIndex !== index),
    }));
  }

  function renderRuleFields(rule: ChallengeRuleForm, index: number) {
    if (
      rule.ruleType === "visit_airport" ||
      rule.ruleType === "depart_airport" ||
      rule.ruleType === "arrive_airport"
    ) {
      return (
        <label className="space-y-2">
          <span className="text-sm text-slate-400">Airport</span>
          <input
            value={rule.targetAirport}
            onChange={(event) =>
              updateRule(index, {
                targetAirport: event.target.value.toUpperCase(),
              })
            }
            placeholder="LOWI"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-cyan-500/50"
          />
        </label>
      );
    }

    if (rule.ruleType === "visit_airport_count") {
      return (
        <label className="space-y-2">
          <span className="text-sm text-slate-400">
            Unique airports to visit
          </span>
          <input
            type="number"
            min="1"
            value={rule.requiredAirportCount}
            onChange={(event) =>
              updateRule(index, { requiredAirportCount: event.target.value })
            }
            placeholder="5"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
          />
        </label>
      );
    }

    if (rule.ruleType === "route") {
      return (
        <>
          <label className="space-y-2">
            <span className="text-sm text-slate-400">Departure airport</span>
            <input
              value={rule.targetDepartureAirport}
              onChange={(event) =>
                updateRule(index, {
                  targetDepartureAirport: event.target.value.toUpperCase(),
                })
              }
              placeholder="KJFK"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-cyan-500/50"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-400">Arrival airport</span>
            <input
              value={rule.targetArrivalAirport}
              onChange={(event) =>
                updateRule(index, {
                  targetArrivalAirport: event.target.value.toUpperCase(),
                })
              }
              placeholder="KLAX"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-cyan-500/50"
            />
          </label>
        </>
      );
    }

    if (rule.ruleType === "aircraft_type") {
      return (
        <label className="space-y-2">
          <span className="text-sm text-slate-400">Aircraft type</span>
          <input
            value={rule.targetAircraftType}
            onChange={(event) =>
              updateRule(index, {
                targetAircraftType: event.target.value.toUpperCase(),
              })
            }
            placeholder="A320"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-cyan-500/50"
          />
        </label>
      );
    }

    if (rule.ruleType === "flight_count") {
      return (
        <label className="space-y-2">
          <span className="text-sm text-slate-400">Flights required</span>
          <input
            type="number"
            min="1"
            value={rule.requiredFlightCount}
            onChange={(event) =>
              updateRule(index, { requiredFlightCount: event.target.value })
            }
            placeholder="3"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
          />
        </label>
      );
    }

    if (rule.ruleType === "min_duration") {
      return (
        <label className="space-y-2">
          <span className="text-sm text-slate-400">Minimum minutes</span>
          <input
            type="number"
            min="1"
            value={rule.minDurationMinutes}
            onChange={(event) =>
              updateRule(index, { minDurationMinutes: event.target.value })
            }
            placeholder="90"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
          />
        </label>
      );
    }

    if (rule.ruleType === "min_distance") {
      return (
        <label className="space-y-2">
          <span className="text-sm text-slate-400">Minimum nautical miles</span>
          <input
            type="number"
            min="1"
            value={rule.minDistanceNm}
            onChange={(event) =>
              updateRule(index, { minDistanceNm: event.target.value })
            }
            placeholder="500"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
          />
        </label>
      );
    }

    return null;
  }

  if (challenges === undefined || pendingReviews === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {isEditing ? "Edit Challenge" : "Create Challenge"}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Weekly and monthly challenges can be auto-tracked from flights or
              manually reviewed by admins.
            </p>
          </div>
          {isEditing && (
            <button
              onClick={() => resetForm(form.cadence)}
              className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10"
            >
              Cancel edit
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-slate-400">Title</span>
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Visit Innsbruck in the next 24 hours"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-400">Cadence</span>
            <Select
              value={form.cadence}
              onValueChange={(value) => {
                const cadence = value as ChallengeCadence;
                const window = defaultWindow(cadence);
                setForm((current) => ({
                  ...current,
                  cadence,
                  startAt: window.startAt,
                  durationDays: window.durationDays,
                }));
              }}
            >
              <SelectTrigger className="h-11 w-full rounded-xl border-white/10 bg-black/30 text-sm text-white shadow-none hover:bg-white/[0.06] focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#0b1118] text-white">
                <SelectItem
                  value="weekly"
                  className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                >
                  Weekly
                </SelectItem>
                <SelectItem
                  value="monthly"
                  className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                >
                  Monthly
                </SelectItem>
                <SelectItem
                  value="custom"
                  className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                >
                  Custom
                </SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-slate-400">Description</span>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              rows={3}
              placeholder="Admins can describe the target and what counts as completion."
              className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-cyan-500/50"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-400">Mode</span>
            <Select
              value={form.mode}
              onValueChange={(value) => {
                const mode = value as ChallengeMode;
                setForm((current) => ({
                  ...current,
                  mode,
                  rules:
                    mode === "manual"
                      ? [createInitialRule("manual")]
                      : current.rules[0]?.ruleType === "manual"
                        ? [createInitialRule()]
                        : current.rules,
                }));
              }}
            >
              <SelectTrigger className="h-11 w-full rounded-xl border-white/10 bg-black/30 text-sm text-white shadow-none hover:bg-white/[0.06] focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#0b1118] text-white">
                <SelectItem
                  value="auto"
                  className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                >
                  Auto tracked
                </SelectItem>
                <SelectItem
                  value="manual"
                  className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                >
                  Manual review
                </SelectItem>
              </SelectContent>
            </Select>
          </label>

          {form.mode === "auto" && (
            <div className="space-y-3 md:col-span-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">Rules</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    All rules below must pass before the challenge is complete.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addRule}
                  disabled={form.rules.length >= 8}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-200 transition-colors hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Add rule
                </button>
              </div>

              <div className="space-y-3">
                {form.rules.map((rule, index) => (
                  <div
                    key={index}
                    className="border border-white/10 bg-black/20 p-4"
                  >
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <label className="flex-1 space-y-2">
                        <span className="text-sm text-slate-400">
                          Rule {index + 1}
                        </span>
                        <Select
                          value={rule.ruleType}
                          onValueChange={(value) =>
                            updateRule(index, {
                              ...createInitialRule(value as ChallengeRuleType),
                            })
                          }
                        >
                          <SelectTrigger className="h-11 w-full rounded-xl border-white/10 bg-black/30 text-sm text-white shadow-none hover:bg-white/[0.06] focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-white/10 bg-[#0b1118] text-white">
                            <SelectItem
                              value="visit_airport"
                              className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                            >
                              Visit airport
                            </SelectItem>
                            <SelectItem
                              value="visit_airport_count"
                              className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                            >
                              Visit X airports
                            </SelectItem>
                            <SelectItem
                              value="depart_airport"
                              className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                            >
                              Depart airport
                            </SelectItem>
                            <SelectItem
                              value="arrive_airport"
                              className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                            >
                              Arrive airport
                            </SelectItem>
                            <SelectItem
                              value="route"
                              className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                            >
                              Specific route
                            </SelectItem>
                            <SelectItem
                              value="aircraft_type"
                              className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                            >
                              Specific aircraft
                            </SelectItem>
                            <SelectItem
                              value="flight_count"
                              className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                            >
                              Complete X flights
                            </SelectItem>
                            <SelectItem
                              value="min_duration"
                              className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                            >
                              Minimum duration
                            </SelectItem>
                            <SelectItem
                              value="min_distance"
                              className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                            >
                              Minimum distance
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </label>

                      <button
                        type="button"
                        onClick={() => removeRule(index)}
                        disabled={form.rules.length <= 1}
                        className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Remove rule ${index + 1}`}
                        title="Remove rule"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {renderRuleFields(rule, index)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className="space-y-2">
            <span className="text-sm text-slate-400">Start</span>
            <input
              type="datetime-local"
              value={form.startAt}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  startAt: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-400">
              {form.cadence === "weekly"
                ? "Duration"
                : form.cadence === "monthly"
                  ? "Duration"
                  : "Custom days"}
            </span>
            <input
              type="number"
              min="1"
              disabled={form.cadence !== "custom"}
              value={form.durationDays}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  durationDays: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50 disabled:opacity-60"
            />
            <p className="text-xs text-slate-500">
              {form.cadence === "weekly" &&
                "Weekly challenges always run for 7 days."}
              {form.cadence === "monthly" &&
                "Monthly challenges always run for 30 days."}
              {form.cadence === "custom" &&
                "Use this for one-off challenges without manually setting an end date."}
            </p>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isPublished: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-white/20 bg-black/30"
            />
            Publish immediately
          </label>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isEditing ? "Save challenge" : "Create challenge"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="mb-5 flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">
            Pending Manual Reviews
          </h3>
          {reviewCount > 0 && (
            <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 font-mono text-[10px] tracking-wider text-yellow-300 uppercase">
              {reviewCount}
            </span>
          )}
        </div>

        {pendingReviews.length === 0 ? (
          <p className="text-sm text-slate-500">
            No manual challenge submissions need review.
          </p>
        ) : (
          <div className="space-y-3">
            {pendingReviews.map((review) => (
              <div
                key={review.id}
                className="rounded-2xl border border-white/10 bg-black/30 p-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      {review.challengeTitle}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {review.userDisplay} • submitted{" "}
                      {new Date(review.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReview(review.id, "approve")}
                      disabled={busyReviewId === review.id}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-60"
                    >
                      {busyReviewId === review.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => handleReview(review.id, "reject")}
                      disabled={busyReviewId === review.id}
                      className="cursor-pointer rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300 transition-colors hover:bg-red-500/25 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                <p className="mb-3 text-sm text-slate-300">
                  {review.challengeDescription}
                </p>
                {review.submissionNote && (
                  <p className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                    {review.submissionNote}
                  </p>
                )}
                {review.flight && (
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-100">
                    Flight: {review.flight.callsign} •{" "}
                    {review.flight.depICAO ?? "???"} to{" "}
                    {review.flight.arrICAO ?? "???"} •{" "}
                    {review.flight.aircraftType}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="mb-5 flex items-center gap-2">
          <Flag className="h-4 w-4 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">All Challenges</h3>
        </div>

        {sortedChallenges.length === 0 ? (
          <p className="text-sm text-slate-500">No challenges yet.</p>
        ) : (
          <div className="space-y-3">
            {sortedChallenges.map((challenge) => {
              const topProgressUsers = challenge.topProgressUsers ?? [];

              return (
                <div
                  key={challenge.id}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] tracking-wider text-slate-400 uppercase">
                          {challenge.cadence}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase ${
                            challenge.isPublished
                              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border border-slate-500/30 bg-slate-500/10 text-slate-300"
                          }`}
                        >
                          {challenge.isPublished ? "published" : "draft"}
                        </span>
                        <span className="rounded border border-cyan-500/20 bg-cyan-500/5 px-2 py-0.5 font-mono text-[10px] tracking-wider text-cyan-300 uppercase">
                          {challenge.mode}
                        </span>
                      </div>
                      <h4 className="text-base font-semibold text-white">
                        {challenge.title}
                      </h4>
                      <p className="mt-1 text-sm text-slate-400">
                        {challenge.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => loadChallengeIntoForm(challenge)}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          handleToggle(challenge.id, challenge.isPublished)
                        }
                        disabled={busyChallengeId === challenge.id}
                        className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-60"
                      >
                        {challenge.isPublished ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        onClick={() => handleRemove(challenge.id)}
                        disabled={busyChallengeId === challenge.id}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300 transition-colors hover:bg-red-500/25 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm text-slate-400 md:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="mb-1 flex items-center gap-2 font-mono text-[10px] tracking-wider text-slate-500 uppercase">
                        <CalendarRange className="h-3.5 w-3.5" />
                        Window
                      </div>
                      <p>
                        {formatChallengeWindow(
                          challenge.startAt,
                          challenge.endAt,
                        )}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {challenge.durationDays} day
                        {challenge.durationDays === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="mb-1 font-mono text-[10px] tracking-wider text-slate-500 uppercase">
                        Rule
                      </div>
                      <p>{describeRule(challenge)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="mb-1 font-mono text-[10px] tracking-wider text-slate-500 uppercase">
                        Progress
                      </div>
                      <p>
                        {challenge.counts.completed} completed •{" "}
                        {challenge.counts.pending} pending •{" "}
                        {challenge.counts.rejected} rejected
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 xl:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] tracking-wider text-slate-500 uppercase">
                        <Flag className="h-3.5 w-3.5" />
                        Top 3 Progress
                      </div>
                      {topProgressUsers.length > 0 ? (
                        <div className="space-y-2">
                          {topProgressUsers.map((pilot, index) => (
                            <div
                              key={pilot.userId}
                              className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan-500/25 bg-cyan-500/10 font-mono text-[10px] text-cyan-200">
                                    {index + 1}
                                  </span>
                                  <span
                                    title={pilot.userId}
                                    className="truncate text-sm text-slate-200"
                                  >
                                    {pilot.displayName}
                                  </span>
                                </div>
                              </div>
                              <div
                                className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-[10px] uppercase ${
                                  pilot.isComplete
                                    ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                                    : "border border-amber-500/25 bg-amber-500/10 text-amber-200"
                                }`}
                              >
                                {pilot.progressLabel}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">
                          No pilots are on the board yet.
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] tracking-wider text-slate-500 uppercase">
                        <Users className="h-3.5 w-3.5" />
                        Completed Pilots
                      </div>
                      {challenge.completedUsers.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {challenge.completedUsers.map((completedUser) => (
                            <span
                              key={completedUser.userId}
                              title={completedUser.userId}
                              className="rounded border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs text-emerald-200"
                            >
                              {completedUser.displayName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">
                          No pilots have completed this challenge yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
