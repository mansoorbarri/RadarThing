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
  updateAircraftImageCodes,
  checkApprovalConflict,
  resolveImageConflict,
  type AircraftImage,
} from "~/app/actions/aircraft-images";
import {
  Trash2,
  Check,
  X,
  Plane,
  Clock,
  CheckCircle,
  Search,
  CheckSquare,
  Square,
  Pencil,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { RejectModal } from "./RejectModal";
import { ConflictModal } from "./ConflictModal";
import { ConfirmModal } from "./ConfirmModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";

type ImageSubTab = "pending" | "approved";
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

interface ImageType {
  airlineIata: string;
  airlineIcao: string;
  aircraftType: string;
  discordUsername?: string | null;
  isMilitary?: boolean;
  uploadedBy?: string;
}

function getUploaderDisplay(
  image: ImageType,
  usersByClerkId?: Map<
    string,
    { _id: string; discordUsername?: string | null }
  >,
) {
  const uploader = image.uploadedBy
    ? usersByClerkId?.get(image.uploadedBy)
    : undefined;
  return (
    image.discordUsername ??
    uploader?.discordUsername ??
    uploader?._id ??
    image.uploadedBy
  );
}

function matchesImageSearch(
  image: ImageType,
  query: string,
  usersByClerkId?: Map<
    string,
    { _id: string; discordUsername?: string | null }
  >,
) {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  const uploader = image.uploadedBy
    ? usersByClerkId?.get(image.uploadedBy)
    : undefined;
  const uploaderDisplay = getUploaderDisplay(image, usersByClerkId);
  return (
    image.airlineIata?.toLowerCase().includes(q) ||
    image.airlineIcao?.toLowerCase().includes(q) ||
    image.aircraftType?.toLowerCase().includes(q) ||
    image.discordUsername?.toLowerCase().includes(q) ||
    uploader?.discordUsername?.toLowerCase().includes(q) ||
    uploader?._id.toLowerCase().includes(q) ||
    uploaderDisplay?.toLowerCase().includes(q) ||
    image.uploadedBy?.toLowerCase().includes(q)
  );
}

function EditableCodes({
  imageId,
  initialIata,
  initialIcao,
  initialAircraftType,
  isMilitary,
  onSaveSuccess,
}: {
  imageId: string;
  initialIata: string;
  initialIcao: string;
  initialAircraftType: string;
  isMilitary?: boolean;
  onSaveSuccess?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const effectiveIsMilitary = isMilitary || initialIata === "MIL";
  const [iata, setIata] = useState(initialIata);
  const [icao, setIcao] = useState(initialIcao);
  const [aircraftType, setAircraftType] = useState(initialAircraftType);
  const [draftIsMilitary, setDraftIsMilitary] = useState(effectiveIsMilitary);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setIata(initialIata);
      setIcao(initialIcao);
      setAircraftType(initialAircraftType);
      setDraftIsMilitary(effectiveIsMilitary);
    }
  }, [
    initialIata,
    initialIcao,
    initialAircraftType,
    effectiveIsMilitary,
    isEditing,
  ]);

  const handleSave = async () => {
    if (
      iata === initialIata &&
      icao === initialIcao &&
      aircraftType === initialAircraftType &&
      draftIsMilitary === effectiveIsMilitary
    ) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    const result = await updateAircraftImageCodes(
      imageId,
      iata,
      icao,
      aircraftType,
      draftIsMilitary,
    );
    setIsSaving(false);
    if (result.success) {
      toast.success("Details updated");
      setIsEditing(false);
      onSaveSuccess?.();
    } else {
      toast.error(result.error || "Failed to update details");
    }
  };

  const handleCancel = () => {
    setIata(initialIata);
    setIcao(initialIcao);
    setAircraftType(initialAircraftType);
    setDraftIsMilitary(effectiveIsMilitary);
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
      <div className="flex flex-wrap items-center gap-2">
        <label className="mr-1 flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-1">
          <span
            className={`text-xs font-medium ${draftIsMilitary ? "text-amber-300" : "text-slate-300"}`}
          >
            Military
          </span>
          <Switch
            checked={draftIsMilitary}
            onCheckedChange={setDraftIsMilitary}
            disabled={isSaving}
          />
        </label>
        {!draftIsMilitary && (
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
        )}
        <input
          type="text"
          value={icao}
          onChange={(e) => setIcao(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder={draftIsMilitary ? "AF Name" : "ICAO"}
          maxLength={draftIsMilitary ? 10 : 4}
          className={`rounded-md border bg-black/60 px-2 py-1 font-mono text-sm outline-none ${draftIsMilitary ? "w-20 border-amber-500/50 text-amber-400 focus:border-amber-400" : "w-16 border-blue-500/50 text-blue-400 focus:border-blue-400"}`}
          disabled={isSaving}
          autoFocus={draftIsMilitary}
        />
        <input
          type="text"
          value={aircraftType}
          onChange={(e) => setAircraftType(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="Aircraft"
          className="w-24 rounded-md border border-white/20 bg-black/60 px-2 py-1 font-mono text-sm text-white outline-none focus:border-white/40"
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
    <div className="group/codes flex flex-wrap items-center gap-2">
      {effectiveIsMilitary ? (
        <span className="rounded-md bg-amber-500/20 px-2 py-1 font-mono text-sm font-bold text-amber-400">
          {initialIcao}
        </span>
      ) : (
        <>
          {initialIata && (
            <span className="rounded-md bg-cyan-500/20 px-2 py-1 font-mono text-sm font-bold text-cyan-400">
              {initialIata}
            </span>
          )}
          {initialIcao && (
            <span className="rounded-md bg-blue-500/20 px-2 py-1 font-mono text-sm font-bold text-blue-400">
              {initialIcao}
            </span>
          )}
        </>
      )}
      {initialAircraftType && (
        <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-sm text-white">
          {initialAircraftType}
        </span>
      )}
      {effectiveIsMilitary && (
        <span className="rounded-md bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-300">
          MIL
        </span>
      )}
      <button
        onClick={() => setIsEditing(true)}
        className="cursor-pointer rounded-md p-1 text-slate-600 opacity-0 transition-all group-hover/codes:opacity-100 hover:bg-white/10 hover:text-cyan-400"
        title="Edit details"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function AircraftImagesTab() {
  const pendingQuery = useQuery(api.aircraftImages.getPending);
  const approvedQuery = useQuery(api.aircraftImages.getApproved);
  const allUsersQuery = useQuery(api.users.getAllForProManagement);
  const pendingImages = useMemo(() => pendingQuery ?? [], [pendingQuery]);
  const approvedImages = useMemo(() => approvedQuery ?? [], [approvedQuery]);
  const [imageSubTab, setImageSubTab] = useState<ImageSubTab>("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [imageSearchQuery, setImageSearchQuery] = useState("");
  const [imageAirlineFilter, setImageAirlineFilter] = useState<string>("");
  const [imageAircraftFilter, setImageAircraftFilter] = useState<string>("");
  const [imageUploaderFilter, setImageUploaderFilter] = useState<string>("");
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTargetIds, setRejectTargetIds] = useState<string[]>([]);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictPendingImage, setConflictPendingImage] =
    useState<AircraftImage | null>(null);
  const [conflictExistingImage, setConflictExistingImage] =
    useState<AircraftImage | null>(null);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetInfo, setDeleteTargetInfo] = useState<{
    iata: string;
    icao: string;
    aircraft: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteTargetIds, setBulkDeleteTargetIds] = useState<string[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  const allImages = useMemo(
    () => [...pendingImages, ...approvedImages],
    [pendingImages, approvedImages],
  );
  const usersByClerkId = useMemo(
    () =>
      new Map(
        (allUsersQuery ?? []).map((user) => [
          user.clerkId,
          {
            _id: String(user._id),
            discordUsername: user.discordUsername ?? null,
          },
        ]),
      ),
    [allUsersQuery],
  );

  const uniqueImageAirlines = useMemo(() => {
    const airlinesMap = new Map<string, { iata: string; icao: string }>();
    allImages.forEach((img) => {
      const key = img.airlineIata || img.airlineIcao;
      if (!key) return;
      if (!matchesImageSearch(img, imageSearchQuery, usersByClerkId)) return;
      if (imageAircraftFilter && img.aircraftType !== imageAircraftFilter)
        return;
      if (!airlinesMap.has(key)) {
        airlinesMap.set(key, {
          iata: img.airlineIata || "",
          icao: img.airlineIcao || "",
        });
      }
    });
    return Array.from(airlinesMap.values()).sort((a, b) =>
      (a.icao || a.iata).localeCompare(b.icao || b.iata),
    );
  }, [allImages, imageSearchQuery, imageAircraftFilter, usersByClerkId]);

  const uniqueImageAircraftTypes = useMemo(() => {
    const types = new Set<string>();
    allImages.forEach((img) => {
      if (!img.aircraftType) return;
      if (!matchesImageSearch(img, imageSearchQuery, usersByClerkId)) return;
      if (
        imageAirlineFilter &&
        img.airlineIata !== imageAirlineFilter &&
        img.airlineIcao !== imageAirlineFilter
      )
        return;
      if (
        imageUploaderFilter &&
        getUploaderDisplay(img, usersByClerkId) !== imageUploaderFilter
      )
        return;
      types.add(img.aircraftType);
    });
    return Array.from(types).sort();
  }, [
    allImages,
    imageSearchQuery,
    imageAirlineFilter,
    imageUploaderFilter,
    usersByClerkId,
  ]);

  const uniqueImageUploaders = useMemo(() => {
    const uploaders = new Set<string>();
    allImages.forEach((img) => {
      const uploader = getUploaderDisplay(img, usersByClerkId);
      if (!uploader) return;
      if (!matchesImageSearch(img, imageSearchQuery, usersByClerkId)) return;
      if (
        imageAirlineFilter &&
        img.airlineIata !== imageAirlineFilter &&
        img.airlineIcao !== imageAirlineFilter
      )
        return;
      if (imageAircraftFilter && img.aircraftType !== imageAircraftFilter)
        return;

      const hasDiscordUsername =
        Boolean(img.discordUsername) ||
        Boolean(usersByClerkId.get(img.uploadedBy ?? "")?.discordUsername);
      if (!hasDiscordUsername) return;

      uploaders.add(uploader);
    });
    return Array.from(uploaders).sort((a, b) => a.localeCompare(b));
  }, [
    allImages,
    imageSearchQuery,
    imageAirlineFilter,
    imageAircraftFilter,
    usersByClerkId,
  ]);

  useEffect(() => {
    if (
      imageAirlineFilter &&
      !uniqueImageAirlines.some(
        (a) => a.iata === imageAirlineFilter || a.icao === imageAirlineFilter,
      )
    ) {
      setImageAirlineFilter("");
    }
  }, [uniqueImageAirlines, imageAirlineFilter]);

  useEffect(() => {
    if (
      imageAircraftFilter &&
      !uniqueImageAircraftTypes.includes(imageAircraftFilter)
    ) {
      setImageAircraftFilter("");
    }
  }, [uniqueImageAircraftTypes, imageAircraftFilter]);

  useEffect(() => {
    if (
      imageUploaderFilter &&
      !uniqueImageUploaders.includes(imageUploaderFilter)
    ) {
      setImageUploaderFilter("");
    }
  }, [uniqueImageUploaders, imageUploaderFilter]);

  const hasActiveImageFilters =
    imageSearchQuery ||
    imageAirlineFilter ||
    imageAircraftFilter ||
    imageUploaderFilter;

  const filterImages = (images: typeof pendingImages) => {
    return images
      .filter((image) => {
        if (
          imageAirlineFilter &&
          image.airlineIata !== imageAirlineFilter &&
          image.airlineIcao !== imageAirlineFilter
        )
          return false;
        if (imageAircraftFilter && image.aircraftType !== imageAircraftFilter)
          return false;
        if (
          imageUploaderFilter &&
          getUploaderDisplay(image, usersByClerkId) !== imageUploaderFilter
        )
          return false;
        if (!matchesImageSearch(image, imageSearchQuery, usersByClerkId))
          return false;
        return true;
      })
      .sort((a, b) => {
        const airlineCompare = (a.airlineIata || "").localeCompare(
          b.airlineIata || "",
        );
        if (airlineCompare !== 0) return airlineCompare;
        return (a.aircraftType || "").localeCompare(b.aircraftType || "");
      });
  };

  const clearImageFilters = () => {
    setImageSearchQuery("");
    setImageAirlineFilter("");
    setImageAircraftFilter("");
    setImageUploaderFilter("");
  };

  const filteredPendingImages = filterImages(pendingImages);
  const filteredApprovedImages = filterImages(approvedImages);
  const currentTabImages =
    imageSubTab === "pending" ? filteredPendingImages : filteredApprovedImages;
  const totalPages = Math.max(1, Math.ceil(currentTabImages.length / pageSize));
  const paginatedCurrentTabImages = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return currentTabImages.slice(start, start + pageSize);
  }, [currentPage, currentTabImages, pageSize]);
  const currentPageSelectionCount = paginatedCurrentTabImages.filter((image) =>
    selectedImages.has(image.id),
  ).length;
  const pageStart =
    currentTabImages.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, currentTabImages.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    imageSubTab,
    imageSearchQuery,
    imageAirlineFilter,
    imageAircraftFilter,
    imageUploaderFilter,
    pageSize,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  async function handleApprove(id: string) {
    setActionLoading(id);
    const result = await approveAircraftImage(id);
    if (result.success) {
      setSelectedImages((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("Image approved");
    } else if (result.hasConflict) {
      // Conflict detected - fetch full details and show modal
      const conflictCheck = await checkApprovalConflict(id);
      if (
        conflictCheck.hasConflict &&
        conflictCheck.pendingImage &&
        conflictCheck.existingImage
      ) {
        setConflictPendingImage(conflictCheck.pendingImage);
        setConflictExistingImage(conflictCheck.existingImage);
        setConflictModalOpen(true);
      } else {
        toast.error(conflictCheck.error || "Failed to load conflict details");
      }
    } else {
      toast.error(result.error || "Failed to approve image");
    }
    setActionLoading(null);
  }

  async function handleConflictKeepPending() {
    if (!conflictPendingImage || !conflictExistingImage) return;
    setConflictLoading(true);
    const result = await resolveImageConflict(
      conflictPendingImage.id,
      conflictExistingImage.id,
    );
    if (result.success) {
      toast.success("New image approved, existing image removed");
      setSelectedImages((prev) => {
        const next = new Set(prev);
        next.delete(conflictPendingImage.id);
        return next;
      });
    } else {
      toast.error(result.error || "Failed to resolve conflict");
    }
    setConflictLoading(false);
    setConflictModalOpen(false);
    setConflictPendingImage(null);
    setConflictExistingImage(null);
  }

  async function handleConflictKeepExisting() {
    if (!conflictPendingImage || !conflictExistingImage) return;
    setConflictLoading(true);
    const result = await resolveImageConflict(
      conflictExistingImage.id,
      conflictPendingImage.id,
    );
    if (result.success) {
      toast.success("Existing image kept, pending image rejected");
      setSelectedImages((prev) => {
        const next = new Set(prev);
        next.delete(conflictPendingImage.id);
        return next;
      });
    } else {
      toast.error(result.error || "Failed to resolve conflict");
    }
    setConflictLoading(false);
    setConflictModalOpen(false);
    setConflictPendingImage(null);
    setConflictExistingImage(null);
  }

  function handleConflictCancel() {
    setConflictModalOpen(false);
    setConflictPendingImage(null);
    setConflictExistingImage(null);
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
      const result = await rejectAircraftImage(targetId, rejectReason);
      if (result.success) {
        setSelectedImages((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
        toast.success("Image rejected");
      } else {
        toast.error(result.error || "Failed to reject image");
      }
      setActionLoading(null);
    } else if (rejectTargetIds.length > 1) {
      setBulkLoading(true);
      const result = await bulkRejectAircraftImages(
        rejectTargetIds,
        rejectReason,
      );
      if (result.rejected > 0) {
        setSelectedImages(new Set());
        if (result.failed > 0) {
          toast.warning(
            `Rejected ${result.rejected} images, ${result.failed} failed`,
          );
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

  function openDeleteModal(
    id: string,
    iata: string,
    icao: string,
    aircraft: string,
  ) {
    setDeleteTargetId(id);
    setDeleteTargetInfo({ iata, icao, aircraft });
    setDeleteModalOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!deleteTargetId) return;
    setDeleteLoading(true);
    const result = await deleteAircraftImage(deleteTargetId);
    if (result.success) {
      toast.success("Image deleted");
    } else {
      toast.error(result.error || "Failed to delete image");
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
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      paginatedCurrentTabImages.forEach((img) => next.add(img.id));
      return next;
    });
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
        toast.warning(
          `Approved ${result.approved} images, ${result.failed} failed`,
        );
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

  function handleBulkDelete() {
    const ids = Array.from(selectedImages);
    if (ids.length === 0) return;
    setBulkDeleteTargetIds(ids);
    setBulkDeleteModalOpen(true);
  }

  async function handleBulkDeleteConfirm() {
    if (bulkDeleteTargetIds.length === 0) return;
    setBulkDeleteLoading(true);
    let deleted = 0;
    let failed = 0;
    for (const id of bulkDeleteTargetIds) {
      const result = await deleteAircraftImage(id);
      if (result.success) {
        deleted++;
      } else {
        failed++;
      }
    }
    if (deleted > 0) {
      setSelectedImages(new Set());
      if (failed > 0) {
        toast.warning(`Deleted ${deleted} images, ${failed} failed`);
      } else {
        toast.success(`Deleted ${deleted} images`);
      }
    } else if (failed > 0) {
      toast.error(`Failed to delete ${failed} images`);
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

      <ConflictModal
        isOpen={conflictModalOpen}
        pendingImage={conflictPendingImage}
        existingImage={conflictExistingImage}
        isLoading={conflictLoading}
        onKeepPending={handleConflictKeepPending}
        onKeepExisting={handleConflictKeepExisting}
        onCancel={handleConflictCancel}
      />

      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Approved Image"
        message={
          deleteTargetInfo
            ? `Are you sure you want to delete the approved image for ${deleteTargetInfo.iata}/${deleteTargetInfo.icao} ${deleteTargetInfo.aircraft}? This action cannot be undone.`
            : "Are you sure you want to delete this approved image?"
        }
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      <ConfirmModal
        isOpen={bulkDeleteModalOpen}
        title="Delete Approved Images"
        message={`Are you sure you want to delete ${bulkDeleteTargetIds.length} approved image(s)? This action cannot be undone.`}
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
      <div className="mb-6 flex flex-col gap-4">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={imageSearchQuery}
            onChange={(e) => setImageSearchQuery(e.target.value)}
            placeholder="Search by airline, aircraft, Discord username, Convex ID..."
            className="w-full rounded-lg border border-white/10 bg-black/40 py-2.5 pr-4 pl-10 text-sm text-white placeholder-slate-500 transition-all outline-none focus:border-cyan-500/50"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Select
            value={imageAirlineFilter || "__all_airlines__"}
            onValueChange={(value) =>
              setImageAirlineFilter(
                value === "__all_airlines__" ? "" : value,
              )
            }
          >
            <SelectTrigger className="h-11 w-full min-w-0 rounded-lg border-white/10 bg-black/40 font-mono text-sm text-white shadow-none hover:bg-white/[0.06] focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/20">
              <SelectValue placeholder="All Airlines" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#0b1118] text-white">
              <SelectItem value="__all_airlines__" className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200">
                All Airlines
              </SelectItem>
              {uniqueImageAirlines.map((airline) => (
                <SelectItem
                  key={airline.iata || airline.icao}
                  value={airline.iata || airline.icao}
                  className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                >
                  {airline.icao && airline.iata
                    ? `${airline.icao} | ${airline.iata}`
                    : airline.icao || airline.iata}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={imageAircraftFilter || "__all_aircraft__"}
            onValueChange={(value) =>
              setImageAircraftFilter(
                value === "__all_aircraft__" ? "" : value,
              )
            }
          >
            <SelectTrigger className="h-11 w-full min-w-0 rounded-lg border-white/10 bg-black/40 font-mono text-sm text-white shadow-none hover:bg-white/[0.06] focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/20">
              <SelectValue placeholder="All Aircraft" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#0b1118] text-white">
              <SelectItem value="__all_aircraft__" className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200">
                All Aircraft
              </SelectItem>
              {uniqueImageAircraftTypes.map((type) => (
                <SelectItem
                  key={type}
                  value={type}
                  className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                >
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={imageUploaderFilter || "__all_uploaders__"}
            onValueChange={(value) =>
              setImageUploaderFilter(
                value === "__all_uploaders__" ? "" : value,
              )
            }
          >
            <SelectTrigger className="h-11 w-full min-w-0 rounded-lg border-white/10 bg-black/40 font-mono text-sm text-white shadow-none hover:bg-white/[0.06] focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/20">
              <SelectValue placeholder="All Uploaders" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#0b1118] text-white">
              <SelectItem value="__all_uploaders__" className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200">
                All Uploaders
              </SelectItem>
              {uniqueImageUploaders.map((uploader) => (
                <SelectItem
                  key={uploader}
                  value={uploader}
                  className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                >
                  {uploader}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveImageFilters && (
            <button
              onClick={clearImageFilters}
              className="cursor-pointer rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-slate-400 transition-all hover:border-red-500/30 hover:text-red-400"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          {currentTabImages.length === 0
            ? "No images to display"
            : `Showing ${pageStart}-${pageEnd} of ${currentTabImages.length} ${imageSubTab} images`}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) =>
              setPageSize(Number(value) as (typeof PAGE_SIZE_OPTIONS)[number])
            }
          >
            <SelectTrigger className="h-10 min-w-[84px] rounded-lg border-white/10 bg-black/40 font-mono text-sm text-white shadow-none hover:bg-white/[0.06] focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#0b1118] text-white">
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem
                  key={option}
                  value={String(option)}
                  className="font-mono text-sm text-white focus:bg-cyan-500/10 focus:text-cyan-200"
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedImages.size > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 sm:flex-row sm:items-center">
          <span className="font-mono text-sm text-cyan-400">
            {selectedImages.size} selected
          </span>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              onClick={clearSelection}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-white/10"
            >
              Clear
            </button>
            {imageSubTab === "pending" ? (
              <>
                <button
                  onClick={handleBulkApprove}
                  disabled={bulkLoading}
                  className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Approve All
                </button>
                <button
                  onClick={handleBulkReject}
                  disabled={bulkLoading}
                  className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  Reject All
                </button>
              </>
            ) : (
              <button
                onClick={handleBulkDelete}
                disabled={bulkLoading}
                className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete All
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setImageSubTab("pending")}
          className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 font-mono text-sm transition-all ${
            imageSubTab === "pending"
              ? "bg-yellow-500/20 text-yellow-400"
              : "bg-white/5 text-slate-400 hover:bg-white/10"
          }`}
        >
          <Clock className="h-4 w-4" />
          Pending ({filteredPendingImages.length}
          {hasActiveImageFilters &&
          filteredPendingImages.length !== pendingImages.length
            ? `/${pendingImages.length}`
            : ""}
          )
        </button>
        <button
          onClick={() => setImageSubTab("approved")}
          className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 font-mono text-sm transition-all ${
            imageSubTab === "approved"
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-white/5 text-slate-400 hover:bg-white/10"
          }`}
        >
          <CheckCircle className="h-4 w-4" />
          Approved ({filteredApprovedImages.length}
          {hasActiveImageFilters &&
          filteredApprovedImages.length !== approvedImages.length
            ? `/${approvedImages.length}`
            : ""}
          )
        </button>

        {((imageSubTab === "pending" && filteredPendingImages.length > 0) ||
          (imageSubTab === "approved" &&
            filteredApprovedImages.length > 0)) && (
          <button
            onClick={() => {
              const currentImages = paginatedCurrentTabImages;
              const allVisibleSelected =
                currentImages.length > 0 &&
                currentImages.every((image) => selectedImages.has(image.id));
              if (allVisibleSelected) {
                setSelectedImages((prev) => {
                  const next = new Set(prev);
                  currentImages.forEach((image) => next.delete(image.id));
                  return next;
                });
              } else {
                selectAllVisible();
              }
            }}
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-white/10 sm:ml-auto sm:w-auto sm:justify-start"
          >
            {currentPageSelectionCount === paginatedCurrentTabImages.length &&
            paginatedCurrentTabImages.length > 0 ? (
              <>
                <CheckSquare className="h-4 w-4" />
                Deselect Page
              </>
            ) : (
              <>
                <Square className="h-4 w-4" />
                Select Page
              </>
            )}
          </button>
        )}
      </div>

      {/* Pending Images */}
      {imageSubTab === "pending" && (
        <>
          {filteredPendingImages.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
              <Clock className="mx-auto mb-4 h-12 w-12 text-slate-600" />
              <h3 className="mb-2 text-xl font-semibold text-white">
                {hasActiveImageFilters
                  ? "No Matching Images"
                  : "No Pending Images"}
              </h3>
              <p className="text-slate-400">
                {hasActiveImageFilters
                  ? "Try adjusting your search or filters"
                  : "All submissions have been reviewed"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedCurrentTabImages.map((image) => (
                <div
                  key={image.id}
                  className={`group overflow-hidden rounded-2xl border bg-black/40 backdrop-blur-xl transition-all ${selectedImages.has(image.id) ? "border-cyan-500" : "border-yellow-500/30"}`}
                >
                  <div className="relative aspect-video">
                    <Image
                      src={image.imageUrl}
                      alt={`${image.airlineIata || image.airlineIcao} ${image.aircraftType}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    <div className="absolute top-2 left-2 flex gap-1">
                      <span className="rounded-md bg-yellow-500/80 px-2 py-1 text-xs font-bold text-black">
                        PENDING
                      </span>
                      {image.isMilitary && (
                        <span className="rounded-md bg-amber-600/80 px-2 py-1 text-xs font-bold text-white">
                          MIL
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => toggleSelect(image.id)}
                      className={`absolute top-2 right-2 cursor-pointer rounded-lg p-1.5 transition-all ${selectedImages.has(image.id) ? "bg-cyan-500 text-white" : "bg-black/60 text-white opacity-0 group-hover:opacity-100"}`}
                    >
                      {selectedImages.has(image.id) ? (
                        <CheckSquare className="h-5 w-5" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <EditableCodes
                        imageId={image.id}
                        initialIata={image.airlineIata || ""}
                        initialIcao={image.airlineIcao || ""}
                        initialAircraftType={image.aircraftType || ""}
                        isMilitary={image.isMilitary}
                      />
                    </div>
                    <p className="mb-1 text-xs text-slate-500">
                      Uploaded by{" "}
                      <span className="text-cyan-400">
                        {getUploaderDisplay(image, usersByClerkId)}
                      </span>
                    </p>
                    <p className="mb-3 text-xs text-slate-600">
                      {new Date(image.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(image.id)}
                        disabled={actionLoading === image.id}
                        className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-emerald-500/20 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => openRejectModal([image.id])}
                        disabled={actionLoading === image.id}
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

      {/* Approved Images */}
      {imageSubTab === "approved" && (
        <>
          {filteredApprovedImages.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
              <Plane className="mx-auto mb-4 h-12 w-12 text-slate-600" />
              <h3 className="mb-2 text-xl font-semibold text-white">
                {hasActiveImageFilters
                  ? "No Matching Images"
                  : "No Approved Images"}
              </h3>
              <p className="text-slate-400">
                {hasActiveImageFilters
                  ? "Try adjusting your search or filters"
                  : "Approve some pending images to see them here"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedCurrentTabImages.map((image) => (
                <div
                  key={image.id}
                  className={`group overflow-hidden rounded-2xl border bg-black/40 backdrop-blur-xl transition-all ${
                    selectedImages.has(image.id)
                      ? "border-cyan-500"
                      : "border-white/10 hover:border-cyan-500/30"
                  }`}
                >
                  <div className="relative aspect-video">
                    <Image
                      src={image.imageUrl}
                      alt={`${image.airlineIata || image.airlineIcao} ${image.aircraftType}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    <button
                      onClick={() => toggleSelect(image.id)}
                      className={`absolute top-2 left-2 cursor-pointer rounded-lg p-1.5 transition-all ${
                        selectedImages.has(image.id)
                          ? "bg-cyan-500 text-white"
                          : "bg-black/60 text-white opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {selectedImages.has(image.id) ? (
                        <CheckSquare className="h-5 w-5" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() =>
                        openDeleteModal(
                          image.id,
                          image.airlineIata || "",
                          image.airlineIcao || "",
                          image.aircraftType,
                        )
                      }
                      className="absolute top-2 right-2 cursor-pointer rounded-lg bg-red-500/80 p-2 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500"
                    >
                      <Trash2 className="h-4 w-4 text-white" />
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <EditableCodes
                        imageId={image.id}
                        initialIata={image.airlineIata || ""}
                        initialIcao={image.airlineIcao || ""}
                        initialAircraftType={image.aircraftType || ""}
                        isMilitary={image.isMilitary}
                      />
                      <CheckCircle className="ml-auto h-4 w-4 text-emerald-400" />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Uploaded by{" "}
                      <span className="text-cyan-400">
                        {getUploaderDisplay(image, usersByClerkId)}
                      </span>
                    </p>
                    {image.approvedAt && (
                      <p className="mt-1 text-xs text-slate-600">
                        Approved{" "}
                        {new Date(image.approvedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {currentTabImages.length > 0 && totalPages > 1 && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white transition-all hover:border-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              disabled={currentPage === totalPages}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white transition-all hover:border-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
