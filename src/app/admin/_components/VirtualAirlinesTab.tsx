"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Search, Users, Save, Plus, Plane, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import {
  createVirtualAirline,
  updateVirtualAirline,
  addVirtualAirlineMember,
  removeVirtualAirlineMember,
} from "~/app/actions/virtual-airlines";
import { Switch } from "~/components/ui/switch";

interface FormState {
  id: string | null;
  name: string;
  callsignPrefix: string;
  adminClerkId: string;
  isActive: boolean;
}

const INITIAL_FORM: FormState = {
  id: null,
  name: "",
  callsignPrefix: "",
  adminClerkId: "",
  isActive: true,
};

export function VirtualAirlinesTab() {
  const allUsers = useQuery(api.users.getAll);
  const virtualAirlines = useQuery(api.virtualAirlines.getAll);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [search, setSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);

  const users = useMemo(() => allUsers ?? [], [allUsers]);
  const airlines = useMemo(() => virtualAirlines ?? [], [virtualAirlines]);
  const selectedMembers = useQuery(
    api.virtualAirlineMembers.getByVirtualAirlineId,
    form.id ? { virtualAirlineId: form.id as Id<"virtualAirlines"> } : "skip",
  );

  const selectedAdmin = useMemo(
    () => users.find((user) => user.clerkId === form.adminClerkId) ?? null,
    [form.adminClerkId, users],
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users
      .filter((user) => {
        if (!query) return true;

        return (
          user.email.toLowerCase().includes(query) ||
          user.clerkId.toLowerCase().includes(query) ||
          user.discordUsername?.toLowerCase().includes(query)
        );
      })
      .slice(0, 8);
  }, [search, users]);

  const assignableUsers = useMemo(() => {
    if (!form.id) return [];

    const query = memberSearch.trim().toLowerCase();
    const existingUserIds = new Set((selectedMembers ?? []).map((member) => member.userId));

    return users
      .filter((user) => {
        if (!user.googleId) return false;
        if (existingUserIds.has(user._id)) return false;
        if (!query) return true;

        return (
          user.email.toLowerCase().includes(query) ||
          user.clerkId.toLowerCase().includes(query) ||
          user.discordUsername?.toLowerCase().includes(query)
        );
      })
      .slice(0, 8);
  }, [form.id, memberSearch, selectedMembers, users]);

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setSearch("");
    setMemberSearch("");
  };

  const handleEdit = (virtualAirline: (typeof airlines)[number]) => {
    setForm({
      id: virtualAirline.id,
      name: virtualAirline.name,
      callsignPrefix: virtualAirline.callsignPrefix,
      adminClerkId: virtualAirline.adminClerkId,
      isActive: virtualAirline.isActive,
    });

    const adminUser =
      users.find((user) => user.clerkId === virtualAirline.adminClerkId) ?? null;
    setSearch(adminUser?.email ?? adminUser?.discordUsername ?? "");
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
          isActive: form.isActive,
        })
      : await createVirtualAirline({
          name: form.name,
          callsignPrefix: form.callsignPrefix,
          adminClerkId: form.adminClerkId,
        });

    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error || "Failed to save VA");
      return;
    }

    toast.success(form.id ? "VA updated" : "VA created");
    resetForm();
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

  const handleRemoveMember = async (memberId: string) => {
    setMemberActionId(memberId);
    const result = await removeVirtualAirlineMember(memberId);
    setMemberActionId(null);

    if (!result.success) {
      toast.error(result.error || "Failed to remove pilot");
      return;
    }

    toast.success("Pilot removed from VA");
  };

  if (allUsers === undefined || virtualAirlines === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-white/10 bg-white/5 p-5"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {form.id ? "Edit Virtual Airline" : "Register Virtual Airline"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              RadarThing admins assign ownership. VA admins only manage their
              own fleet images.
            </p>
          </div>
          {form.id && (
            <button
              type="button"
              onClick={resetForm}
              className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-white/10"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="space-y-4">
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
                  callsignPrefix: event.target.value.toUpperCase().replace(/\s+/g, ""),
                }))
              }
              placeholder="RVA"
              maxLength={8}
              disabled={submitting}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-white placeholder-slate-500 outline-none transition-colors focus:border-cyan-500/50"
            />
            <p className="mt-2 text-xs text-slate-500">
              Flights that start with this prefix will be tagged as VA traffic.
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
                placeholder="Search by email or Discord username"
                disabled={submitting}
                className="w-full rounded-lg border border-white/10 bg-black/40 py-3 pr-4 pl-10 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-cyan-500/50"
              />
            </div>
            <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-2">
              {selectedAdmin && (
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2">
                  <div className="text-sm font-medium text-white">
                    {selectedAdmin.email}
                  </div>
                  <div className="mt-1 text-xs text-cyan-300">
                    Assigned VA admin
                    {selectedAdmin.discordUsername
                      ? ` - ${selectedAdmin.discordUsername}`
                      : ""}
                  </div>
                </div>
              )}

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
                    className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                      active
                        ? "bg-cyan-500/15 text-cyan-200"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-white">
                        {user.email}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-400">
                        {user.discordUsername ?? user.clerkId}
                      </div>
                    </div>
                    {active && (
                      <span className="rounded-full bg-cyan-500/20 px-2 py-1 text-[10px] font-semibold uppercase">
                        Selected
                      </span>
                    )}
                  </button>
                );
              })}

              {filteredUsers.length === 0 && (
                <div className="px-3 py-2 text-sm text-slate-500">
                  No RadarThing users matched that search.
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              The assigned user must have signed into RadarThing at least once.
            </p>
          </div>

          {form.id && (
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-white">VA Active</div>
                <div className="text-xs text-slate-400">
                  Disable a VA to stop prefix matching and VA image usage.
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

          {form.id && (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3">
                <div className="text-sm font-medium text-white">VA Pilots</div>
                <div className="mt-1 text-xs text-slate-400">
                  Only assigned pilots get the VA badge and VA liveries when
                  they fly with the VA callsign prefix.
                </div>
              </div>

              <div className="space-y-2">
                {(selectedMembers ?? []).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-white">
                        {member.email ?? member.clerkId}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-400">
                        {member.discordUsername ?? member.googleId}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={memberActionId === member.id}
                      onClick={() => handleRemoveMember(member.id)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-2 text-xs text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                ))}

                {selectedMembers?.length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-sm text-slate-500">
                    No pilots assigned yet.
                  </div>
                )}
              </div>

              <div className="mt-4">
                <label className="mb-2 block font-mono text-xs text-slate-400">
                  ADD PILOT
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder="Search users with linked Google IDs"
                    className="w-full rounded-lg border border-white/10 bg-black/40 py-3 pr-4 pl-10 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-cyan-500/50"
                  />
                </div>
                <div className="mt-2 space-y-2">
                  {assignableUsers.map((user) => (
                    <button
                      key={user._id}
                      type="button"
                      onClick={() => handleAddMember(user._id)}
                      disabled={memberActionId === user._id}
                      className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-left transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm text-white">
                          {user.email}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-400">
                          {user.discordUsername ?? user.googleId}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-1 text-[10px] font-semibold uppercase text-cyan-300">
                        <UserPlus className="h-3 w-3" />
                        Add
                      </span>
                    </button>
                  ))}

                  {assignableUsers.length === 0 && (
                    <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-sm text-slate-500">
                      No eligible pilots matched. Pilots need a linked Google ID
                      before they can be assigned to a VA.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-3 font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {form.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {form.id ? "Save VA" : "Create VA"}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-300">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Registered VAs</h2>
            <p className="text-sm text-slate-400">
              {airlines.length} total virtual airline
              {airlines.length === 1 ? "" : "s"}.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {airlines.map((virtualAirline) => {
            const adminUser =
              users.find((user) => user.clerkId === virtualAirline.adminClerkId) ??
              null;

            return (
              <div
                key={virtualAirline.id}
                className="rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-white">
                        {virtualAirline.name}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
                          virtualAirline.isActive
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-white/10 text-slate-400"
                        }`}
                      >
                        {virtualAirline.isActive ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="rounded-md bg-cyan-500/15 px-2 py-1 font-mono text-cyan-300">
                        {virtualAirline.callsignPrefix}
                      </span>
                      <span className="truncate">
                        Admin: {adminUser?.email ?? virtualAirline.adminClerkId}
                      </span>
                    </div>
                    {adminUser?.discordUsername && (
                      <div className="mt-1 text-xs text-slate-500">
                        Discord: {adminUser.discordUsername}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleEdit(virtualAirline)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10"
                  >
                    <Plane className="h-4 w-4" />
                    Edit
                  </button>
                </div>
              </div>
            );
          })}

          {airlines.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">
              No VAs registered yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
