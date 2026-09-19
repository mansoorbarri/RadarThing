"use client";

import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { Dialog } from "radix-ui";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useProStatus } from "~/hooks/useProStatus";
import {
  ModerationControls,
  moderationButton,
} from "~/components/moderation/ModerationControls";

export function ModerationTab() {
  const { isSuperAdmin } = useProStatus();

  const { results, status, loadMore } = usePaginatedQuery(
    api.moderation.history,
    {},
    { initialNumItems: 25 },
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<
    FunctionReturnType<typeof api.moderation.history>["page"][number] | null
  >(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const revoke = useMutation(api.moderation.revoke);
  const matches = useQuery(
    api.moderation.searchTargets,
    search.trim() ? { search } : "skip",
  );
  return (
    <section className="space-y-6 text-white">
      <div>
        <h1 className="text-2xl font-semibold">Moderation</h1>
        <p className="mt-2 text-sm text-slate-400">
          {isSuperAdmin
            ? "All warnings, bans, and overrides."
            : "Your warnings and bans, including any super-admin overrides."}
        </p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <label htmlFor="moderation-search" className="text-sm font-medium">
          Find an RT account
        </label>
        <input
          id="moderation-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Discord username or RT ID"
          className="mt-2 w-full rounded-md border border-white/20 bg-black/20 p-3 text-sm outline-none focus:border-cyan-400"
        />
        {matches?.map((user) => (
          <div
            key={user._id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-4"
          >
            <div>
              <p className="text-sm break-all">{user.label}</p>
              <p className="text-xs text-slate-400">
                {user.isBanned ? "Banned" : `RT ID: ${user._id}`}
              </p>
            </div>
            <ModerationControls
              userId={user._id}
              label={user.label}
              disabledReason={user.disabledReason}
            />
          </div>
        ))}
        {search.trim() && matches?.length === 0 && (
          <p className="mt-3 text-sm text-slate-400">No matching accounts.</p>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-white/5 text-xs text-slate-400">
            <tr>
              {["User / action", "Reason", "When / admin", "Status", ""].map(
                (h, i) => (
                  <th key={i} className="p-4 font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {results.map((record) => (
              <tr
                key={record._id}
                className="border-t border-white/10 align-top"
              >
                <td className="max-w-56 p-4">
                  <p className="font-medium break-words">
                    {record.targetLabel}
                  </p>
                  <p
                    className={`mt-1 text-xs ${record.kind === "ban" ? "text-red-300" : "text-amber-300"}`}
                  >
                    {record.kind === "ban" ? "Ban" : "Warning"}
                  </p>
                </td>
                <td className="max-w-sm p-4">
                  <p className="break-words whitespace-pre-wrap">
                    {record.reason}
                  </p>
                  {record.revokedAt && (
                    <p className="mt-3 text-xs break-words whitespace-pre-wrap text-cyan-300">
                      Overridden by {record.revokedByLabel} on{" "}
                      {new Date(record.revokedAt).toLocaleString()}:{" "}
                      {record.revokeReason}
                    </p>
                  )}
                </td>
                <td className="p-4">
                  <p>{new Date(record.createdAt).toLocaleString()}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {record.actorLabel}
                  </p>
                </td>
                <td className="p-4 text-xs">
                  <p>
                    {record.revokedAt
                      ? "Overridden"
                      : record.kind === "ban"
                        ? "Active ban"
                        : record.acknowledgedAt
                          ? "Acknowledged"
                          : "Awaiting acknowledgment"}
                  </p>
                  <p
                    className={`mt-2 ${record.emailStatus === "failed" ? "text-red-300" : "text-slate-400"}`}
                  >
                    Email:{" "}
                    {record.emailStatus === "sent"
                      ? "Sent to provider"
                      : record.emailStatus}{" "}
                    · {record.emailAttempts} attempts
                  </p>
                  {record.emailLastError && (
                    <p className="mt-1 text-slate-400">
                      {record.emailLastError}
                    </p>
                  )}
                </td>
                <td className="p-4">
                  {isSuperAdmin && !record.revokedAt && (
                    <button
                      className={moderationButton}
                      onClick={() => {
                        setSelected(record);
                        setReason("");
                      }}
                    >
                      {record.kind === "ban" ? "Lift ban" : "Revoke warning"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!results.length && (
          <p className="p-8 text-center text-sm text-slate-400">
            {status === "LoadingFirstPage"
              ? "Loading moderation history…"
              : "No moderation actions yet."}
          </p>
        )}
      </div>
      {status === "CanLoadMore" && (
        <button className={moderationButton} onClick={() => loadMore(25)}>
          Load older actions
        </button>
      )}
      <Dialog.Root
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[1000] bg-black/75" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-[1001] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/15 bg-[#08151c] p-6 text-white">
            <Dialog.Title className="text-xl font-semibold">
              {selected?.kind === "ban" ? "Lift ban" : "Revoke warning"}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-slate-400">
              The original action and your reason will remain in the moderation
              history and Activity log.
            </Dialog.Description>
            <form
              className="mt-4 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!selected) return;
                setBusy(true);
                try {
                  await revoke({ id: selected._id, reason });
                  setSelected(null);
                  toast.success("Moderation action overridden");
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Override failed",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="block text-sm">
                Reason
                <textarea
                  required
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-2 min-h-28 w-full rounded-md border border-white/20 bg-black/30 p-3"
                />
              </label>
              <div className="flex justify-end gap-2">
                <Dialog.Close disabled={busy} className={moderationButton}>
                  Cancel
                </Dialog.Close>
                <button
                  disabled={busy || !reason.trim()}
                  className={`${moderationButton} text-cyan-300`}
                >
                  {busy ? "Saving…" : "Confirm override"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
