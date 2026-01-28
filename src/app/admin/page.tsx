"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { isAdmin } from "~/app/actions/is-pro";
import {
  approveAircraftImage,
  rejectAircraftImage,
  deleteAircraftImage,
  bulkApproveAircraftImages,
  bulkRejectAircraftImages,
  getUserInfoByIds,
} from "~/app/actions/aircraft-images";
import { Trash2, Check, X, Plane, Clock, CheckCircle, Search, CheckSquare, Square, Bell, ImageIcon } from "lucide-react";
import Loading from "~/components/loading";
import Image from "next/image";
import { UserAuth } from "~/components/atc/userAuth";

type MainTab = "images" | "notifications";
type ImageSubTab = "pending" | "approved";

export default function AdminPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [adminCheckDone, setAdminCheckDone] = useState(false);

  // Main tab state
  const [mainTab, setMainTab] = useState<MainTab>("images");

  // Aircraft Images state
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

  // Missing Notifications state
  const notificationsQuery = useQuery(api.missingImageNotifications.getAll);
  const notifications = useMemo(() => notificationsQuery ?? [], [notificationsQuery]);
  const updateNoteMutation = useMutation(api.missingImageNotifications.updateNote);
  const removeNotificationMutation = useMutation(api.missingImageNotifications.remove);
  const [notifSearchQuery, setNotifSearchQuery] = useState("");
  const [notifAirlineFilter, setNotifAirlineFilter] = useState<string>("");
  const [notifAircraftFilter, setNotifAircraftFilter] = useState<string>("");

  const loading = !adminCheckDone || pendingQuery === undefined || approvedQuery === undefined || notificationsQuery === undefined;

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

  // ============ Aircraft Images Logic ============
  const matchesImageSearch = (image: (typeof pendingImages)[number], query: string) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      image.airlineIata?.toLowerCase().includes(q) ||
      image.airlineIcao?.toLowerCase().includes(q) ||
      image.aircraftType?.toLowerCase().includes(q) ||
      image.discordUsername?.toLowerCase().includes(q)
    );
  };

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
    if (!rejectReason.trim()) { alert("Please provide a reason for rejection"); return; }
    setRejectModalOpen(false);

    if (rejectTargetIds.length === 1 && rejectTargetIds[0]) {
      const targetId = rejectTargetIds[0];
      setActionLoading(targetId);
      const result = await rejectAircraftImage(targetId, rejectReason);
      if (result.success) {
        setSelectedImages((prev) => { const next = new Set(prev); next.delete(targetId); return next; });
      } else {
        alert(result.error || "Failed to reject image");
      }
      setActionLoading(null);
    } else if (rejectTargetIds.length > 1) {
      setBulkLoading(true);
      const result = await bulkRejectAircraftImages(rejectTargetIds, rejectReason);
      if (result.rejected > 0) setSelectedImages(new Set());
      if (result.failed > 0) alert(`Rejected ${result.rejected} images, ${result.failed} failed`);
      setBulkLoading(false);
    }
    setRejectTargetIds([]);
    setRejectReason("");
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this approved image?")) return;
    setActionLoading(id);
    const result = await deleteAircraftImage(id);
    if (!result.success) alert(result.error || "Failed to delete image");
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
    if (result.approved > 0) setSelectedImages(new Set());
    if (result.failed > 0) alert(`Approved ${result.approved} images, ${result.failed} failed`);
    setBulkLoading(false);
  }

  function handleBulkReject() {
    const ids = Array.from(selectedImages);
    if (ids.length === 0) return;
    openRejectModal(ids);
  }

  // ============ Missing Notifications Logic ============
  const matchesNotifSearch = (notification: (typeof notifications)[number], query: string) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return notification.airlineCode?.toLowerCase().includes(q) || notification.aircraftType?.toLowerCase().includes(q) || notification.note?.toLowerCase().includes(q);
  };

  const uniqueNotifAirlines = useMemo(() => {
    const airlines = new Set<string>();
    notifications.forEach((n) => {
      if (!matchesNotifSearch(n, notifSearchQuery)) return;
      if (notifAircraftFilter && n.aircraftType !== notifAircraftFilter) return;
      airlines.add(n.airlineCode);
    });
    return Array.from(airlines).sort();
  }, [notifications, notifSearchQuery, notifAircraftFilter]);

  const uniqueNotifAircraftTypes = useMemo(() => {
    const types = new Set<string>();
    notifications.forEach((n) => {
      if (!matchesNotifSearch(n, notifSearchQuery)) return;
      if (notifAirlineFilter && n.airlineCode !== notifAirlineFilter) return;
      types.add(n.aircraftType);
    });
    return Array.from(types).sort();
  }, [notifications, notifSearchQuery, notifAirlineFilter]);

  useEffect(() => {
    if (notifAirlineFilter && !uniqueNotifAirlines.includes(notifAirlineFilter)) setNotifAirlineFilter("");
  }, [uniqueNotifAirlines, notifAirlineFilter]);

  useEffect(() => {
    if (notifAircraftFilter && !uniqueNotifAircraftTypes.includes(notifAircraftFilter)) setNotifAircraftFilter("");
  }, [uniqueNotifAircraftTypes, notifAircraftFilter]);

  const hasActiveNotifFilters = notifSearchQuery || notifAirlineFilter || notifAircraftFilter;

  const filteredNotifications = useMemo(() => {
    return notifications
      .filter((n) => {
        if (notifAirlineFilter && n.airlineCode !== notifAirlineFilter) return false;
        if (notifAircraftFilter && n.aircraftType !== notifAircraftFilter) return false;
        if (!matchesNotifSearch(n, notifSearchQuery)) return false;
        return true;
      })
      .sort((a, b) => {
        const airlineCompare = a.airlineCode.localeCompare(b.airlineCode);
        if (airlineCompare !== 0) return airlineCompare;
        return a.aircraftType.localeCompare(b.aircraftType);
      });
  }, [notifications, notifAirlineFilter, notifAircraftFilter, notifSearchQuery]);

  const clearNotifFilters = () => {
    setNotifSearchQuery("");
    setNotifAirlineFilter("");
    setNotifAircraftFilter("");
  };

  const saveNote = async (airlineCode: string, aircraftType: string, note: string) => {
    await updateNoteMutation({ airlineCode, aircraftType, note });
  };

  const deleteNotification = async (airlineCode: string, aircraftType: string) => {
    if (!confirm(`Delete notification for ${airlineCode} ${aircraftType}?`)) return;
    await removeNotificationMutation({ airlineCode, aircraftType });
  };

  // ============ Render ============
  if (!isLoaded || loading) {
    return <Loading />;
  }

  if (!isSignedIn || !isAdminUser) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
            <button onClick={() => router.push("/")} className="cursor-pointer font-mono text-xl text-cyan-400">
              <Image src="/logo-white.svg" alt="RadarThing" width={100} height={30} />
            </button>
            <button onClick={() => router.push("/")} className="cursor-pointer text-sm text-slate-400 transition-colors hover:text-white">
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
          <p className="mb-8 text-xl text-slate-400">Only Admin users can access this panel</p>
          <button onClick={() => router.push("/")} className="cursor-pointer rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-8 py-4 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40">
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
            <p className="mb-4 text-sm text-slate-400">Please provide a reason for rejection. This will be sent to the uploader.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Image quality too low, wrong aircraft type, etc."
              className="mb-4 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-white placeholder-slate-500 outline-none focus:border-red-500/50"
              rows={3}
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setRejectModalOpen(false)} className="flex-1 cursor-pointer rounded-lg border border-white/10 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5">Cancel</button>
              <button onClick={handleRejectConfirm} disabled={!rejectReason.trim()} className="flex-1 cursor-pointer rounded-lg bg-red-500/20 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50">Reject</button>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <button onClick={() => router.push("/")} className="cursor-pointer font-mono text-xl text-cyan-400">
            <Image src="/logo-white.svg" alt="RadarThing" width={100} height={30} />
          </button>
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/aircraft-images")} className="cursor-pointer text-sm text-slate-400 transition-colors hover:text-white">Public Gallery</button>
            <button onClick={() => router.push("/")} className="cursor-pointer text-sm text-slate-400 transition-colors hover:text-white">Back to Map</button>
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
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
        </div>

        {/* Main Tabs */}
        <div className="mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
          <button
            onClick={() => setMainTab("images")}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
              mainTab === "images" ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            Aircraft Images
            {pendingImages.length > 0 && (
              <span className="ml-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">{pendingImages.length}</span>
            )}
          </button>
          <button
            onClick={() => setMainTab("notifications")}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
              mainTab === "notifications" ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <Bell className="h-4 w-4" />
            Missing Notifications
            <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-400">{notifications.length}</span>
          </button>
        </div>

        {/* Aircraft Images Tab */}
        {mainTab === "images" && (
          <>
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
                            {image.airlineIata && <span className="rounded-md bg-cyan-500/20 px-2 py-1 font-mono text-sm font-bold text-cyan-400">{image.airlineIata}</span>}
                            {image.airlineIcao && <span className="rounded-md bg-blue-500/20 px-2 py-1 font-mono text-sm font-bold text-blue-400">{image.airlineIcao}</span>}
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
                            {image.airlineIata && <span className="rounded-md bg-cyan-500/20 px-2 py-1 font-mono text-sm font-bold text-cyan-400">{image.airlineIata}</span>}
                            {image.airlineIcao && <span className="rounded-md bg-blue-500/20 px-2 py-1 font-mono text-sm font-bold text-blue-400">{image.airlineIcao}</span>}
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
        )}

        {/* Missing Notifications Tab */}
        {mainTab === "notifications" && (
          <>
            {/* Search and Filters */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={notifSearchQuery}
                  onChange={(e) => setNotifSearchQuery(e.target.value)}
                  placeholder="Search by airline code, aircraft type, or note..."
                  className="w-full rounded-lg border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-500/50"
                />
              </div>
              <div className="flex gap-3">
                <select value={notifAirlineFilter} onChange={(e) => setNotifAirlineFilter(e.target.value)} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/50">
                  <option value="">All Airlines</option>
                  {uniqueNotifAirlines.map((airline) => (<option key={airline} value={airline}>{airline}</option>))}
                </select>
                <select value={notifAircraftFilter} onChange={(e) => setNotifAircraftFilter(e.target.value)} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/50">
                  <option value="">All Aircraft</option>
                  {uniqueNotifAircraftTypes.map((type) => (<option key={type} value={type}>{type}</option>))}
                </select>
                {hasActiveNotifFilters && (
                  <button onClick={clearNotifFilters} className="cursor-pointer rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-slate-400 transition-all hover:border-red-500/30 hover:text-red-400">Clear</button>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="mb-6 flex items-center gap-4">
              <div className="rounded-lg border border-white/10 bg-black/40 px-4 py-2">
                <span className="font-mono text-sm text-slate-400">Total: <span className="text-white">{notifications.length}</span></span>
              </div>
              {hasActiveNotifFilters && filteredNotifications.length !== notifications.length && (
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
                  <span className="font-mono text-sm text-cyan-400">Showing: {filteredNotifications.length}</span>
                </div>
              )}
            </div>

            {/* Notifications Table */}
            {filteredNotifications.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
                <Bell className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                <h3 className="mb-2 text-xl font-semibold text-white">{hasActiveNotifFilters ? "No Matching Notifications" : "No Notifications"}</h3>
                <p className="text-slate-400">{hasActiveNotifFilters ? "Try adjusting your search or filters" : "No missing image notifications have been sent yet"}</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-6 py-4 text-left font-mono text-xs font-medium uppercase tracking-wider text-slate-400">Airline Code</th>
                      <th className="px-6 py-4 text-left font-mono text-xs font-medium uppercase tracking-wider text-slate-400">Aircraft Type</th>
                      <th className="px-6 py-4 text-left font-mono text-xs font-medium uppercase tracking-wider text-slate-400">Note</th>
                      <th className="w-16 px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredNotifications.map((notification) => (
                      <tr key={notification.id} className="group transition-colors hover:bg-white/5">
                        <td className="px-6 py-4"><span className="rounded-md bg-cyan-500/20 px-2 py-1 font-mono text-sm font-bold text-cyan-400">{notification.airlineCode}</span></td>
                        <td className="px-6 py-4"><span className="rounded-md bg-white/10 px-2 py-1 font-mono text-sm text-white">{notification.aircraftType}</span></td>
                        <td className="px-6 py-4">
                          <EditableNote
                            initialValue={notification.note || ""}
                            onSave={(note) => saveNote(notification.airlineCode, notification.aircraftType, note)}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => deleteNotification(notification.airlineCode, notification.aircraftType)}
                            className="cursor-pointer rounded-lg p-1.5 text-slate-600 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function EditableNote({ initialValue, onSave }: { initialValue: string; onSave: (note: string) => void }) {
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  const handleBlur = () => {
    setIsEditing(false);
    if (value !== initialValue) {
      onSave(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={() => setIsEditing(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="Add note..."
      className={`w-full rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none transition-all ${
        isEditing
          ? "border-cyan-500/50 text-white"
          : "border-transparent text-slate-300 hover:border-white/20"
      } ${!value && !isEditing ? "text-slate-600" : ""}`}
    />
  );
}
