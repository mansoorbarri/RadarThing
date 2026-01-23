"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { isAdmin } from "~/app/actions/is-pro";
import {
  approveAircraftImage,
  rejectAircraftImage,
  deleteAircraftImage,
  bulkApproveAircraftImages,
  bulkRejectAircraftImages,
  getUserInfoByIds,
} from "~/app/actions/aircraft-images";
import { Trash2, Check, X, Plane, Clock, CheckCircle, Search, CheckSquare, Square } from "lucide-react";
import Loading from "~/components/loading";
import Image from "next/image";
import { UserAuth } from "~/components/atc/userAuth";

export default function AdminAircraftImagesPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [adminCheckDone, setAdminCheckDone] = useState(false);

  // Real-time queries - auto-update when data changes in Convex
  const pendingQuery = useQuery(api.aircraftImages.getPending);
  const approvedQuery = useQuery(api.aircraftImages.getApproved);
  const pendingImages = useMemo(() => pendingQuery ?? [], [pendingQuery]);
  const approvedImages = useMemo(() => approvedQuery ?? [], [approvedQuery]);
  const loading = !adminCheckDone || pendingQuery === undefined || approvedQuery === undefined;

  const [userInfo, setUserInfo] = useState<Record<string, { email: string; name: string | null }>>({});
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [airlineFilter, setAirlineFilter] = useState<string>("");
  const [aircraftFilter, setAircraftFilter] = useState<string>("");
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTargetIds, setRejectTargetIds] = useState<string[]>([]);

  // Helper to check if image matches search query
  const matchesSearch = (image: (typeof pendingImages)[number], query: string) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      image.airlineIata?.toLowerCase().includes(q) ||
      image.airlineIcao?.toLowerCase().includes(q) ||
      image.aircraftType?.toLowerCase().includes(q) ||
      image.discordUsername?.toLowerCase().includes(q)
    );
  };

  // Get all images for filter options
  const allImages = useMemo(
    () => [...pendingImages, ...approvedImages],
    [pendingImages, approvedImages]
  );

  // Get unique airlines based on search and aircraft filter (dynamic)
  const uniqueAirlines = useMemo(() => {
    const airlinesMap = new Map<string, { iata: string; icao: string }>();
    allImages.forEach((img) => {
      const key = img.airlineIata || img.airlineIcao;
      if (!key) return;
      if (!matchesSearch(img, searchQuery)) return;
      if (aircraftFilter && img.aircraftType !== aircraftFilter) return;
      if (!airlinesMap.has(key)) {
        airlinesMap.set(key, {
          iata: img.airlineIata || "",
          icao: img.airlineIcao || "",
        });
      }
    });
    return Array.from(airlinesMap.values()).sort((a, b) =>
      (a.icao || a.iata).localeCompare(b.icao || b.iata)
    );
  }, [allImages, searchQuery, aircraftFilter]);

  // Get unique aircraft types based on search and airline filter (dynamic)
  const uniqueAircraftTypes = useMemo(() => {
    const types = new Set<string>();
    allImages.forEach((img) => {
      if (!img.aircraftType) return;
      if (!matchesSearch(img, searchQuery)) return;
      if (airlineFilter && img.airlineIata !== airlineFilter && img.airlineIcao !== airlineFilter) return;
      types.add(img.aircraftType);
    });
    return Array.from(types).sort();
  }, [allImages, searchQuery, airlineFilter]);

  // Clear filters if selected value is no longer available
  useEffect(() => {
    if (airlineFilter && !uniqueAirlines.some((a) => a.iata === airlineFilter || a.icao === airlineFilter)) {
      setAirlineFilter("");
    }
  }, [uniqueAirlines, airlineFilter]);

  useEffect(() => {
    if (aircraftFilter && !uniqueAircraftTypes.includes(aircraftFilter)) {
      setAircraftFilter("");
    }
  }, [uniqueAircraftTypes, aircraftFilter]);

  const hasActiveFilters = searchQuery || airlineFilter || aircraftFilter;

  const filterImages = (images: typeof pendingImages) => {
    return images
      .filter((image) => {
        // Apply airline filter
        if (airlineFilter && image.airlineIata !== airlineFilter && image.airlineIcao !== airlineFilter) {
          return false;
        }
        // Apply aircraft type filter
        if (aircraftFilter && image.aircraftType !== aircraftFilter) {
          return false;
        }
        // Apply search query
        if (!matchesSearch(image, searchQuery)) return false;
        return true;
      })
      .sort((a, b) => {
        // Sort by airline IATA, then by aircraft type
        const airlineCompare = (a.airlineIata || "").localeCompare(b.airlineIata || "");
        if (airlineCompare !== 0) return airlineCompare;
        return (a.aircraftType || "").localeCompare(b.aircraftType || "");
      });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setAirlineFilter("");
    setAircraftFilter("");
  };

  const filteredPendingImages = filterImages(pendingImages);
  const filteredApprovedImages = filterImages(approvedImages);

  // Check admin status
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      isAdmin()
        .then((admin) => {
          setIsAdminUser(admin);
          setAdminCheckDone(true);
        })
        .catch(() => setAdminCheckDone(true));
    } else if (isLoaded) {
      setAdminCheckDone(true);
    }
  }, [isLoaded, isSignedIn]);

  // Fetch user info when images change
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
      setSelectedImages((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      // No need to reload - Convex queries auto-update
    } else {
      alert(result.error || "Failed to approve image");
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
      alert("Please provide a reason for rejection");
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
        // No need to reload - Convex queries auto-update
      } else {
        alert(result.error || "Failed to reject image");
      }
      setActionLoading(null);
    } else if (rejectTargetIds.length > 1) {
      setBulkLoading(true);
      const result = await bulkRejectAircraftImages(rejectTargetIds, rejectReason);
      if (result.rejected > 0) {
        setSelectedImages(new Set());
        // No need to reload - Convex queries auto-update
      }
      if (result.failed > 0) {
        alert(`Rejected ${result.rejected} images, ${result.failed} failed`);
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
    if (!result.success) {
      alert(result.error || "Failed to delete image");
    }
    // No need to reload - Convex queries auto-update
    setActionLoading(null);
  }

  function toggleSelect(id: string) {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllVisible() {
    const visibleIds = filteredPendingImages.map((img) => img.id);
    setSelectedImages(new Set(visibleIds));
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
      // No need to reload - Convex queries auto-update
    }
    if (result.failed > 0) {
      alert(`Approved ${result.approved} images, ${result.failed} failed`);
    }
    setBulkLoading(false);
  }

  function handleBulkReject() {
    const ids = Array.from(selectedImages);
    if (ids.length === 0) return;
    openRejectModal(ids);
  }

  if (!isLoaded || loading) {
    return <Loading />;
  }

  if (!isSignedIn || !isAdminUser) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
            <button
              onClick={() => router.push("/")}
              className="cursor-pointer font-mono text-xl text-cyan-400"
            >
              <Image src="/logo-white.svg" alt="RadarThing" width={100} height={30} />
            </button>
            <button
              onClick={() => router.push("/")}
              className="cursor-pointer text-sm text-slate-400 transition-colors hover:text-white"
            >
              Back to Map
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-6 py-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2">
            <Plane className="h-4 w-4 text-red-400" />
            <span className="font-mono text-sm text-red-400">ACCESS DENIED</span>
          </div>

          <h1 className="mb-4 text-4xl font-bold text-white">Admin Access Required</h1>
          <p className="mb-8 text-xl text-slate-400">
            Only Admin users can approve aircraft images
          </p>

          <button
            onClick={() => router.push("/")}
            className="cursor-pointer rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-8 py-4 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40"
          >
            Back to Map
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Rejection Reason Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">
              Reject {rejectTargetIds.length} image{rejectTargetIds.length > 1 ? "s" : ""}
            </h3>
            <p className="mb-4 text-sm text-slate-400">
              Please provide a reason for rejection. This will be sent to the uploader.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Image quality too low, wrong aircraft type, etc."
              className="mb-4 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-white placeholder-slate-500 outline-none focus:border-red-500/50"
              rows={3}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="flex-1 cursor-pointer rounded-lg border border-white/10 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={!rejectReason.trim()}
                className="flex-1 cursor-pointer rounded-lg bg-red-500/20 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <button
            onClick={() => router.push("/")}
            className="cursor-pointer font-mono text-xl text-cyan-400"
          >
            <Image src="/logo-white.svg" alt="RadarThing" width={100} height={30} />
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/aircraft-images")}
              className="cursor-pointer text-sm text-slate-400 transition-colors hover:text-white"
            >
              Public Gallery
            </button>
            <button
              onClick={() => router.push("/")}
              className="cursor-pointer text-sm text-slate-400 transition-colors hover:text-white"
            >
              Back to Map
            </button>
            <UserAuth />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
            <Plane className="h-4 w-4 text-cyan-400" />
            <span className="font-mono text-sm text-cyan-400">ADMIN PANEL</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Manage Aircraft Images</h1>
          <p className="mt-2 text-slate-400">
            Review and approve community-submitted aircraft photos
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by airline, aircraft type, discord username..."
              className="w-full rounded-lg border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-500/50"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={airlineFilter}
              onChange={(e) => setAirlineFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/50"
            >
              <option value="">All Airlines</option>
              {uniqueAirlines.map((airline) => (
                <option key={airline.iata || airline.icao} value={airline.iata || airline.icao}>
                  {airline.icao && airline.iata ? `${airline.icao} | ${airline.iata}` : airline.icao || airline.iata}
                </option>
              ))}
            </select>
            <select
              value={aircraftFilter}
              onChange={(e) => setAircraftFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/50"
            >
              <option value="">All Aircraft</option>
              {uniqueAircraftTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
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
        {selectedImages.size > 0 && activeTab === "pending" && (
          <div className="mb-4 flex items-center gap-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
            <span className="font-mono text-sm text-cyan-400">
              {selectedImages.size} selected
            </span>
            <div className="flex-1" />
            <button
              onClick={clearSelection}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-white/10"
            >
              Clear
            </button>
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
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex items-center gap-2">
          <button
            onClick={() => setActiveTab("pending")}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 font-mono text-sm transition-all ${
              activeTab === "pending"
                ? "bg-yellow-500/20 text-yellow-400"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <Clock className="h-4 w-4" />
            Pending ({filteredPendingImages.length}{hasActiveFilters && filteredPendingImages.length !== pendingImages.length ? `/${pendingImages.length}` : ""})
          </button>
          <button
            onClick={() => setActiveTab("approved")}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 font-mono text-sm transition-all ${
              activeTab === "approved"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <CheckCircle className="h-4 w-4" />
            Approved ({filteredApprovedImages.length}{hasActiveFilters && filteredApprovedImages.length !== approvedImages.length ? `/${approvedImages.length}` : ""})
          </button>

          {activeTab === "pending" && filteredPendingImages.length > 0 && (
            <button
              onClick={selectedImages.size === filteredPendingImages.length ? clearSelection : selectAllVisible}
              className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-white/10"
            >
              {selectedImages.size === filteredPendingImages.length ? (
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

        {/* Pending Images */}
        {activeTab === "pending" && (
          <>
            {filteredPendingImages.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
                <Clock className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                <h3 className="mb-2 text-xl font-semibold text-white">
                  {hasActiveFilters ? "No Matching Images" : "No Pending Images"}
                </h3>
                <p className="text-slate-400">
                  {hasActiveFilters ? "Try adjusting your search or filters" : "All submissions have been reviewed"}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPendingImages.map((image) => (
                  <div
                    key={image.id}
                    className={`group overflow-hidden rounded-2xl border bg-black/40 backdrop-blur-xl transition-all ${
                      selectedImages.has(image.id)
                        ? "border-cyan-500"
                        : "border-yellow-500/30"
                    }`}
                  >
                    <div className="relative aspect-video">
                      <Image
                        src={image.imageUrl}
                        alt={`${image.airlineIata || image.airlineIcao} ${image.aircraftType}`}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute top-2 left-2 rounded-md bg-yellow-500/80 px-2 py-1 text-xs font-bold text-black">
                        PENDING
                      </div>
                      <button
                        onClick={() => toggleSelect(image.id)}
                        className={`absolute top-2 right-2 cursor-pointer rounded-lg p-1.5 transition-all ${
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
                    </div>
                    <div className="p-4">
                      <div className="mb-3 flex items-center gap-2 flex-wrap">
                        {image.airlineIata && (
                          <span className="rounded-md bg-cyan-500/20 px-2 py-1 font-mono text-sm font-bold text-cyan-400">
                            {image.airlineIata}
                          </span>
                        )}
                        {image.airlineIcao && (
                          <span className="rounded-md bg-blue-500/20 px-2 py-1 font-mono text-sm font-bold text-blue-400">
                            {image.airlineIcao}
                          </span>
                        )}
                        <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-sm text-white">
                          {image.aircraftType}
                        </span>
                      </div>
                      {image.discordUsername && (
                        <p className="mb-2 text-xs text-slate-500">
                          Discord: {image.discordUsername}
                        </p>
                      )}
                      <p className="mb-1 text-xs text-slate-500">
                        Uploaded by{" "}
                        <span className="text-cyan-400">
                          {userInfo[image.uploadedBy]?.email ?? image.uploadedBy}
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
        {activeTab === "approved" && (
          <>
            {filteredApprovedImages.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
                <Plane className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                <h3 className="mb-2 text-xl font-semibold text-white">
                  {hasActiveFilters ? "No Matching Images" : "No Approved Images"}
                </h3>
                <p className="text-slate-400">
                  {hasActiveFilters ? "Try adjusting your search or filters" : "Approve some pending images to see them here"}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredApprovedImages.map((image) => (
                  <div
                    key={image.id}
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl transition-all hover:border-cyan-500/30"
                  >
                    <div className="relative aspect-video">
                      <Image
                        src={image.imageUrl}
                        alt={`${image.airlineIata || image.airlineIcao} ${image.aircraftType}`}
                        fill
                        className="object-cover"
                      />
                      <button
                        onClick={() => handleDelete(image.id)}
                        disabled={actionLoading === image.id}
                        className="absolute top-2 right-2 cursor-pointer rounded-lg bg-red-500/80 p-2 opacity-0 transition-all hover:bg-red-500 group-hover:opacity-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4 text-white" />
                      </button>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {image.airlineIata && (
                          <span className="rounded-md bg-cyan-500/20 px-2 py-1 font-mono text-sm font-bold text-cyan-400">
                            {image.airlineIata}
                          </span>
                        )}
                        {image.airlineIcao && (
                          <span className="rounded-md bg-blue-500/20 px-2 py-1 font-mono text-sm font-bold text-blue-400">
                            {image.airlineIcao}
                          </span>
                        )}
                        <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-sm text-white">
                          {image.aircraftType}
                        </span>
                        <CheckCircle className="ml-auto h-4 w-4 text-emerald-400" />
                      </div>
                      {image.discordUsername && (
                        <p className="mt-2 text-xs text-slate-500">
                          Discord: {image.discordUsername}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-500">
                        Uploaded by{" "}
                        <span className="text-cyan-400">
                          {userInfo[image.uploadedBy]?.email ?? image.uploadedBy}
                        </span>
                      </p>
                      {image.approvedAt && (
                        <p className="mt-1 text-xs text-slate-600">
                          Approved {new Date(image.approvedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
