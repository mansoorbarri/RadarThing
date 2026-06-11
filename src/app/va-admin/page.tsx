"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2,
  Trash2,
  Upload,
  CheckCircle2,
  Plane,
  Search,
  UserPlus,
  Users,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  addVirtualAirlineMember,
  createVirtualAirlineAircraftImage,
  deleteVirtualAirlineAircraftImage,
  removeVirtualAirlineMember,
  updateManagedVirtualAirline,
} from "~/app/actions/virtual-airlines";
import {
  ImageUploader,
  type ImageUploaderRef,
} from "~/components/ui/image-uploader";

type SubmitStage = "idle" | "uploading" | "submitting" | "success";
type Tab = "settings" | "upload" | "pilots" | "fleet";

interface SettingsFormState {
  name: string;
  callsignPrefix: string;
  website: string;
}

function getDisplayHandle(user: {
  _id: string;
  discordUsername?: string | null;
}) {
  return user.discordUsername ?? truncateConvexId(user._id);
}

function getUserIdentifier(user: { _id: string }) {
  return String(user._id);
}

function truncateConvexId(id: string) {
  if (id.length <= 18) return id;
  return `${id.slice(0, 15)}...`;
}

function VaAdminHeader() {
  return (
    <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center px-6 py-5">
        <Link href="/radar" className="inline-flex">
          <Image
            src="/logo-white.svg"
            alt="RadarThing"
            width={100}
            height={30}
          />
        </Link>
      </div>
    </header>
  );
}

export default function VirtualAirlineAdminPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const managedVirtualAirlines = useQuery(
    api.virtualAirlines.getManagedByAdmin,
    user?.id && isAuthenticated ? { adminClerkId: user.id } : "skip",
  );

  const [selectedVaId, setSelectedVaId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tab>("pilots");
  const [settingsForm, setSettingsForm] = useState<SettingsFormState>({
    name: "",
    callsignPrefix: "",
    website: "",
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [aircraftType, setAircraftType] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [submitStage, setSubmitStage] = useState<SubmitStage>("idle");
  const [hasSelectedFile, setHasSelectedFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const uploadedDataRef = useRef<{ url: string; key: string } | null>(null);
  const uploaderRef = useRef<ImageUploaderRef>(null);
  const allUsers = useQuery(
    api.users.getAssignablePilots,
    isAuthenticated ? {} : "skip",
  );

  const virtualAirlines = useMemo(
    () => managedVirtualAirlines ?? [],
    [managedVirtualAirlines],
  );

  useEffect(() => {
    if (!selectedVaId && virtualAirlines.length > 0) {
      setSelectedVaId(virtualAirlines[0]!.id);
    }
  }, [selectedVaId, virtualAirlines]);

  useEffect(() => {
    if (
      selectedVaId &&
      virtualAirlines.length > 0 &&
      !virtualAirlines.some(
        (virtualAirline) => virtualAirline.id === selectedVaId,
      )
    ) {
      setSelectedVaId(virtualAirlines[0]!.id);
    }
  }, [selectedVaId, virtualAirlines]);

  const selectedVirtualAirline = useMemo(
    () => virtualAirlines.find((va) => va.id === selectedVaId) ?? null,
    [selectedVaId, virtualAirlines],
  );

  useEffect(() => {
    setSettingsForm({
      name: selectedVirtualAirline?.name ?? "",
      callsignPrefix: selectedVirtualAirline?.callsignPrefix ?? "",
      website: selectedVirtualAirline?.website ?? "",
    });
  }, [
    selectedVirtualAirline?.id,
    selectedVirtualAirline?.name,
    selectedVirtualAirline?.callsignPrefix,
    selectedVirtualAirline?.website,
  ]);

  const vaImages = useQuery(
    api.virtualAirlineAircraftImages.getByVirtualAirlineId,
    selectedVaId && isAuthenticated
      ? { virtualAirlineId: selectedVaId as Id<"virtualAirlines"> }
      : "skip",
  );
  const vaMembers = useQuery(
    api.virtualAirlineMembers.getByVirtualAirlineId,
    selectedVaId && isAuthenticated
      ? { virtualAirlineId: selectedVaId as Id<"virtualAirlines"> }
      : "skip",
  );
  const users = useMemo(() => allUsers ?? [], [allUsers]);
  const members = useMemo(() => vaMembers ?? [], [vaMembers]);
  const images = useMemo(() => vaImages ?? [], [vaImages]);
  const assignableUsers = useMemo(() => {
    if (!selectedVaId) return [];

    const query = memberSearch.trim().toLowerCase();
    const existingUserIds = new Set(members.map((member) => member.userId));

    return users
      .filter((candidate) => {
        if (existingUserIds.has(candidate._id)) return false;
        if (!query) return true;

        return (
          String(candidate._id).toLowerCase().includes(query) ||
          candidate.discordUsername?.toLowerCase().includes(query)
        );
      })
      .slice(0, 8);
  }, [memberSearch, members, selectedVaId, users]);

  const isProcessing = submitStage !== "idle" && submitStage !== "success";

  const resetUploadForm = () => {
    setAircraftType("");
    setSubmitStage("idle");
    setError(null);
    setHasSelectedFile(false);
    setMemberSearch("");
    uploadedDataRef.current = null;
    uploaderRef.current?.reset();
  };

  const handleUploadComplete = (url: string, key: string) => {
    uploadedDataRef.current = { url, key };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedVirtualAirline) {
      toast.error("Select a VA first");
      return;
    }

    if (!selectedVirtualAirline.isActive) {
      toast.error("This VA is currently disabled");
      return;
    }

    if (!aircraftType.trim()) {
      toast.error("Aircraft type is required");
      return;
    }

    if (!hasSelectedFile) {
      toast.error("Please select an image first");
      return;
    }

    setError(null);
    uploadedDataRef.current = null;

    setSubmitStage("uploading");
    const uploadSuccess = await uploaderRef.current?.triggerUpload();

    if (!uploadSuccess || !uploadedDataRef.current) {
      setError("Failed to upload image");
      setSubmitStage("idle");
      return;
    }

    setSubmitStage("submitting");

    const uploadedData = uploadedDataRef.current as {
      url: string;
      key: string;
    } | null;
    if (!uploadedData) {
      setError("Failed to upload image");
      setSubmitStage("idle");
      return;
    }

    const result = await createVirtualAirlineAircraftImage({
      virtualAirlineId: selectedVirtualAirline.id,
      aircraftType,
      imageUrl: uploadedData.url,
      imageKey: uploadedData.key,
    });

    if (!result.success) {
      setError(result.error || "Failed to save VA aircraft image");
      toast.error(result.error || "Failed to save VA aircraft image");
      setSubmitStage("idle");
      return;
    }

    setSubmitStage("success");
    toast.success("VA aircraft image saved");

    setTimeout(() => {
      resetUploadForm();
    }, 900);
  };

  const handleDelete = async (image: (typeof images)[number]) => {
    setDeletingId(image.id);
    const result = await deleteVirtualAirlineAircraftImage({
      id: image.id,
      virtualAirlineId: image.virtualAirlineId,
    });
    setDeletingId(null);

    if (!result.success) {
      toast.error(result.error || "Failed to delete image");
      return;
    }

    toast.success("VA aircraft image deleted");
  };

  const handleAddMember = async (userId: string) => {
    if (!selectedVirtualAirline) return;

    setMemberActionId(userId);
    const result = await addVirtualAirlineMember({
      virtualAirlineId: selectedVirtualAirline.id,
      userId,
    });
    setMemberActionId(null);

    if (!result.success) {
      toast.error(result.error || "Failed to add pilot");
      return;
    }

    setMemberSearch("");
    toast.success("Pilot added to VA");
  };

  const handleRemoveMember = async (member: (typeof members)[number]) => {
    setMemberActionId(member.id);
    const result = await removeVirtualAirlineMember({
      id: member.id,
      virtualAirlineId: member.virtualAirlineId,
    });
    setMemberActionId(null);

    if (!result.success) {
      toast.error(result.error || "Failed to remove pilot");
      return;
    }

    toast.success("Pilot removed from VA");
  };

  const handleSaveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedVirtualAirline) return;

    setIsSavingSettings(true);
    const result = await updateManagedVirtualAirline({
      id: selectedVirtualAirline.id,
      name: settingsForm.name,
      callsignPrefix: settingsForm.callsignPrefix,
      website: settingsForm.website,
    });
    setIsSavingSettings(false);

    if (!result.success) {
      toast.error(result.error || "Failed to update VA settings");
      return;
    }

    setSettingsForm({
      name: result.virtualAirline?.name ?? settingsForm.name,
      callsignPrefix:
        result.virtualAirline?.callsignPrefix ?? settingsForm.callsignPrefix,
      website: result.virtualAirline?.website ?? "",
    });
    toast.success("VA settings updated");
  };

  if (
    !isLoaded ||
    isConvexAuthLoading ||
    (isSignedIn &&
      (managedVirtualAirlines === undefined ||
        allUsers === undefined ||
        (selectedVaId && vaMembers === undefined)))
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-black text-white">
        <VaAdminHeader />
        <div className="flex items-center justify-center px-6 py-20">
          <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <h1 className="text-2xl font-semibold">VA Admin Access</h1>
            <p className="mt-3 text-sm text-slate-400">
              Sign in with the RadarThing account assigned to your virtual
              airline.
            </p>
            <div className="mt-6">
              <SignInButton mode="modal">
                <button className="cursor-pointer rounded-xl bg-cyan-500 px-5 py-3 font-medium text-black">
                  Sign In
                </button>
              </SignInButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (virtualAirlines.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white">
        <VaAdminHeader />
        <div className="flex items-center justify-center px-6 py-20">
          <div className="max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8">
            <h1 className="text-2xl font-semibold">No VA Assigned</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              This account is not assigned as a virtual airline admin. A
              RadarThing admin needs to register your VA first and pick your
              account as the owner.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tabItems: {
    key: Tab;
    label: string;
    count?: number;
    icon: React.ReactNode;
  }[] = [
    { key: "settings", label: "Settings", icon: <Plane className="h-4 w-4" /> },
    {
      key: "pilots",
      label: "Pilots",
      count: members.length,
      icon: <Users className="h-4 w-4" />,
    },
    {
      key: "fleet",
      label: "Fleet",
      count: images.length,
      icon: <ImageIcon className="h-4 w-4" />,
    },
    { key: "upload", label: "Upload", icon: <Upload className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <VaAdminHeader />

      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5">
              <Plane className="h-3.5 w-3.5 text-cyan-400" />
              <span className="font-mono text-xs text-cyan-400">VA ADMIN</span>
            </div>
            <h1 className="text-2xl font-bold text-white">
              {selectedVirtualAirline?.name ?? "Virtual Airline"}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Prefix:{" "}
              <span className="font-mono text-cyan-300">
                {selectedVirtualAirline?.callsignPrefix}
              </span>
              {!selectedVirtualAirline?.isActive && (
                <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-400 uppercase">
                  Disabled
                </span>
              )}
            </p>
          </div>
        </div>

        {/* VA switcher (only when managing multiple VAs) */}
        {virtualAirlines.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {virtualAirlines.map((va) => (
              <button
                key={va.id}
                type="button"
                onClick={() => {
                  setSelectedVaId(va.id);
                  resetUploadForm();
                }}
                className={`cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  va.id === selectedVaId
                    ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <span className="mr-1.5 font-mono text-xs">
                  {va.callsignPrefix}
                </span>
                {va.name}
                {!va.isActive && (
                  <span className="ml-1.5 text-[10px] text-slate-500">
                    (disabled)
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
              Pilots
            </div>
            <div className="mt-1 text-xl font-semibold text-white">
              {members.length}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
              Fleet Images
            </div>
            <div className="mt-1 text-xl font-semibold text-white">
              {images.length}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
              Prefix
            </div>
            <div className="mt-1 font-mono text-xl font-semibold text-cyan-300">
              {selectedVirtualAirline?.callsignPrefix}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
              Status
            </div>
            <div className="mt-1">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  selectedVirtualAirline?.isActive
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-white/10 text-slate-400"
                }`}
              >
                {selectedVirtualAirline?.isActive ? "Active" : "Disabled"}
              </span>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="mb-6 flex gap-1 border-b border-white/10">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-cyan-300"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                    activeTab === tab.key
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "bg-white/10 text-slate-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {activeTab === tab.key && (
                <span className="absolute right-2 bottom-0 left-2 h-px bg-cyan-400" />
              )}
            </button>
          ))}
        </div>

        {/* ── Settings tab ── */}
        {activeTab === "settings" && (
          <div className="mx-auto max-w-2xl">
            <form
              onSubmit={handleSaveSettings}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <h2 className="text-lg font-semibold text-white">VA Settings</h2>
              <p className="mt-1 text-sm text-slate-400">
                Update the public details for this virtual airline.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block font-mono text-xs text-slate-400">
                    VA NAME
                  </label>
                  <input
                    type="text"
                    value={settingsForm.name}
                    onChange={(event) =>
                      setSettingsForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Example Virtual"
                    disabled={isSavingSettings}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 transition-colors outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-mono text-xs text-slate-400">
                    CALLSIGN PREFIX
                  </label>
                  <input
                    type="text"
                    value={settingsForm.callsignPrefix}
                    onChange={(event) =>
                      setSettingsForm((current) => ({
                        ...current,
                        callsignPrefix: event.target.value
                          .toUpperCase()
                          .replace(/\s+/g, ""),
                      }))
                    }
                    placeholder="RVA"
                    maxLength={8}
                    disabled={isSavingSettings}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-white placeholder-slate-500 transition-colors outline-none focus:border-cyan-500/50"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Flights starting with this prefix get VA status.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block font-mono text-xs text-slate-400">
                    WEBSITE / DISCORD
                  </label>
                  <input
                    type="url"
                    value={settingsForm.website}
                    onChange={(event) =>
                      setSettingsForm((current) => ({
                        ...current,
                        website: event.target.value,
                      }))
                    }
                    placeholder="https://example.com or discord.gg/your-va"
                    disabled={isSavingSettings}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 transition-colors outline-none focus:border-cyan-500/50"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Used for the VA link in the radar sidebar.
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-sm font-medium text-white">
                    Admin-controlled settings
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Ownership, VA activation, and deletion still require a
                    RadarThing admin in <code>/admin</code>.
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSavingSettings ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Save Settings
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Upload tab ── */}
        {activeTab === "upload" && (
          <div className="mx-auto max-w-lg">
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <h2 className="text-lg font-semibold text-white">
                Upload Fleet Image
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Upload a livery image for an aircraft type. Uploading the same
                type again replaces the existing image.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block font-mono text-xs text-slate-400">
                    AIRCRAFT TYPE
                  </label>
                  <input
                    type="text"
                    value={aircraftType}
                    onChange={(event) =>
                      setAircraftType(event.target.value.toUpperCase())
                    }
                    placeholder="B737"
                    maxLength={12}
                    disabled={isProcessing}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-white placeholder-slate-500 transition-colors outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-mono text-xs text-slate-400">
                    SELECT IMAGE
                  </label>
                  <ImageUploader
                    ref={uploaderRef}
                    fileNameBase={
                      selectedVirtualAirline && aircraftType.trim()
                        ? `${selectedVirtualAirline.callsignPrefix}-${aircraftType.trim().toUpperCase()}`
                        : undefined
                    }
                    externalUploadTrigger={true}
                    onUploadComplete={handleUploadComplete}
                    onFileSelected={setHasSelectedFile}
                    onError={(nextError) => {
                      setError(nextError);
                      setSubmitStage("idle");
                    }}
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    isProcessing ||
                    !hasSelectedFile ||
                    !selectedVirtualAirline?.isActive
                  }
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitStage === "uploading" ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Uploading...
                    </>
                  ) : submitStage === "submitting" ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Saving...
                    </>
                  ) : submitStage === "success" ? (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      Upload VA Image
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Pilots tab ── */}
        {activeTab === "pilots" && (
          <div className="space-y-6">
            {/* Roster */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-slate-300">
                Current Roster
              </h3>
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">
                        {member.discordUsername ??
                          truncateConvexId(member.userId)}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        {member.userId}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={memberActionId === member.id}
                      onClick={() => handleRemoveMember(member)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {memberActionId === member.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Remove
                    </button>
                  </div>
                ))}

                {members.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">
                    No pilots assigned yet.
                  </div>
                )}
              </div>
            </div>

            {/* Add pilot */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-slate-300">
                Add Pilot
              </h3>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Search by Discord or Convex ID"
                  className="w-full rounded-lg border border-white/10 bg-black/40 py-3 pr-4 pl-10 text-sm text-white placeholder-slate-500 transition-colors outline-none focus:border-cyan-500/50"
                />
              </div>
              <div className="mt-2 space-y-1">
                {assignableUsers.map((candidate) => (
                  <button
                    key={candidate._id}
                    type="button"
                    disabled={memberActionId === candidate._id}
                    onClick={() => handleAddMember(candidate._id)}
                    className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-white">
                        {getDisplayHandle(candidate)}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        {getUserIdentifier(candidate)}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-1 text-[10px] font-semibold text-cyan-300 uppercase">
                      <UserPlus className="h-3 w-3" />
                      Add
                    </span>
                  </button>
                ))}

                {assignableUsers.length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-500">
                    No eligible pilots matched. Pilots need a linked Google ID
                    before you can add them to the VA.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Fleet tab ── */}
        {activeTab === "fleet" && (
          <div>
            {images.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
                  >
                    <div className="relative aspect-video overflow-hidden bg-black/40">
                      <Image
                        src={image.imageUrl}
                        alt={image.aircraftType}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 font-mono text-xs text-cyan-300">
                          {image.aircraftType}
                        </span>
                        <div className="mt-1.5 text-[11px] text-slate-500">
                          {new Date(image.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={deletingId === image.id}
                        onClick={() => handleDelete(image)}
                        className="cursor-pointer rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === image.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-slate-500">
                No fleet images uploaded yet. Use the Upload tab to add
                liveries.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
