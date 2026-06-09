"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useQuery } from "convex/react";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Search,
  Users,
  Save,
  Plus,
  Plane,
  UserPlus,
  Trash2,
  X,
  Image as ImageIcon,
  Upload,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import {
  createVirtualAirline,
  updateVirtualAirline,
  deleteVirtualAirline,
  addVirtualAirlineMember,
  removeVirtualAirlineMember,
  createVirtualAirlineAircraftImage,
  deleteVirtualAirlineAircraftImage,
} from "~/app/actions/virtual-airlines";
import { Switch } from "~/components/ui/switch";
import {
  ImageUploader,
  type ImageUploaderRef,
} from "~/components/ui/image-uploader";
import { ConfirmModal } from "./ConfirmModal";

type ModalTab = "details" | "pilots" | "fleet";

interface FormState {
  id: string | null;
  name: string;
  callsignPrefix: string;
  adminClerkId: string;
  website: string;
  isActive: boolean;
}

const INITIAL_FORM: FormState = {
  id: null,
  name: "",
  callsignPrefix: "",
  adminClerkId: "",
  website: "",
  isActive: true,
};

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

export function VirtualAirlinesTab() {
  const allUsers = useQuery(api.users.getAll);
  const virtualAirlines = useQuery(api.virtualAirlines.getAll);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>("details");
  const [search, setSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const [fleetAircraftType, setFleetAircraftType] = useState("");
  const [fleetSubmitStage, setFleetSubmitStage] = useState<
    "idle" | "uploading" | "submitting" | "success"
  >("idle");
  const [hasFleetFile, setHasFleetFile] = useState(false);
  const [fleetError, setFleetError] = useState<string | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingVirtualAirline, setIsDeletingVirtualAirline] =
    useState(false);
  const fleetUploadedDataRef = useRef<{ url: string; key: string } | null>(null);
  const fleetUploaderRef = useRef<ImageUploaderRef>(null);

  const users = useMemo(() => allUsers ?? [], [allUsers]);
  const airlines = useMemo(() => virtualAirlines ?? [], [virtualAirlines]);
  const selectedMembers = useQuery(
    api.virtualAirlineMembers.getByVirtualAirlineId,
    form.id ? { virtualAirlineId: form.id as Id<"virtualAirlines"> } : "skip",
  );
  const selectedFleetImages = useQuery(
    api.virtualAirlineAircraftImages.getByVirtualAirlineId,
    form.id ? { virtualAirlineId: form.id as Id<"virtualAirlines"> } : "skip",
  );

  const selectedAdmin = useMemo(
    () => users.find((user) => user.clerkId === form.adminClerkId) ?? null,
    [form.adminClerkId, users],
  );
  const fleetImages = useMemo(() => selectedFleetImages ?? [], [selectedFleetImages]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users
      .filter((user) => {
        if (!query) return true;
        return (
          String(user._id).toLowerCase().includes(query) ||
          user.clerkId.toLowerCase().includes(query) ||
          user.discordUsername?.toLowerCase().includes(query)
        );
      })
      .slice(0, 8);
  }, [search, users]);

  const assignableUsers = useMemo(() => {
    if (!form.id) return [];

    const query = memberSearch.trim().toLowerCase();
    const existingUserIds = new Set(
      (selectedMembers ?? []).map((member) => member.userId),
    );

    return users
      .filter((user) => {
        if (!user.googleId) return false;
        if (existingUserIds.has(user._id)) return false;
        if (!query) return true;
        return (
          String(user._id).toLowerCase().includes(query) ||
          user.clerkId.toLowerCase().includes(query) ||
          user.discordUsername?.toLowerCase().includes(query)
        );
      })
      .slice(0, 8);
  }, [form.id, memberSearch, selectedMembers, users]);

  const resetModalState = () => {
    setForm(INITIAL_FORM);
    setSearch("");
    setMemberSearch("");
    setSubmitting(false);
    setMemberActionId(null);
    setModalTab("details");
    resetFleetForm();
  };

  const openCreateModal = () => {
    resetModalState();
    setIsModalOpen(true);
  };

  const openEditModal = (virtualAirline: (typeof airlines)[number]) => {
    setForm({
      id: virtualAirline.id,
      name: virtualAirline.name,
      callsignPrefix: virtualAirline.callsignPrefix,
      adminClerkId: virtualAirline.adminClerkId,
      website: virtualAirline.website ?? "",
      isActive: virtualAirline.isActive,
    });

    const adminUser =
      users.find((user) => user.clerkId === virtualAirline.adminClerkId) ?? null;
    setSearch(adminUser ? adminUser.discordUsername ?? getUserIdentifier(adminUser) : "");
    setMemberSearch("");
    setModalTab("details");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsDeleteModalOpen(false);
    resetModalState();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.adminClerkId) {
      toast.error("Select a RadarThing user to assign as VA admin");
      return;
    }

    setSubmitting(true);

    const result = form.id
      ? await updateVirtualAirline({
          id: form.id,
          name: form.name,
          callsignPrefix: form.callsignPrefix,
          adminClerkId: form.adminClerkId,
          website: form.website,
          isActive: form.isActive,
        })
      : await createVirtualAirline({
          name: form.name,
          callsignPrefix: form.callsignPrefix,
          adminClerkId: form.adminClerkId,
          website: form.website,
        });

    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error || "Failed to save VA");
      return;
    }

    toast.success(form.id ? "VA updated" : "VA created");

    if (result.virtualAirline) {
      setForm({
        id: result.virtualAirline.id,
        name: result.virtualAirline.name,
        callsignPrefix: result.virtualAirline.callsignPrefix,
        adminClerkId: result.virtualAirline.adminClerkId,
        website: result.virtualAirline.website ?? "",
        isActive: result.virtualAirline.isActive,
      });
      return;
    }

    closeModal();
  };

  const handleAddMember = async (userId: string) => {
    if (!form.id) return;

    setMemberActionId(userId);
    const result = await addVirtualAirlineMember({
      virtualAirlineId: form.id,
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

  const handleRemoveMember = async (member: NonNullable<typeof selectedMembers>[number]) => {
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

  const resetFleetForm = () => {
    setFleetAircraftType("");
    setFleetSubmitStage("idle");
    setFleetError(null);
    setHasFleetFile(false);
    fleetUploadedDataRef.current = null;
    fleetUploaderRef.current?.reset();
  };

  const handleFleetUploadComplete = (url: string, key: string) => {
    fleetUploadedDataRef.current = { url, key };
  };

  const handleFleetSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.id) return;

    if (!fleetAircraftType.trim()) {
      toast.error("Aircraft type is required");
      return;
    }
    if (!hasFleetFile) {
      toast.error("Please select an image first");
      return;
    }

    setFleetError(null);
    fleetUploadedDataRef.current = null;
    setFleetSubmitStage("uploading");

    const uploadSuccess = await fleetUploaderRef.current?.triggerUpload();
    if (!uploadSuccess || !fleetUploadedDataRef.current) {
      setFleetError("Failed to upload image");
      setFleetSubmitStage("idle");
      return;
    }

    setFleetSubmitStage("submitting");
    const uploadedData = fleetUploadedDataRef.current as { url: string; key: string } | null;
    if (!uploadedData) {
      setFleetError("Failed to upload image");
      setFleetSubmitStage("idle");
      return;
    }

    const result = await createVirtualAirlineAircraftImage({
      virtualAirlineId: form.id,
      aircraftType: fleetAircraftType,
      imageUrl: uploadedData.url,
      imageKey: uploadedData.key,
    });

    if (!result.success) {
      setFleetError(result.error || "Failed to save fleet image");
      toast.error(result.error || "Failed to save fleet image");
      setFleetSubmitStage("idle");
      return;
    }

    setFleetSubmitStage("success");
    toast.success("Fleet image saved");
    setTimeout(() => resetFleetForm(), 900);
  };

  const handleDeleteFleetImage = async (image: (typeof fleetImages)[number]) => {
    setDeletingImageId(image.id);
    const result = await deleteVirtualAirlineAircraftImage({
      id: image.id,
      virtualAirlineId: image.virtualAirlineId,
    });
    setDeletingImageId(null);

    if (!result.success) {
      toast.error(result.error || "Failed to delete image");
      return;
    }
    toast.success("Fleet image deleted");
  };

  const handleDeleteVirtualAirline = async () => {
    if (!form.id) return;

    setIsDeletingVirtualAirline(true);
    const result = await deleteVirtualAirline(form.id);
    setIsDeletingVirtualAirline(false);

    if (!result.success) {
      toast.error(result.error || "Failed to delete VA");
      return;
    }

    toast.success("VA deleted");
    closeModal();
  };

  if (allUsers === undefined || virtualAirlines === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  const pilotCount = (selectedMembers ?? []).length;
  const fleetCount = fleetImages.length;

  const tabs: { key: ModalTab; label: string; count?: number; icon: React.ReactNode }[] = [
    { key: "details", label: "Details", icon: <Plane className="h-3.5 w-3.5" /> },
    { key: "pilots", label: "Pilots", count: pilotCount, icon: <Users className="h-3.5 w-3.5" /> },
    { key: "fleet", label: "Fleet", count: fleetCount, icon: <ImageIcon className="h-3.5 w-3.5" /> },
  ];

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Virtual Airlines
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Manage VA ownership, pilots, and fleet uploads.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New VA
          </button>
        </div>

        {airlines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-slate-500">
            No VAs registered yet.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {airlines.map((virtualAirline) => {
              const adminUser =
                users.find((user) => user.clerkId === virtualAirline.adminClerkId) ??
                null;

              return (
                <button
                  key={virtualAirline.id}
                  type="button"
                  onClick={() => openEditModal(virtualAirline)}
                  className="group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="rounded-md bg-cyan-500/15 px-2 py-1 font-mono text-xs text-cyan-300">
                          {virtualAirline.callsignPrefix}
                        </span>
                        <h3 className="truncate text-base font-semibold text-white">
                          {virtualAirline.name}
                        </h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            virtualAirline.isActive
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-white/10 text-slate-400"
                          }`}
                        >
                          {virtualAirline.isActive ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <div className="mt-3 text-xs text-slate-400">
                        Admin:{" "}
                        <span className="text-slate-300">
                          {adminUser
                            ? getDisplayHandle(adminUser)
                            : virtualAirline.adminClerkId}
                        </span>
                      </div>
                    </div>
                    <span className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 transition-colors group-hover:border-cyan-500/20 group-hover:text-cyan-300">
                      Manage
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#060b11] shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {form.id ? form.name || "Edit VA" : "Create Virtual Airline"}
                </h2>
                {form.id && (
                  <p className="mt-1 text-sm text-slate-400">
                    Prefix:{" "}
                    <span className="font-mono text-cyan-300">
                      {form.callsignPrefix}
                    </span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="cursor-pointer rounded-full border border-white/10 bg-black/40 p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs (only when editing) */}
            {form.id && (
              <div className="flex gap-1 border-b border-white/10 px-6">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setModalTab(tab.key)}
                    className={`relative flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                      modalTab === tab.key
                        ? "text-cyan-300"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                    {tab.count !== undefined && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                          modalTab === tab.key
                            ? "bg-cyan-500/20 text-cyan-300"
                            : "bg-white/10 text-slate-400"
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                    {modalTab === tab.key && (
                      <span className="absolute bottom-0 left-2 right-2 h-px bg-cyan-400" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* ── Details tab ── */}
              {(modalTab === "details" || !form.id) && (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block font-mono text-xs text-slate-400">
                        VA NAME
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Example Virtual"
                        disabled={submitting}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 outline-none transition-colors focus:border-cyan-500/50"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block font-mono text-xs text-slate-400">
                        CALLSIGN PREFIX
                      </label>
                      <input
                        type="text"
                        value={form.callsignPrefix}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            callsignPrefix: event.target.value
                              .toUpperCase()
                              .replace(/\s+/g, ""),
                          }))
                        }
                        placeholder="RVA"
                        maxLength={8}
                        disabled={submitting}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-white placeholder-slate-500 outline-none transition-colors focus:border-cyan-500/50"
                      />
                      <p className="mt-1.5 text-xs text-slate-500">
                        Flights starting with this prefix get VA status.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block font-mono text-xs text-slate-400">
                      WEBSITE / DISCORD
                    </label>
                    <input
                      type="url"
                      value={form.website}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          website: event.target.value,
                        }))
                      }
                      placeholder="https://example.com or discord.gg/your-va"
                      disabled={submitting}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 outline-none transition-colors focus:border-cyan-500/50"
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      Used for the VA link in the radar sidebar.
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block font-mono text-xs text-slate-400">
                      VA ADMIN
                    </label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by Discord or Convex ID"
                        disabled={submitting}
                        className="w-full rounded-lg border border-white/10 bg-black/40 py-3 pr-4 pl-10 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-cyan-500/50"
                      />
                    </div>

                    {selectedAdmin && (
                      <div className="mt-3 flex items-center gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white">
                            {getDisplayHandle(selectedAdmin)}
                          </div>
                          <div className="mt-0.5 text-xs text-cyan-300/70">
                            {getUserIdentifier(selectedAdmin)}
                          </div>
                        </div>
                        <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-cyan-300">
                          Selected
                        </span>
                      </div>
                    )}

                    <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-1.5">
                      {filteredUsers.map((user) => {
                        const active = user.clerkId === form.adminClerkId;
                        return (
                          <button
                            key={user._id}
                            type="button"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                adminClerkId: user.clerkId,
                              }))
                            }
                            className={`flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
                              active
                                ? "bg-cyan-500/15 text-cyan-200"
                                : "hover:bg-white/5"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm text-white">
                                {getDisplayHandle(user)}
                              </div>
                              <div className="mt-0.5 truncate text-xs text-slate-500">
                                {getUserIdentifier(user)}
                              </div>
                            </div>
                          </button>
                        );
                      })}

                      {filteredUsers.length === 0 && (
                        <div className="px-3 py-2 text-sm text-slate-500">
                          No users matched that search.
                        </div>
                      )}
                    </div>
                  </div>

                  {form.id && (
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-white">
                          VA Active
                        </div>
                        <div className="text-xs text-slate-400">
                          Disable to stop prefix matching and VA fleet usage.
                        </div>
                      </div>
                      <Switch
                        checked={form.isActive}
                        onCheckedChange={(checked) =>
                          setForm((current) => ({
                            ...current,
                            isActive: checked,
                          }))
                        }
                        className="data-[state=checked]:bg-cyan-500 data-[state=unchecked]:bg-white/20"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-3 font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {form.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {form.id ? "Save Changes" : "Create VA"}
                  </button>

                  {form.id && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-medium text-red-300">
                            Delete Virtual Airline
                          </h3>
                          <p className="mt-1 text-xs text-slate-400">
                            This removes the VA, all assigned pilots, and every
                            fleet image for it.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsDeleteModalOpen(true)}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete VA
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              )}

              {/* ── Pilots tab ── */}
              {modalTab === "pilots" && form.id && (
                <div className="space-y-6">
                  {/* Current roster */}
                  <div>
                    <h3 className="mb-3 text-sm font-medium text-slate-300">
                      Current Roster
                    </h3>
                    <div className="space-y-2">
                      {(selectedMembers ?? []).map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm text-white">
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
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </button>
                        </div>
                      ))}

                      {selectedMembers?.length === 0 && (
                        <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
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
                        onChange={(event) =>
                          setMemberSearch(event.target.value)
                        }
                        placeholder="Search by Discord or Convex ID"
                        className="w-full rounded-lg border border-white/10 bg-black/40 py-3 pr-4 pl-10 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-cyan-500/50"
                      />
                    </div>
                    <div className="mt-2 space-y-1">
                      {assignableUsers.map((user) => (
                        <button
                          key={user._id}
                          type="button"
                          onClick={() => handleAddMember(user._id)}
                          disabled={memberActionId === user._id}
                          className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm text-white">
                              {getDisplayHandle(user)}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-slate-500">
                              {getUserIdentifier(user)}
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase text-cyan-300">
                            <UserPlus className="h-3 w-3" />
                            Add
                          </span>
                        </button>
                      ))}

                      {assignableUsers.length === 0 && (
                        <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-500">
                          No eligible pilots matched. Pilots need a linked
                          Google ID before they can be assigned.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Fleet tab ── */}
              {modalTab === "fleet" && form.id && (
                <div className="space-y-6">
                  {/* Upload form */}
                  <form
                    onSubmit={handleFleetSubmit}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <h3 className="mb-3 text-sm font-medium text-slate-300">
                      Upload Fleet Image
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
                      <div>
                        <label className="mb-1.5 block font-mono text-[10px] text-slate-500">
                          AIRCRAFT TYPE
                        </label>
                        <input
                          type="text"
                          value={fleetAircraftType}
                          onChange={(e) =>
                            setFleetAircraftType(e.target.value.toUpperCase())
                          }
                          placeholder="B737"
                          maxLength={12}
                          disabled={
                            fleetSubmitStage === "uploading" ||
                            fleetSubmitStage === "submitting"
                          }
                          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-cyan-500/50"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block font-mono text-[10px] text-slate-500">
                          IMAGE
                        </label>
                        <ImageUploader
                          ref={fleetUploaderRef}
                          fileNameBase={
                            form.callsignPrefix && fleetAircraftType.trim()
                              ? `${form.callsignPrefix}-${fleetAircraftType.trim().toUpperCase()}`
                              : undefined
                          }
                          externalUploadTrigger={true}
                          onUploadComplete={handleFleetUploadComplete}
                          onFileSelected={setHasFleetFile}
                          onError={(err) => {
                            setFleetError(err);
                            setFleetSubmitStage("idle");
                          }}
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="submit"
                          disabled={
                            fleetSubmitStage === "uploading" ||
                            fleetSubmitStage === "submitting" ||
                            !hasFleetFile
                          }
                          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {fleetSubmitStage === "uploading" || fleetSubmitStage === "submitting" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : fleetSubmitStage === "success" ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          {fleetSubmitStage === "success" ? "Saved" : "Upload"}
                        </button>
                      </div>
                    </div>
                    {fleetError && (
                      <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                        {fleetError}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-slate-500">
                      Uploading the same aircraft type replaces the existing image.
                    </p>
                  </form>

                  {/* Images grid */}
                  {fleetImages.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {fleetImages.map((image) => {
                        const uploader =
                          users.find(
                            (user) => user.clerkId === image.uploadedBy,
                          ) ?? null;

                        return (
                          <div
                            key={image.id}
                            className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
                          >
                            <div className="relative aspect-video overflow-hidden bg-black/40">
                              <Image
                                src={image.imageUrl}
                                alt={image.aircraftType}
                                fill
                                sizes="(max-width: 640px) 100vw, 50vw"
                                className="object-cover"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2 p-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 font-mono text-xs text-cyan-300">
                                    {image.aircraftType}
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    {new Date(
                                      image.updatedAt,
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="mt-1.5 text-xs text-slate-400">
                                  by{" "}
                                  {uploader
                                    ? truncateConvexId(getUserIdentifier(uploader))
                                    : "Unknown user"}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={deletingImageId === image.id}
                                onClick={() => handleDeleteFleetImage(image)}
                                className="cursor-pointer rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deletingImageId === image.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-slate-500">
                      No fleet images uploaded yet for this VA.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Virtual Airline?"
        message={
          form.id
            ? `${form.name || "This VA"} will be deleted along with all assigned pilots and fleet images. This cannot be undone.`
            : "This virtual airline will be deleted."
        }
        confirmLabel="Delete VA"
        variant="danger"
        isLoading={isDeletingVirtualAirline}
        onConfirm={handleDeleteVirtualAirline}
        onCancel={() => {
          if (isDeletingVirtualAirline) return;
          setIsDeleteModalOpen(false);
        }}
      />
    </>
  );
}
