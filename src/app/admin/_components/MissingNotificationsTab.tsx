"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Trash2, Search, Bell } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "./ConfirmModal";

interface NotifType {
  airlineCode: string;
  aircraftType: string;
  note?: string | null;
}

function matchesNotifSearch(notification: NotifType, query: string) {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return notification.airlineCode?.toLowerCase().includes(q) || notification.aircraftType?.toLowerCase().includes(q) || notification.note?.toLowerCase().includes(q);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

export function MissingNotificationsTab() {
  const notificationsQuery = useQuery(api.missingImageNotifications.getAll);
  const notifications = useMemo(() => notificationsQuery ?? [], [notificationsQuery]);
  const updateNoteMutation = useMutation(api.missingImageNotifications.updateNote);
  const removeNotificationMutation = useMutation(api.missingImageNotifications.remove);

  const [notifSearchQuery, setNotifSearchQuery] = useState("");
  const [notifAirlineFilter, setNotifAirlineFilter] = useState<string>("");
  const [notifAircraftFilter, setNotifAircraftFilter] = useState<string>("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ airlineCode: string; aircraftType: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }, [notifications, notifAirlineFilter, notifAircraftFilter, notifSearchQuery]);

  const clearNotifFilters = () => {
    setNotifSearchQuery("");
    setNotifAirlineFilter("");
    setNotifAircraftFilter("");
  };

  const saveNote = async (airlineCode: string, aircraftType: string, note: string) => {
    try {
      await updateNoteMutation({ airlineCode, aircraftType, note });

      // Delete Discord message when note is saved
      try {
        await fetch("https://sse.radarthing.com/api/image-uploaded", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ airlineCode, aircraftType }),
        });
      } catch {
        // Silently fail - Discord message deletion is best-effort
      }

      toast.success("Note saved");
    } catch {
      toast.error("Failed to save note");
    }
  };

  const openDeleteModal = (airlineCode: string, aircraftType: string) => {
    setDeleteTarget({ airlineCode, aircraftType });
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await removeNotificationMutation(deleteTarget);
      toast.success("Notification deleted");
    } catch {
      toast.error("Failed to delete notification");
    }
    setDeleteLoading(false);
    setDeleteModalOpen(false);
    setDeleteTarget(null);
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setDeleteTarget(null);
  };

  return (
    <>
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Notification"
        message={deleteTarget
          ? `Delete notification for ${deleteTarget.airlineCode} ${deleteTarget.aircraftType}? This will remove it from the missing images list.`
          : "Delete this notification?"}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

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
                      onClick={() => openDeleteModal(notification.airlineCode, notification.aircraftType)}
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
  );
}
