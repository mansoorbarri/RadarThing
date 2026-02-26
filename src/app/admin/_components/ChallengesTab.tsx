"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Plus,
  Pencil,
  Trophy,
  ToggleLeft,
  ToggleRight,
  Users,
  CalendarIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

function formatDate(ts: number): string {
  const d = new Date(ts);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function DatePicker({
  value,
  onChange,
  placeholder,
}: {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "dd/MM/yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(day) => {
            onChange(day);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

interface ChallengeData {
  _id: Id<"challenges">;
  title: string;
  description: string;
  type: "weekly" | "monthly";
  startDate: number;
  endDate: number;
  isActive: boolean;
  criteria: {
    minFlights?: number;
    regions?: string[];
    uniqueAirports?: number;
    specificAirports?: string[];
    minAvgDurationMs?: number;
    minTotalDurationMs?: number;
    minSingleDurationMs?: number;
    minTotalDistanceNm?: number;
    minSingleDistanceNm?: number;
    aircraftTypes?: string[];
    minMaxAltitude?: number;
  };
  firstCompletedBy?: Id<"users">;
}

function utcTsToDate(ts: number): Date {
  const d = new Date(ts);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function ChallengeForm({
  onClose,
  editingChallenge,
}: {
  onClose: () => void;
  editingChallenge?: ChallengeData;
}) {
  const isEditing = !!editingChallenge;
  const { user } = useUser();
  const createChallenge = useMutation(api.challenges.create);
  const updateChallenge = useMutation(api.challenges.update);
  const [submitting, setSubmitting] = useState(false);

  const c = editingChallenge?.criteria;

  const [title, setTitle] = useState(editingChallenge?.title ?? "");
  const [description, setDescription] = useState(
    editingChallenge?.description ?? "",
  );
  const [type, setType] = useState<"weekly" | "monthly">(
    editingChallenge?.type ?? "weekly",
  );
  const [startDate, setStartDate] = useState<Date | undefined>(
    editingChallenge ? utcTsToDate(editingChallenge.startDate) : undefined,
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    editingChallenge ? utcTsToDate(editingChallenge.endDate) : undefined,
  );

  // Criteria
  const [minFlights, setMinFlights] = useState(
    c?.minFlights?.toString() ?? "",
  );
  const [uniqueAirports, setUniqueAirports] = useState(
    c?.uniqueAirports?.toString() ?? "",
  );
  const [specificAirports, setSpecificAirports] = useState(
    c?.specificAirports?.join(", ") ?? "",
  );
  const [regions, setRegions] = useState(c?.regions?.join(", ") ?? "");
  const [aircraftTypes, setAircraftTypes] = useState(
    c?.aircraftTypes?.join(", ") ?? "",
  );
  const [minTotalDurationMs, setMinTotalDurationMs] = useState(
    c?.minTotalDurationMs
      ? (c.minTotalDurationMs / (60 * 60 * 1000)).toString()
      : "",
  );
  const [minSingleDurationMs, setMinSingleDurationMs] = useState(
    c?.minSingleDurationMs
      ? (c.minSingleDurationMs / (60 * 1000)).toString()
      : "",
  );
  const [minTotalDistanceNm, setMinTotalDistanceNm] = useState(
    c?.minTotalDistanceNm?.toString() ?? "",
  );
  const [minSingleDistanceNm, setMinSingleDistanceNm] = useState(
    c?.minSingleDistanceNm?.toString() ?? "",
  );
  const [minMaxAltitude, setMinMaxAltitude] = useState(
    c?.minMaxAltitude?.toString() ?? "",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !title || !startDate || !endDate) {
      toast.error("Title, start date, and end date are required");
      return;
    }

    setSubmitting(true);
    try {
      const criteria: Record<string, unknown> = {};
      if (minFlights) criteria.minFlights = parseInt(minFlights);
      if (uniqueAirports) criteria.uniqueAirports = parseInt(uniqueAirports);
      if (specificAirports)
        criteria.specificAirports = specificAirports
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
      if (regions)
        criteria.regions = regions
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
      if (aircraftTypes)
        criteria.aircraftTypes = aircraftTypes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      if (minTotalDurationMs)
        criteria.minTotalDurationMs =
          parseFloat(minTotalDurationMs) * 60 * 60 * 1000;
      if (minSingleDurationMs)
        criteria.minSingleDurationMs =
          parseFloat(minSingleDurationMs) * 60 * 1000;
      if (minTotalDistanceNm)
        criteria.minTotalDistanceNm = parseFloat(minTotalDistanceNm);
      if (minSingleDistanceNm)
        criteria.minSingleDistanceNm = parseFloat(minSingleDistanceNm);
      if (minMaxAltitude)
        criteria.minMaxAltitude = parseFloat(minMaxAltitude);

      // Set start to beginning of day, end to end of day (UTC)
      const startTs = new Date(
        Date.UTC(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate(),
        ),
      ).getTime();
      const endTs = new Date(
        Date.UTC(
          endDate.getFullYear(),
          endDate.getMonth(),
          endDate.getDate(),
          23,
          59,
          59,
        ),
      ).getTime();

      const typedCriteria = criteria as {
        minFlights?: number;
        regions?: string[];
        uniqueAirports?: number;
        specificAirports?: string[];
        minAvgDurationMs?: number;
        minTotalDurationMs?: number;
        minSingleDurationMs?: number;
        minTotalDistanceNm?: number;
        minSingleDistanceNm?: number;
        aircraftTypes?: string[];
        minMaxAltitude?: number;
      };

      if (isEditing) {
        await updateChallenge({
          id: editingChallenge._id,
          title,
          description,
          type,
          startDate: startTs,
          endDate: endTs,
          criteria: typedCriteria,
        });
        toast.success("Challenge updated");
      } else {
        await createChallenge({
          title,
          description,
          type,
          startDate: startTs,
          endDate: endTs,
          criteria: typedCriteria,
          createdBy: user.id,
        });
        toast.success("Challenge created");
      }

      onClose();
    } catch {
      toast.error(
        isEditing ? "Failed to update challenge" : "Failed to create challenge",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClassName =
    "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl"
    >
      <h3 className="mb-4 text-lg font-bold text-white">
        {isEditing ? "Edit Challenge" : "New Challenge"}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-slate-400">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClassName}
            placeholder="European Explorer"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-slate-400">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClassName}
            placeholder="Fly to 5 unique European airports this week"
            rows={2}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Type</label>
          <Select value={type} onValueChange={(v) => setType(v as "weekly" | "monthly")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div />
        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Start Date
          </label>
          <DatePicker
            value={startDate}
            onChange={setStartDate}
            placeholder="Pick start date"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">End Date</label>
          <DatePicker
            value={endDate}
            onChange={setEndDate}
            placeholder="Pick end date"
          />
        </div>

        {/* Criteria Section */}
        <div className="sm:col-span-2 mt-2">
          <h4 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-500">
            Criteria
          </h4>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Min Flights
          </label>
          <input
            type="number"
            value={minFlights}
            onChange={(e) => setMinFlights(e.target.value)}
            className={inputClassName}
            placeholder="e.g. 5"
            min={1}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Unique Airports
          </label>
          <input
            type="number"
            value={uniqueAirports}
            onChange={(e) => setUniqueAirports(e.target.value)}
            className={inputClassName}
            placeholder="e.g. 5"
            min={1}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Specific Airports (comma-separated)
          </label>
          <input
            value={specificAirports}
            onChange={(e) => setSpecificAirports(e.target.value)}
            className={inputClassName}
            placeholder="EGLL, LFPG, EDDF"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">
            ICAO Region Prefixes (comma-separated)
          </label>
          <input
            value={regions}
            onChange={(e) => setRegions(e.target.value)}
            className={inputClassName}
            placeholder="E, L (for Europe)"
          />
          <p className="mt-1.5 text-[10px] leading-relaxed text-slate-600">
            K = US, C = Canada, E/L = Europe, V/Z/R/W = Asia, O = Middle East,
            D/F/G/H = Africa, S = South America, Y/N = Oceania
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Aircraft Types (comma-separated)
          </label>
          <input
            value={aircraftTypes}
            onChange={(e) => setAircraftTypes(e.target.value)}
            className={inputClassName}
            placeholder="Boeing 737-800, Airbus A320"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Min Total Duration (hours)
          </label>
          <input
            type="number"
            step="0.5"
            value={minTotalDurationMs}
            onChange={(e) => setMinTotalDurationMs(e.target.value)}
            className={inputClassName}
            placeholder="e.g. 10"
            min={0}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Min Single Flight Duration (minutes)
          </label>
          <input
            type="number"
            value={minSingleDurationMs}
            onChange={(e) => setMinSingleDurationMs(e.target.value)}
            className={inputClassName}
            placeholder="e.g. 30"
            min={0}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Min Total Distance (nm)
          </label>
          <input
            type="number"
            value={minTotalDistanceNm}
            onChange={(e) => setMinTotalDistanceNm(e.target.value)}
            className={inputClassName}
            placeholder="e.g. 1000"
            min={0}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Min Single Flight Distance (nm)
          </label>
          <input
            type="number"
            value={minSingleDistanceNm}
            onChange={(e) => setMinSingleDistanceNm(e.target.value)}
            className={inputClassName}
            placeholder="e.g. 200"
            min={0}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Min Max Altitude (ft)
          </label>
          <input
            type="number"
            value={minMaxAltitude}
            onChange={(e) => setMinMaxAltitude(e.target.value)}
            className={inputClassName}
            placeholder="e.g. 35000"
            min={0}
          />
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-cyan-500/20 px-4 py-2.5 text-sm font-medium text-cyan-400 transition-all hover:bg-cyan-500/30 disabled:opacity-50"
        >
          {submitting
            ? isEditing
              ? "Saving..."
              : "Creating..."
            : isEditing
              ? "Save Changes"
              : "Create Challenge"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 transition-all hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ChallengeRow({
  challenge,
  onEdit,
}: {
  challenge: ChallengeData;
  onEdit: () => void;
}) {
  const toggleActive = useMutation(api.challenges.deactivate);
  const completions = useQuery(api.challenges.getCompletions, {
    challengeId: challenge._id,
  });
  const [toggling, setToggling] = useState(false);

  const now = Date.now();
  const isExpired = challenge.endDate < now;
  const isUpcoming = challenge.startDate > now;

  const handleToggle = async () => {
    setToggling(true);
    try {
      await toggleActive({
        id: challenge._id,
        isActive: !challenge.isActive,
      });
      toast.success(
        challenge.isActive ? "Challenge deactivated" : "Challenge activated",
      );
    } catch {
      toast.error("Failed to update challenge");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-white">
            {challenge.title}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
              challenge.type === "weekly"
                ? "bg-cyan-500/20 text-cyan-400"
                : "bg-purple-500/20 text-purple-400"
            }`}
          >
            {challenge.type}
          </span>
          {isExpired && (
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 font-mono text-[10px] text-red-400">
              EXPIRED
            </span>
          )}
          {isUpcoming && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] text-amber-400">
              UPCOMING
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>
            {formatDate(challenge.startDate)} -{" "}
            {formatDate(challenge.endDate)}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {completions?.length ?? 0} completions
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          className="cursor-pointer p-2 text-slate-400 transition-colors hover:text-white"
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className="cursor-pointer p-2 text-slate-400 transition-colors hover:text-white disabled:opacity-50"
          title={challenge.isActive ? "Deactivate" : "Activate"}
        >
          {challenge.isActive ? (
            <ToggleRight className="h-5 w-5 text-emerald-400" />
          ) : (
            <ToggleLeft className="h-5 w-5 text-slate-600" />
          )}
        </button>
      </div>
    </div>
  );
}

export function ChallengesTab() {
  const challenges = useQuery(api.challenges.getAll);
  const [showForm, setShowForm] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<
    ChallengeData | undefined
  >();

  const closeForm = () => {
    setShowForm(false);
    setEditingChallenge(undefined);
  };

  const handleEdit = (challenge: ChallengeData) => {
    setEditingChallenge(challenge);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-bold text-white">Pilot Challenges</h2>
          {challenges && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-xs text-slate-400">
              {challenges.length}
            </span>
          )}
        </div>
        {!showForm && (
          <button
            onClick={() => {
              setEditingChallenge(undefined);
              setShowForm(true);
            }}
            className="flex cursor-pointer items-center gap-2 rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-400 transition-all hover:bg-cyan-500/30"
          >
            <Plus className="h-4 w-4" />
            New Challenge
          </button>
        )}
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <ChallengeForm
          onClose={closeForm}
          editingChallenge={editingChallenge}
        />
      )}

      {/* Challenges List */}
      {challenges === undefined ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-white/5 bg-white/5"
            />
          ))}
        </div>
      ) : challenges.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
          <Trophy className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <h3 className="mb-2 text-xl font-semibold text-white">
            No Challenges Yet
          </h3>
          <p className="text-slate-400">
            Create your first pilot challenge to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {challenges.map((challenge) => (
            <ChallengeRow
              key={challenge._id}
              challenge={challenge}
              onEdit={() => handleEdit(challenge)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
