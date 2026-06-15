"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import {
  Activity,
  CheckCircle2,
  Crown,
  FilePenLine,
  Plane,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";

const ACTION_LABELS = {
  upload: "Uploaded",
  approve: "Approved",
  reject: "Rejected",
  edit: "Edited",
  delete: "Removed",
  create: "Created",
  grant_pro: "Granted PRO",
  revoke_pro: "Revoked PRO",
} as const;

const RESOURCE_LABELS = {
  aircraft_image: "Aircraft image",
  airport_chart: "Airport chart",
  virtual_airline: "Virtual airline",
  pro_access: "PRO access",
} as const;

const ACTION_STYLES = {
  upload: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  approve: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  reject: "border-red-400/30 bg-red-400/10 text-red-200",
  edit: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  delete: "border-red-400/30 bg-red-400/10 text-red-200",
  create: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  grant_pro: "border-yellow-400/30 bg-yellow-400/10 text-yellow-200",
  revoke_pro: "border-orange-400/30 bg-orange-400/10 text-orange-200",
} as const;

type TelemetryAction = keyof typeof ACTION_LABELS;
type TelemetryResourceType = keyof typeof RESOURCE_LABELS;
const ALL_ACTIONS_VALUE = "__all_actions__";

interface TelemetryEvent {
  id: string;
  actorClerkId: string;
  actorEmail: string | null;
  actorDiscordUsername: string | null;
  action: TelemetryAction;
  resourceType: TelemetryResourceType;
  resourceLabel: string;
  targetClerkId: string | null;
  targetEmail: string | null;
  targetDiscordUsername: string | null;
  metadata: unknown;
  createdAt: number;
}

function formatActor(event: TelemetryEvent) {
  return (
    event.actorDiscordUsername ??
    event.actorEmail ??
    `Clerk ${event.actorClerkId.slice(0, 8)}`
  );
}

function formatTarget(event: TelemetryEvent) {
  return (
    event.targetDiscordUsername ??
    event.targetEmail ??
    (event.targetClerkId ? `Clerk ${event.targetClerkId.slice(0, 8)}` : null)
  );
}

function formatTimestamp(value: number) {
  const date = new Date(value);
  const formattedDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${formattedDate} ${hours}${minutes}z`;
}

function formatMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const data = metadata as Record<string, unknown>;

  if (typeof data.reason === "string" && data.reason.trim()) {
    return data.reason;
  }

  if (typeof data.expiresAt === "number") {
    return `Temporary grant until ${formatTimestamp(data.expiresAt)}`;
  }

  if (typeof data.grantType === "string") {
    return data.grantType.replace(/_/g, " ");
  }

  if (data.bulk === true) {
    return "Bulk action";
  }

  return null;
}

function getActionIcon(action: TelemetryEvent["action"]) {
  if (action === "approve") return CheckCircle2;
  if (action === "reject") return XCircle;
  if (action === "edit") return FilePenLine;
  if (action === "delete") return Trash2;
  if (action === "grant_pro" || action === "revoke_pro") return Crown;
  if (action === "upload") return Upload;
  return Plane;
}

export function AdminTelemetryTab({
  canRunSuperAdminQueries,
}: {
  canRunSuperAdminQueries: boolean;
}) {
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] =
    useState<typeof ALL_ACTIONS_VALUE | TelemetryAction>(ALL_ACTIONS_VALUE);
  const events = useQuery(
    api.adminTelemetry.getRecent,
    canRunSuperAdminQueries ? { limit: 100 } : "skip",
  );

  const filteredEvents = useMemo(() => {
    if (!events) return null;

    const normalizedUserFilter = userFilter.trim().toLowerCase();

    return events.filter((event) => {
      const matchesUser =
        !normalizedUserFilter ||
        [
          formatActor(event),
          event.actorEmail,
          event.actorDiscordUsername,
          event.actorClerkId,
          formatTarget(event),
          event.targetEmail,
          event.targetDiscordUsername,
          event.targetClerkId,
        ]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(normalizedUserFilter));

      const matchesAction =
        actionFilter === ALL_ACTIONS_VALUE || event.action === actionFilter;

      return matchesUser && matchesAction;
    });
  }, [actionFilter, events, userFilter]);

  const groupedStats = useMemo(() => {
    if (!filteredEvents) return null;

    return {
      total: filteredEvents.length,
      approvals: filteredEvents.filter((event) => event.action === "approve")
        .length,
      removals: filteredEvents.filter(
        (event) => event.action === "reject" || event.action === "delete",
      ).length,
      edits: filteredEvents.filter((event) => event.action === "edit").length,
    };
  }, [filteredEvents]);

  const hasActiveFilters =
    userFilter.trim().length > 0 || actionFilter !== ALL_ACTIONS_VALUE;

  if (events === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  if (events === null) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
        Super-admin access is required to view admin telemetry.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <TelemetryStat label="Recent events" value={groupedStats?.total ?? 0} />
        <TelemetryStat label="Approvals" value={groupedStats?.approvals ?? 0} />
        <TelemetryStat label="Edits" value={groupedStats?.edits ?? 0} />
        <TelemetryStat label="Removals" value={groupedStats?.removals ?? 0} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={userFilter}
            onChange={(event) => setUserFilter(event.target.value)}
            placeholder="Filter by user, email, Discord, or Clerk ID..."
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pr-4 pl-10 text-sm text-white placeholder-slate-500 transition-colors outline-none focus:border-cyan-500/50 focus:bg-white/[0.07]"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Select
            value={actionFilter}
            onValueChange={(value: string) =>
              setActionFilter(value as typeof ALL_ACTIONS_VALUE | TelemetryAction)
            }
          >
            <SelectTrigger className="h-11 w-full rounded-lg border-white/10 bg-white/5 font-mono text-sm text-white shadow-none hover:bg-white/[0.07] focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/20">
              <SelectValue placeholder="All Processes" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#0b1118] text-white">
              <SelectItem
                value={ALL_ACTIONS_VALUE}
                className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
              >
                All Processes
              </SelectItem>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <SelectItem
                  key={value}
                  value={value}
                  className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                >
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setUserFilter("");
                setActionFilter(ALL_ACTIONS_VALUE);
              }}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-400 transition-colors hover:border-red-500/30 hover:text-red-400"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="border-y border-white/10">
        {filteredEvents?.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            {events.length === 0
              ? "No admin activity has been recorded yet."
              : "No admin activity matches the current filters."}
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {filteredEvents?.map((event) => {
              const Icon = getActionIcon(event.action);
              const target = formatTarget(event);
              const note = formatMetadata(event.metadata);

              return (
                <div
                  key={event.id}
                  className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="flex min-w-0 gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${ACTION_STYLES[event.action]}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="font-medium text-white">
                          {formatActor(event)}
                        </span>
                        <span className="font-mono text-xs text-slate-500 uppercase">
                          {ACTION_LABELS[event.action]}
                        </span>
                        <span className="text-slate-300">
                          {event.resourceLabel}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-slate-500">
                        <span>{RESOURCE_LABELS[event.resourceType]}</span>
                        {target && <span>Affected: {target}</span>}
                        {note && <span>{note}</span>}
                      </div>
                    </div>
                  </div>
                  <time className="font-mono text-xs text-slate-500 sm:pt-2 sm:text-right">
                    {formatTimestamp(event.createdAt)}
                  </time>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TelemetryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center gap-2 text-xs tracking-wider text-slate-500 uppercase">
        <Activity className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
