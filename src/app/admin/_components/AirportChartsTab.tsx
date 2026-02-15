"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  approveAirportChart,
  rejectAirportChart,
  deleteAirportChart,
  bulkApproveAirportCharts,
  bulkRejectAirportCharts,
  getChartUserInfoByIds,
  updateAirportChart,
} from "~/app/actions/airport-charts";
import {
  Trash2,
  Check,
  X,
  Map,
  Clock,
  CheckCircle,
  Search,
  CheckSquare,
  Square,
  ExternalLink,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { RejectModal } from "./RejectModal";
import { ConfirmModal } from "./ConfirmModal";
import type { ChartType } from "~/types/airportCharts";

type ChartSubTab = "pending" | "approved";

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "TAXI", label: "Taxi" },
  { value: "SID", label: "SID" },
  { value: "STAR", label: "STAR" },
  { value: "APPROACH", label: "Approach" },
  { value: "GENERAL", label: "General" },
];

interface ChartType2 {
  icao: string;
  chartName: string;
  chartType: string;
}

function matchesChartSearch(chart: ChartType2, query: string) {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    chart.icao?.toLowerCase().includes(q) ||
    chart.chartName?.toLowerCase().includes(q) ||
    chart.chartType?.toLowerCase().includes(q)
  );
}

function EditableChartDetails({
  chartId,
  initialIcao,
  initialChartType,
  initialChartName,
  onSaveSuccess,
}: {
  chartId: string;
  initialIcao: string;
  initialChartType: ChartType;
  initialChartName: string;
  onSaveSuccess?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [icao, setIcao] = useState(initialIcao);
  const [chartType, setChartType] = useState<ChartType>(initialChartType);
  const [chartName, setChartName] = useState(initialChartName);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (icao === initialIcao && chartType === initialChartType && chartName === initialChartName) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    const result = await updateAirportChart(chartId, icao, chartType, chartName);
    setIsSaving(false);
    if (result.success) {
      toast.success("Chart details updated");
      setIsEditing(false);
      onSaveSuccess?.();
    } else {
      toast.error(result.error || "Failed to update chart");
    }
  };

  const handleCancel = () => {
    setIcao(initialIcao);
    setChartType(initialChartType);
    setChartName(initialChartName);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={icao}
            onChange={(e) => setIcao(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="ICAO"
            maxLength={4}
            className="w-16 rounded-md border border-cyan-500/50 bg-black/60 px-2 py-1 font-mono text-sm text-cyan-400 outline-none focus:border-cyan-400"
            disabled={isSaving}
            autoFocus
          />
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
            className="rounded-md border border-blue-500/50 bg-black/60 px-2 py-1 text-sm text-blue-400 outline-none focus:border-blue-400"
            disabled={isSaving}
          >
            {CHART_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <input
          type="text"
          value={chartName}
          onChange={(e) => setChartName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Chart Name"
          className="w-full rounded-md border border-white/20 bg-black/60 px-2 py-1 text-sm text-white outline-none focus:border-white/40"
          disabled={isSaving}
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="cursor-pointer rounded-md bg-emerald-500/20 p-1 text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="cursor-pointer rounded-md bg-red-500/20 p-1 text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/details">
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        <span className="rounded-md bg-cyan-500/20 px-2 py-1 font-mono text-sm font-bold text-cyan-400">
          {initialIcao}
        </span>
        <span className="rounded-md bg-blue-500/20 px-2 py-1 text-xs font-medium text-blue-400">
          {initialChartType}
        </span>
        <button
          onClick={() => setIsEditing(true)}
          className="cursor-pointer rounded-md p-1 text-slate-600 opacity-0 transition-all hover:bg-white/10 hover:text-cyan-400 group-hover/details:opacity-100"
          title="Edit chart details"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-sm text-white truncate" title={initialChartName}>
        {initialChartName}
      </p>
    </div>
  );
}

export function AirportChartsTab() {
  const pendingQuery = useQuery(api.airportCharts.getPending);
  const approvedQuery = useQuery(api.airportCharts.getApproved);
  const pendingCharts = useMemo(() => pendingQuery ?? [], [pendingQuery]);
  const approvedCharts = useMemo(() => approvedQuery ?? [], [approvedQuery]);

  const [userInfo, setUserInfo] = useState<
    Record<string, { email: string; name: string | null }>
  >({});
  const [chartSubTab, setChartSubTab] = useState<ChartSubTab>("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [icaoFilter, setIcaoFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<ChartType | "">("");
  const [selectedCharts, setSelectedCharts] = useState<Set<string>>(new Set());
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTargetIds, setRejectTargetIds] = useState<string[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetInfo, setDeleteTargetInfo] = useState<{
    icao: string;
    chartName: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteTargetIds, setBulkDeleteTargetIds] = useState<string[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  const allCharts = useMemo(
    () => [...pendingCharts, ...approvedCharts],
    [pendingCharts, approvedCharts]
  );

  const uniqueIcaos = useMemo(() => {
    const icaos = new Set<string>();
    allCharts.forEach((chart) => {
      if (!chart.icao) return;
      if (!matchesChartSearch(chart, searchQuery)) return;
      if (typeFilter && chart.chartType !== typeFilter) return;
      icaos.add(chart.icao);
    });
    return Array.from(icaos).sort();
  }, [allCharts, searchQuery, typeFilter]);

  useEffect(() => {
    if (icaoFilter && !uniqueIcaos.includes(icaoFilter)) {
      setIcaoFilter("");
    }
  }, [uniqueIcaos, icaoFilter]);

  const hasActiveFilters = searchQuery || icaoFilter || typeFilter;

  const filterCharts = (charts: typeof pendingCharts) => {
    return charts
      .filter((chart) => {
        if (icaoFilter && chart.icao !== icaoFilter) return false;
        if (typeFilter && chart.chartType !== typeFilter) return false;
        if (!matchesChartSearch(chart, searchQuery)) return false;
        return true;
      })
      .sort((a, b) => {
        const icaoCompare = (a.icao || "").localeCompare(b.icao || "");
        if (icaoCompare !== 0) return icaoCompare;
        const typeCompare = (a.chartType || "").localeCompare(b.chartType || "");
        if (typeCompare !== 0) return typeCompare;
        return (a.chartName || "").localeCompare(b.chartName || "");
      });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setIcaoFilter("");
    setTypeFilter("");
  };

  const filteredPendingCharts = filterCharts(pendingCharts);
  const filteredApprovedCharts = filterCharts(approvedCharts);

  useEffect(() => {
    const allUserIds = [...pendingCharts, ...approvedCharts]
      .flatMap((chart) => [chart.uploadedBy, chart.approvedBy])
      .filter(Boolean) as string[];
    const uniqueUserIds = [...new Set(allUserIds)];
    if (uniqueUserIds.length > 0) {
      getChartUserInfoByIds(uniqueUserIds)
        .then(setUserInfo)
        .catch((e) => console.error("Failed to fetch user info:", e));
    }
  }, [pendingCharts, approvedCharts]);

  async function handleApprove(id: string) {
    setActionLoading(id);
    const result = await approveAirportChart(id);
    if (result.success) {
      setSelectedCharts((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("Chart approved");
    } else {
      toast.error(result.error || "Failed to approve chart");
    }
    setActionLoading(null);
  }

  function openRejectModal(ids: string[]) {
    setRejectTargetIds(ids);
    setRejectReason("");
    setRejectModalOpen(true);
  }

  async function handleRejectConfirm() {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    setRejectModalOpen(false);

    if (rejectTargetIds.length === 1 && rejectTargetIds[0]) {
      const targetId = rejectTargetIds[0];
      setActionLoading(targetId);
      const result = await rejectAirportChart(targetId, rejectReason);
      if (result.success) {
        setSelectedCharts((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
        toast.success("Chart rejected");
      } else {
        toast.error(result.error || "Failed to reject chart");
      }
      setActionLoading(null);
    } else if (rejectTargetIds.length > 1) {
      setBulkLoading(true);
      const result = await bulkRejectAirportCharts(rejectTargetIds, rejectReason);
      if (result.rejected > 0) {
        setSelectedCharts(new Set());
        if (result.failed > 0) {
          toast.warning(`Rejected ${result.rejected} charts, ${result.failed} failed`);
        } else {
          toast.success(`Rejected ${result.rejected} charts`);
        }
      } else if (result.failed > 0) {
        toast.error(`Failed to reject ${result.failed} charts`);
      }
      setBulkLoading(false);
    }
    setRejectTargetIds([]);
    setRejectReason("");
  }

  function openDeleteModal(id: string, icao: string, chartName: string) {
    setDeleteTargetId(id);
    setDeleteTargetInfo({ icao, chartName });
    setDeleteModalOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!deleteTargetId) return;
    setDeleteLoading(true);
    const result = await deleteAirportChart(deleteTargetId);
    if (result.success) {
      toast.success("Chart deleted");
    } else {
      toast.error(result.error || "Failed to delete chart");
    }
    setDeleteLoading(false);
    setDeleteModalOpen(false);
    setDeleteTargetId(null);
    setDeleteTargetInfo(null);
  }

  function handleDeleteCancel() {
    setDeleteModalOpen(false);
    setDeleteTargetId(null);
    setDeleteTargetInfo(null);
  }

  function toggleSelect(id: string) {
    setSelectedCharts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    const charts = chartSubTab === "pending" ? filteredPendingCharts : filteredApprovedCharts;
    setSelectedCharts(new Set(charts.map((c) => c.id)));
  }

  function clearSelection() {
    setSelectedCharts(new Set());
  }

  async function handleBulkApprove() {
    const ids = Array.from(selectedCharts);
    if (ids.length === 0) return;
    setBulkLoading(true);
    const result = await bulkApproveAirportCharts(ids);
    if (result.approved > 0) {
      setSelectedCharts(new Set());
      if (result.failed > 0) {
        toast.warning(`Approved ${result.approved} charts, ${result.failed} failed`);
      } else {
        toast.success(`Approved ${result.approved} charts`);
      }
    } else if (result.failed > 0) {
      toast.error(`Failed to approve ${result.failed} charts`);
    }
    setBulkLoading(false);
  }

  function handleBulkReject() {
    const ids = Array.from(selectedCharts);
    if (ids.length === 0) return;
    openRejectModal(ids);
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedCharts);
    if (ids.length === 0) return;
    setBulkDeleteTargetIds(ids);
    setBulkDeleteModalOpen(true);
  }

  async function handleBulkDeleteConfirm() {
    if (bulkDeleteTargetIds.length === 0) return;
    setBulkDeleteLoading(true);

    const results = await Promise.all(
      bulkDeleteTargetIds.map((id) => deleteAirportChart(id))
    );
    const deleted = results.filter((r) => r.success).length;
    const failed = results.length - deleted;

    if (deleted > 0) {
      setSelectedCharts(new Set());
      if (failed > 0) {
        toast.warning(`Deleted ${deleted} charts, ${failed} failed`);
      } else {
        toast.success(`Deleted ${deleted} charts`);
      }
    } else if (failed > 0) {
      toast.error(`Failed to delete ${failed} charts`);
    }
    setBulkDeleteLoading(false);
    setBulkDeleteModalOpen(false);
    setBulkDeleteTargetIds([]);
  }

  return (
    <>
      <RejectModal
        isOpen={rejectModalOpen}
        targetCount={rejectTargetIds.length}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        onConfirm={handleRejectConfirm}
        onCancel={() => setRejectModalOpen(false)}
      />

      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Approved Chart"
        message={
          deleteTargetInfo
            ? `Are you sure you want to delete "${deleteTargetInfo.chartName}" for ${deleteTargetInfo.icao}? This action cannot be undone.`
            : "Are you sure you want to delete this approved chart?"
        }
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      <ConfirmModal
        isOpen={bulkDeleteModalOpen}
        title="Delete Approved Charts"
        message={`Are you sure you want to delete ${bulkDeleteTargetIds.length} approved chart(s)? This action cannot be undone.`}
        confirmLabel="Delete All"
        variant="danger"
        isLoading={bulkDeleteLoading}
        onConfirm={handleBulkDeleteConfirm}
        onCancel={() => {
          setBulkDeleteModalOpen(false);
          setBulkDeleteTargetIds([]);
        }}
      />

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ICAO, chart name, type..."
            className="w-full rounded-lg border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-500/50"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={icaoFilter}
            onChange={(e) => setIcaoFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/50"
          >
            <option value="">All Airports</option>
            {uniqueIcaos.map((icao) => (
              <option key={icao} value={icao}>
                {icao}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ChartType | "")}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/50"
          >
            <option value="">All Types</option>
            {CHART_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="cursor-pointer rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-slate-400 transition-all hover:border-red-500/30 hover:text-red-400"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedCharts.size > 0 && (
        <div className="mb-4 flex items-center gap-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
          <span className="font-mono text-sm text-cyan-400">
            {selectedCharts.size} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={clearSelection}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-white/10"
          >
            Clear
          </button>
          {chartSubTab === "pending" ? (
            <>
              <button
                onClick={handleBulkApprove}
                disabled={bulkLoading}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-500/20 px-4 py-1.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                Approve All
              </button>
              <button
                onClick={handleBulkReject}
                disabled={bulkLoading}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-red-500/20 px-4 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Reject All
              </button>
            </>
          ) : (
            <button
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-red-500/20 px-4 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete All
            </button>
          )}
        </div>
      )}

      {/* Sub Tabs */}
      <div className="mb-6 flex items-center gap-2">
        <button
          onClick={() => setChartSubTab("pending")}
          className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 font-mono text-sm transition-all ${
            chartSubTab === "pending"
              ? "bg-yellow-500/20 text-yellow-400"
              : "bg-white/5 text-slate-400 hover:bg-white/10"
          }`}
        >
          <Clock className="h-4 w-4" />
          Pending (
          {filteredPendingCharts.length}
          {hasActiveFilters && filteredPendingCharts.length !== pendingCharts.length
            ? `/${pendingCharts.length}`
            : ""}
          )
        </button>
        <button
          onClick={() => setChartSubTab("approved")}
          className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 font-mono text-sm transition-all ${
            chartSubTab === "approved"
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-white/5 text-slate-400 hover:bg-white/10"
          }`}
        >
          <CheckCircle className="h-4 w-4" />
          Approved (
          {filteredApprovedCharts.length}
          {hasActiveFilters && filteredApprovedCharts.length !== approvedCharts.length
            ? `/${approvedCharts.length}`
            : ""}
          )
        </button>

        {((chartSubTab === "pending" && filteredPendingCharts.length > 0) ||
          (chartSubTab === "approved" && filteredApprovedCharts.length > 0)) && (
          <button
            onClick={() => {
              const currentCharts = chartSubTab === "pending" ? filteredPendingCharts : filteredApprovedCharts;
              if (selectedCharts.size === currentCharts.length) {
                clearSelection();
              } else {
                selectAllVisible();
              }
            }}
            className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-white/10"
          >
            {selectedCharts.size === (chartSubTab === "pending" ? filteredPendingCharts : filteredApprovedCharts).length ? (
              <>
                <CheckSquare className="h-4 w-4" />
                Deselect All
              </>
            ) : (
              <>
                <Square className="h-4 w-4" />
                Select All
              </>
            )}
          </button>
        )}
      </div>

      {/* Pending Charts */}
      {chartSubTab === "pending" && (
        <>
          {filteredPendingCharts.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
              <Clock className="mx-auto mb-4 h-12 w-12 text-slate-600" />
              <h3 className="mb-2 text-xl font-semibold text-white">
                {hasActiveFilters ? "No Matching Charts" : "No Pending Charts"}
              </h3>
              <p className="text-slate-400">
                {hasActiveFilters
                  ? "Try adjusting your search or filters"
                  : "All submissions have been reviewed"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPendingCharts.map((chart) => (
                <div
                  key={chart.id}
                  className={`group overflow-hidden rounded-2xl border bg-black/40 backdrop-blur-xl transition-all ${
                    selectedCharts.has(chart.id)
                      ? "border-cyan-500"
                      : "border-yellow-500/30"
                  }`}
                >
                  <div className="relative aspect-[4/3] bg-slate-900/50 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={chart.chartUrl}
                      alt={chart.chartName}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute top-2 left-2 rounded-md bg-yellow-500/80 px-2 py-1 text-xs font-bold text-black">
                      PENDING
                    </div>
                    <button
                      onClick={() => toggleSelect(chart.id)}
                      className={`absolute top-2 right-2 cursor-pointer rounded-lg p-1.5 transition-all ${
                        selectedCharts.has(chart.id)
                          ? "bg-cyan-500 text-white"
                          : "bg-black/60 text-white opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {selectedCharts.has(chart.id) ? (
                        <CheckSquare className="h-5 w-5" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <div className="p-4">
                    <EditableChartDetails
                      chartId={chart.id}
                      initialIcao={chart.icao}
                      initialChartType={chart.chartType as ChartType}
                      initialChartName={chart.chartName}
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Uploaded by:{" "}
                      <span className="text-cyan-400">
                        {chart.discordUsername || userInfo[chart.uploadedBy ?? ""]?.email || "Unknown"}
                      </span>
                    </p>
                    <p className="mb-3 text-xs text-slate-600">
                      {new Date(chart.createdAt).toLocaleDateString()}
                    </p>
                    <a
                      href={chart.chartUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-3 flex items-center gap-1 text-xs text-cyan-400 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Chart
                    </a>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(chart.id)}
                        disabled={actionLoading === chart.id}
                        className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-emerald-500/20 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => openRejectModal([chart.id])}
                        disabled={actionLoading === chart.id}
                        className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-red-500/20 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Approved Charts */}
      {chartSubTab === "approved" && (
        <>
          {filteredApprovedCharts.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
              <Map className="mx-auto mb-4 h-12 w-12 text-slate-600" />
              <h3 className="mb-2 text-xl font-semibold text-white">
                {hasActiveFilters ? "No Matching Charts" : "No Approved Charts"}
              </h3>
              <p className="text-slate-400">
                {hasActiveFilters
                  ? "Try adjusting your search or filters"
                  : "Approve some pending charts to see them here"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredApprovedCharts.map((chart) => (
                <div
                  key={chart.id}
                  className={`group overflow-hidden rounded-2xl border bg-black/40 backdrop-blur-xl transition-all ${
                    selectedCharts.has(chart.id)
                      ? "border-cyan-500"
                      : "border-white/10 hover:border-cyan-500/30"
                  }`}
                >
                  <div className="relative aspect-[4/3] bg-slate-900/50 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={chart.chartUrl}
                      alt={chart.chartName}
                      className="h-full w-full object-cover"
                    />
                    <button
                      onClick={() => toggleSelect(chart.id)}
                      className={`absolute top-2 left-2 cursor-pointer rounded-lg p-1.5 transition-all ${
                        selectedCharts.has(chart.id)
                          ? "bg-cyan-500 text-white"
                          : "bg-black/60 text-white opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {selectedCharts.has(chart.id) ? (
                        <CheckSquare className="h-5 w-5" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() => openDeleteModal(chart.id, chart.icao, chart.chartName)}
                      className="absolute top-2 right-2 cursor-pointer rounded-lg bg-red-500/80 p-2 opacity-0 transition-all hover:bg-red-500 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4 text-white" />
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <EditableChartDetails
                          chartId={chart.id}
                          initialIcao={chart.icao}
                          initialChartType={chart.chartType as ChartType}
                          initialChartName={chart.chartName}
                        />
                      </div>
                      <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-1" />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Uploaded by:{" "}
                      <span className="text-cyan-400">
                        {chart.discordUsername || userInfo[chart.uploadedBy ?? ""]?.email || "Unknown"}
                      </span>
                    </p>
                    {chart.approvedBy && (
                      <p className="mt-1 text-xs text-slate-500">
                        Approved by:{" "}
                        <span className="text-emerald-400">
                          {userInfo[chart.approvedBy]?.email || "Unknown"}
                        </span>
                        {chart.approvedAt && (
                          <span className="text-slate-600">
                            {" "}on {new Date(chart.approvedAt).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                    )}
                    <a
                      href={chart.chartUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center gap-1 text-xs text-cyan-400 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Chart
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
