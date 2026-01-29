"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  approveAircraftImage,
  rejectAircraftImage,
  deleteAircraftImage,
  bulkApproveAircraftImages,
  bulkRejectAircraftImages,
  getUserInfoByIds,
  updateAircraftImageCodes,
} from "~/app/actions/aircraft-images";
import { Trash2, Check, X, Plane, Clock, CheckCircle, Search, CheckSquare, Square, Pencil } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { RejectModal } from "./RejectModal";

type ImageSubTab = "pending" | "approved";

interface ImageType {
  airlineIata: string;
  airlineIcao: string;
  aircraftType: string;
  discordUsername?: string | null;
}

function matchesImageSearch(image: ImageType, query: string) {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    image.airlineIata?.toLowerCase().includes(q) ||
    image.airlineIcao?.toLowerCase().includes(q) ||
    image.aircraftType?.toLowerCase().includes(q) ||
    image.discordUsername?.toLowerCase().includes(q)
  );
}

function EditableCodes({
  imageId,
  initialIata,
  initialIcao,
  onSaveSuccess,
}: {
  imageId: string;
  initialIata: string;
  initialIcao: string;
  onSaveSuccess?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [iata, setIata] = useState(initialIata);
  const [icao, setIcao] = useState(initialIcao);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (iata === initialIata && icao === initialIcao) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    const result = await updateAircraftImageCodes(imageId, iata, icao);
    setIsSaving(false);
    if (result.success) {
      toast.success("Codes updated");
      setIsEditing(false);
      onSaveSuccess?.();
    } else {
      toast.error(result.error || "Failed to update codes");
    }
  };

  const handleCancel = () => {
    setIata(initialIata);
    setIcao(initialIcao);
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
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={iata}
          onChange={(e) => setIata(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="IATA"
          maxLength={2}
          className="w-14 rounded-md border border-cyan-500/50 bg-black/60 px-2 py-1 font-mono text-sm text-cyan-400 outline-none focus:border-cyan-400"
          disabled={isSaving}
          autoFocus
        />
        <input
          type="text"
          value={icao}
          onChange={(e) => setIcao(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="ICAO"
          maxLength={3}
          className="w-14 rounded-md border border-blue-500/50 bg-black/60 px-2 py-1 font-mono text-sm text-blue-400 outline-none focus:border-blue-400"
          disabled={isSaving}
        />
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
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap group/codes">
      {initialIata && <span className="rounded-md bg-cyan-500/20 px-2 py-1 font-mono text-sm font-bold text-cyan-400">{initialIata}</span>}
      {initialIcao && <span className="rounded-md bg-blue-500/20 px-2 py-1 font-mono text-sm font-bold text-blue-400">{initialIcao}</span>}
      <button
        onClick={() => setIsEditing(true)}
        className="cursor-pointer rounded-md p-1 text-slate-600 opacity-0 transition-all hover:bg-white/10 hover:text-cyan-400 group-hover/codes:opacity-100"
        title="Edit codes"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function AircraftImagesTab() {
  const pendingQuery = useQuery(api.aircraftImages.getPending);
  const approvedQuery = useQuery(api.aircraftImages.getApproved);
  const pendingImages = useMemo(() => pendingQuery ?? [], [pendingQuery]);
  const approvedImages = useMemo(() => approvedQuery ?? [], [approvedQuery]);

  const [userInfo, setUserInfo] = useState<Record<string, { email: string; name: string | null }>>({});
  const [imageSubTab, setImageSubTab] = useState<ImageSubTab>("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [imageSearchQuery, setImageSearchQuery] = useState("");
  const [imageAirlineFilter, setImageAirlineFilter] = useState<string>("");
  const [imageAircraftFilter, setImageAircraftFilter] = useState<string>("");
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTargetIds, setRejectTargetIds] = useState<string[]>([]);

  const allImages = useMemo(() => [...pendingImages, ...approvedImages], [pendingImages, approvedImages]);

  const uniqueImageAirlines = useMemo(() => {
    const airlinesMap = new Map<string, { iata: string; icao: string }>();
    allImages.forEach((img) => {
      const key = img.airlineIata || img.airlineIcao;
      if (!key) return;
      if (!matchesImageSearch(img, imageSearchQuery)) return;
      if (imageAircraftFilter && img.aircraftType !== imageAircraftFilter) return;
      if (!airlinesMap.has(key)) {
        airlinesMap.set(key, { iata: img.airlineIata || "", icao: img.airlineIcao || "" });
      }
    });
    return Array.from(airlinesMap.values()).sort((a, b) => (a.icao || a.iata).localeCompare(b.icao || b.iata));
  }, [allImages, imageSearchQuery, imageAircraftFilter]);

  const uniqueImageAircraftTypes = useMemo(() => {
    const types = new Set<string>();
    allImages.forEach((img) => {
      if (!img.aircraftType) return;
      if (!matchesImageSearch(img, imageSearchQuery)) return;
      if (imageAirlineFilter && img.airlineIata !== imageAirlineFilter && img.airlineIcao !== imageAirlineFilter) return;
      types.add(img.aircraftType);
    });
    return Array.from(types).sort();
  }, [allImages, imageSearchQuery, imageAirlineFilter]);

  useEffect(() => {
    if (imageAirlineFilter && !uniqueImageAirlines.some((a) => a.iata === imageAirlineFilter || a.icao === imageAirlineFilter)) {
      setImageAirlineFilter("");
    }
  }, [uniqueImageAirlines, imageAirlineFilter]);

  useEffect(() => {
    if (imageAircraftFilter && !uniqueImageAircraftTypes.includes(imageAircraftFilter)) {
      setImageAircraftFilter("");
    }
  }, [uniqueImageAircraftTypes, imageAircraftFilter]);

  const hasActiveImageFilters = imageSearchQuery || imageAirlineFilter || imageAircraftFilter;

  const filterImages = (images: typeof pendingImages) => {
    return images
      .filter((image) => {
        if (imageAirlineFilter && image.airlineIata !== imageAirlineFilter && image.airlineIcao !== imageAirlineFilter) return false;
        if (imageAircraftFilter && image.aircraftType !== imageAircraftFilter) return false;
        if (!matchesImageSearch(image, imageSearchQuery)) return false;
        return true;
      })
      .sort((a, b) => {
        const airlineCompare = (a.airlineIata || "").localeCompare(b.airlineIata || "");
        if (airlineCompare !== 0) return airlineCompare;
        return (a.aircraftType || "").localeCompare(b.aircraftType || "");
      });
  };

  const clearImageFilters = () => {
    setImageSearchQuery("");
    setImageAirlineFilter("");
    setImageAircraftFilter("");
  };

  const filteredPendingImages = filterImages(pendingImages);
  const filteredApprovedImages = filterImages(approvedImages);

  useEffect(() => {
    const allUserIds = [...pendingImages, ...approvedImages].map((img) => img.uploadedBy);
    if (allUserIds.length > 0) {
      getUserInfoByIds(allUserIds)
        .then(setUserInfo)
        .catch((e) => console.error("Failed to fetch user info:", e));
    }
  }, [pendingImages, approvedImages]);

  async function handleApprove(id: string) {
    setActionLoading(id);
    const result = await approveAircraftImage(id);
    if (result.success) {
      setSelectedImages((prev) => { const next = new Set(prev); next.delete(id); return next; });
      toast.success("Image approved");
    } else {
      toast.error(result.error || "Failed to approve image");
    }
    setActionLoading(null);
  }

  function openRejectModal(ids: string[]) {
    setRejectTargetIds(ids);
    setRejectReason("");
    setRejectModalOpen(true);
  }

  async function handleRejectConfirm() {
    if (!rejectReason.trim()) { toast.error("Please provide a reason for rejection"); return; }
    setRejectModalOpen(false);

    if (rejectTargetIds.length === 1 && rejectTargetIds[0]) {
      const targetId = rejectTargetIds[0];
      setActionLoading(targetId);
      const result = await rejectAircraftImage(targetId, rejectReason);
      if (result.success) {
        setSelectedImages((prev) => { const next = new Set(prev); next.delete(targetId); return next; });
        toast.success("Image rejected");
      } else {
        toast.error(result.error || "Failed to reject image");
      }
      setActionLoading(null);
    } else if (rejectTargetIds.length > 1) {
      setBulkLoading(true);
      const result = await bulkRejectAircraftImages(rejectTargetIds, rejectReason);
      if (result.rejected > 0) {
        setSelectedImages(new Set());
        if (result.failed > 0) {
          toast.warning(`Rejected ${result.rejected} images, ${result.failed} failed`);
        } else {
          toast.success(`Rejected ${result.rejected} images`);
        }
      } else if (result.failed > 0) {
        toast.error(`Failed to reject ${result.failed} images`);
      }
      setBulkLoading(false);
    }
    setRejectTargetIds([]);
    setRejectReason("");
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this approved image?")) return;
    setActionLoading(id);
    const result = await deleteAircraftImage(id);
    if (result.success) {
      toast.success("Image deleted");
    } else {
      toast.error(result.error || "Failed to delete image");
    }
    setActionLoading(null);
  }

  function toggleSelect(id: string) {
    setSelectedImages((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function selectAllVisible() {
    setSelectedImages(new Set(filteredPendingImages.map((img) => img.id)));
  }

  function clearSelection() {
    setSelectedImages(new Set());
  }

  async function handleBulkApprove() {
    const ids = Array.from(selectedImages);
    if (ids.length === 0) return;
    setBulkLoading(true);
    const result = await bulkApproveAircraftImages(ids);
    if (result.approved > 0) {
      setSelectedImages(new Set());
      if (result.failed > 0) {
        toast.warning(`Approved ${result.approved} images, ${result.failed} failed`);
      } else {
        toast.success(`Approved ${result.approved} images`);
      }
    } else if (result.failed > 0) {
      toast.error(`Failed to approve ${result.failed} images`);
    }
    setBulkLoading(false);
  }

  function handleBulkReject() {
    const ids = Array.from(selectedImages);
    if (ids.length === 0) return;
    openRejectModal(ids);
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

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={imageSearchQuery}
            onChange={(e) => setImageSearchQuery(e.target.value)}
            placeholder="Search by airline, aircraft type, discord username..."
            className="w-full rounded-lg border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-500/50"
          />
        </div>
        <div className="flex gap-3">
          <select value={imageAirlineFilter} onChange={(e) => setImageAirlineFilter(e.target.value)} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/50">
            <option value="">All Airlines</option>
            {uniqueImageAirlines.map((airline) => (
              <option key={airline.iata || airline.icao} value={airline.iata || airline.icao}>
                {airline.icao && airline.iata ? `${airline.icao} | ${airline.iata}` : airline.icao || airline.iata}
              </option>
            ))}
          </select>
          <select value={imageAircraftFilter} onChange={(e) => setImageAircraftFilter(e.target.value)} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/50">
            <option value="">All Aircraft</option>
            {uniqueImageAircraftTypes.map((type) => (<option key={type} value={type}>{type}</option>))}
          </select>
          {hasActiveImageFilters && (
            <button onClick={clearImageFilters} className="cursor-pointer rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-slate-400 transition-all hover:border-red-500/30 hover:text-red-400">Clear</button>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedImages.size > 0 && imageSubTab === "pending" && (
        <div className="mb-4 flex items-center gap-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
          <span className="font-mono text-sm text-cyan-400">{selectedImages.size} selected</span>
          <div className="flex-1" />
          <button onClick={clearSelection} className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-white/10">Clear</button>
          <button onClick={handleBulkApprove} disabled={bulkLoading} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-500/20 px-4 py-1.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50">
            <Check className="h-4 w-4" />Approve All
          </button>
          <button onClick={handleBulkReject} disabled={bulkLoading} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-red-500/20 px-4 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-50">
            <X className="h-4 w-4" />Reject All
          </button>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="mb-6 flex items-center gap-2">
        <button
          onClick={() => setImageSubTab("pending")}
          className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 font-mono text-sm transition-all ${
            imageSubTab === "pending" ? "bg-yellow-500/20 text-yellow-400" : "bg-white/5 text-slate-400 hover:bg-white/10"
          }`}
        >
          <Clock className="h-4 w-4" />
          Pending ({filteredPendingImages.length}{hasActiveImageFilters && filteredPendingImages.length !== pendingImages.length ? `/${pendingImages.length}` : ""})
        </button>
        <button
          onClick={() => setImageSubTab("approved")}
          className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 font-mono text-sm transition-all ${
            imageSubTab === "approved" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-slate-400 hover:bg-white/10"
          }`}
        >
          <CheckCircle className="h-4 w-4" />
          Approved ({filteredApprovedImages.length}{hasActiveImageFilters && filteredApprovedImages.length !== approvedImages.length ? `/${approvedImages.length}` : ""})
        </button>

        {imageSubTab === "pending" && filteredPendingImages.length > 0 && (
          <button
            onClick={selectedImages.size === filteredPendingImages.length ? clearSelection : selectAllVisible}
            className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-white/10"
          >
            {selectedImages.size === filteredPendingImages.length ? (<><CheckSquare className="h-4 w-4" />Deselect All</>) : (<><Square className="h-4 w-4" />Select All</>)}
          </button>
        )}
      </div>

      {/* Pending Images */}
      {imageSubTab === "pending" && (
        <>
          {filteredPendingImages.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
              <Clock className="mx-auto mb-4 h-12 w-12 text-slate-600" />
              <h3 className="mb-2 text-xl font-semibold text-white">{hasActiveImageFilters ? "No Matching Images" : "No Pending Images"}</h3>
              <p className="text-slate-400">{hasActiveImageFilters ? "Try adjusting your search or filters" : "All submissions have been reviewed"}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPendingImages.map((image) => (
                <div key={image.id} className={`group overflow-hidden rounded-2xl border bg-black/40 backdrop-blur-xl transition-all ${selectedImages.has(image.id) ? "border-cyan-500" : "border-yellow-500/30"}`}>
                  <div className="relative aspect-video">
                    <Image src={image.imageUrl} alt={`${image.airlineIata || image.airlineIcao} ${image.aircraftType}`} fill className="object-cover" />
                    <div className="absolute top-2 left-2 rounded-md bg-yellow-500/80 px-2 py-1 text-xs font-bold text-black">PENDING</div>
                    <button onClick={() => toggleSelect(image.id)} className={`absolute top-2 right-2 cursor-pointer rounded-lg p-1.5 transition-all ${selectedImages.has(image.id) ? "bg-cyan-500 text-white" : "bg-black/60 text-white opacity-0 group-hover:opacity-100"}`}>
                      {selectedImages.has(image.id) ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="mb-3 flex items-center gap-2 flex-wrap">
                      <EditableCodes
                        imageId={image.id}
                        initialIata={image.airlineIata || ""}
                        initialIcao={image.airlineIcao || ""}
                      />
                      <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-sm text-white">{image.aircraftType}</span>
                    </div>
                    {image.discordUsername && <p className="mb-2 text-xs text-slate-500">Discord: {image.discordUsername}</p>}
                    <p className="mb-1 text-xs text-slate-500">Uploaded by <span className="text-cyan-400">{userInfo[image.uploadedBy]?.email ?? image.uploadedBy}</span></p>
                    <p className="mb-3 text-xs text-slate-600">{new Date(image.createdAt).toLocaleDateString()}</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(image.id)} disabled={actionLoading === image.id} className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-emerald-500/20 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50">
                        <Check className="h-4 w-4" />Approve
                      </button>
                      <button onClick={() => openRejectModal([image.id])} disabled={actionLoading === image.id} className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-red-500/20 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-50">
                        <X className="h-4 w-4" />Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Approved Images */}
      {imageSubTab === "approved" && (
        <>
          {filteredApprovedImages.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
              <Plane className="mx-auto mb-4 h-12 w-12 text-slate-600" />
              <h3 className="mb-2 text-xl font-semibold text-white">{hasActiveImageFilters ? "No Matching Images" : "No Approved Images"}</h3>
              <p className="text-slate-400">{hasActiveImageFilters ? "Try adjusting your search or filters" : "Approve some pending images to see them here"}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredApprovedImages.map((image) => (
                <div key={image.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl transition-all hover:border-cyan-500/30">
                  <div className="relative aspect-video">
                    <Image src={image.imageUrl} alt={`${image.airlineIata || image.airlineIcao} ${image.aircraftType}`} fill className="object-cover" />
                    <button onClick={() => handleDelete(image.id)} disabled={actionLoading === image.id} className="absolute top-2 right-2 cursor-pointer rounded-lg bg-red-500/80 p-2 opacity-0 transition-all hover:bg-red-500 group-hover:opacity-100 disabled:opacity-50">
                      <Trash2 className="h-4 w-4 text-white" />
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <EditableCodes
                        imageId={image.id}
                        initialIata={image.airlineIata || ""}
                        initialIcao={image.airlineIcao || ""}
                      />
                      <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-sm text-white">{image.aircraftType}</span>
                      <CheckCircle className="ml-auto h-4 w-4 text-emerald-400" />
                    </div>
                    {image.discordUsername && <p className="mt-2 text-xs text-slate-500">Discord: {image.discordUsername}</p>}
                    <p className="mt-1 text-xs text-slate-500">Uploaded by <span className="text-cyan-400">{userInfo[image.uploadedBy]?.email ?? image.uploadedBy}</span></p>
                    {image.approvedAt && <p className="mt-1 text-xs text-slate-600">Approved {new Date(image.approvedAt).toLocaleDateString()}</p>}
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
