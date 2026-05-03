"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Search, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "../../../../convex/_generated/dataModel";
import { api } from "../../../../convex/_generated/api";
import { Switch } from "~/components/ui/switch";
import {
  TEMP_PRO_DURATION_OPTIONS,
  getEffectiveAccessRole,
  getTempProExpirationFromValue,
  hasActiveAdminProGrant,
  type TempProDurationValue,
} from "~/lib/proAccess";

type GrantOption = "permanent" | TempProDurationValue;

interface GrantModalState {
  userId: Id<"users">;
  email: string;
}

export function ProManagementTab() {
  const [search, setSearch] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [grantModal, setGrantModal] = useState<GrantModalState | null>(null);
  const [grantOption, setGrantOption] = useState<GrantOption>("1w");

  const allUsers = useQuery(api.users.getAllForProManagement);
  const setPermanentProRole = useMutation(api.users.setPermanentProRole);
  const setTemporaryProGrant = useMutation(api.users.setTemporaryProGrant);

  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];

    const searchLower = search.toLowerCase();
    const filtered = allUsers.filter((user) => {
      if (!search) return true;
      return (
        user.email.toLowerCase().includes(searchLower) ||
        user.discordUsername?.toLowerCase().includes(searchLower) ||
        user.clerkId.toLowerCase().includes(searchLower) ||
        user._id.toLowerCase().includes(searchLower)
      );
    });

    return [...filtered].sort((a, b) => {
      const aIsPro = getEffectiveAccessRole(a) === "PRO" ? 1 : 0;
      const bIsPro = getEffectiveAccessRole(b) === "PRO" ? 1 : 0;
      if (aIsPro !== bIsPro) return bIsPro - aIsPro;
      return b._creationTime - a._creationTime;
    });
  }, [allUsers, search]);

  if (allUsers === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  async function handleToggle(
    userId: Id<"users">,
    email: string,
    isEnabled: boolean,
    isPermanentPro: boolean,
    hasTempGrant: boolean,
  ) {
    if (!isEnabled) {
      setGrantOption("1w");
      setGrantModal({ userId, email });
      return;
    }

    setPendingUserId(userId);

    try {
      if (isPermanentPro) {
        await setPermanentProRole({
          id: userId,
          enabled: false,
        });
      } else if (hasTempGrant) {
        await setTemporaryProGrant({
          id: userId,
          clear: true,
        });
      }

      toast.success("PRO access revoked");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update PRO access",
      );
    } finally {
      setPendingUserId(null);
    }
  }

  async function handleGrantSubmit() {
    if (!grantModal) return;

    setPendingUserId(grantModal.userId);

    try {
      if (grantOption === "permanent") {
        await setPermanentProRole({
          id: grantModal.userId,
          enabled: true,
        });
        toast.success("Permanent PRO granted");
      } else {
        const option = TEMP_PRO_DURATION_OPTIONS.find(
          (item) => item.value === grantOption,
        );

        await setTemporaryProGrant({
          id: grantModal.userId,
          expiresAt: getTempProExpirationFromValue(grantOption),
        });
        toast.success(
          `Temporary PRO granted for ${option?.label ?? "selected duration"}`,
        );
      }

      setGrantModal(null);
      setGrantOption("1w");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to grant PRO access",
      );
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          Turn the switch on to open the grant modal. Turn it off to revoke the
          current PRO access.
        </div>

        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by email, Discord username, clerkId, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pr-4 pl-10 text-sm text-white placeholder-slate-500 transition-colors outline-none focus:border-cyan-500/50 focus:bg-white/[0.07]"
          />
        </div>

        <p className="text-sm text-slate-500">
          {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
          {search && ` matching "${search}"`}
        </p>

        <div className="space-y-2">
          {filteredUsers.map((user) => {
            const effectiveRole = getEffectiveAccessRole(user);
            const isPermanentPro = user.role === "PRO";
            const hasTempGrant = hasActiveAdminProGrant(user);
            const isBusy = pendingUserId === user._id;

            return (
              <div
                key={user._id}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">
                      {user.email}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${
                        user.role === "ADMIN"
                          ? "bg-purple-500/20 text-purple-400"
                          : effectiveRole === "PRO"
                            ? hasTempGrant && !isPermanentPro
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-yellow-500/20 text-yellow-400"
                            : "bg-white/10 text-slate-400"
                      }`}
                    >
                      {user.role === "ADMIN"
                        ? "ADMIN"
                        : hasTempGrant && !isPermanentPro
                          ? "PRO TEMP"
                          : effectiveRole}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
                    {user.clerkId.slice(0, 16)}...
                  </p>
                  {user.discordUsername && (
                    <p className="mt-1 truncate text-xs text-cyan-400">
                      Discord: {user.discordUsername}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    {isPermanentPro
                      ? "Permanent PRO role"
                      : hasTempGrant
                        ? `Temporary PRO until ${new Date(user.adminProExpiresAt!).toLocaleString()}`
                        : "Free tier"}
                  </p>
                </div>

                {user.role !== "ADMIN" && (
                  <div className="ml-4 flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs font-medium text-white">
                        PRO access
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {isPermanentPro
                          ? "Permanent"
                          : hasTempGrant
                            ? "Temporary"
                            : "Off"}
                      </p>
                    </div>
                    <Switch
                      checked={effectiveRole === "PRO"}
                      disabled={isBusy}
                      onCheckedChange={() =>
                        handleToggle(
                          user._id,
                          user.email,
                          effectiveRole === "PRO",
                          isPermanentPro,
                          hasTempGrant,
                        )
                      }
                      className="h-5 w-10 shrink-0 data-[state=checked]:bg-yellow-500 data-[state=unchecked]:bg-white/20"
                    />
                  </div>
                )}
              </div>
            );
          })}

          {filteredUsers.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-500">
              No users found.
            </div>
          )}
        </div>
      </div>

      <GrantProModal
        isOpen={grantModal !== null}
        email={grantModal?.email ?? ""}
        grantOption={grantOption}
        isLoading={pendingUserId === grantModal?.userId}
        onGrantOptionChange={setGrantOption}
        onCancel={() => {
          if (pendingUserId) return;
          setGrantModal(null);
          setGrantOption("1w");
        }}
        onConfirm={handleGrantSubmit}
      />
    </>
  );
}

interface GrantProModalProps {
  isOpen: boolean;
  email: string;
  grantOption: GrantOption;
  isLoading: boolean;
  onGrantOptionChange: (value: GrantOption) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

function GrantProModal({
  isOpen,
  email,
  grantOption,
  isLoading,
  onGrantOptionChange,
  onCancel,
  onConfirm,
}: GrantProModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Grant PRO</h3>
            <p className="mt-1 text-sm text-slate-400">{email}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="cursor-pointer rounded-md p-1 text-slate-500 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close modal"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <GrantOptionButton
            title="Permanent PRO"
            description="Keeps PRO enabled until you revoke it."
            selected={grantOption === "permanent"}
            onSelect={() => onGrantOptionChange("permanent")}
          />

          {TEMP_PRO_DURATION_OPTIONS.map((option) => (
            <GrantOptionButton
              key={option.value}
              title={option.label}
              description={`Automatically expires after ${option.label.toLowerCase()}.`}
              selected={grantOption === option.value}
              onSelect={() => onGrantOptionChange(option.value)}
            />
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 cursor-pointer rounded-lg border border-white/10 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex flex-1 cursor-pointer items-center justify-center rounded-lg bg-yellow-500/20 py-2.5 text-sm font-medium text-yellow-300 transition-colors hover:bg-yellow-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              "Grant PRO"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface GrantOptionButtonProps {
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

function GrantOptionButton({
  title,
  description,
  selected,
  onSelect,
}: GrantOptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full cursor-pointer rounded-xl border px-4 py-3 text-left transition-colors ${
        selected
          ? "border-yellow-500/40 bg-yellow-500/10"
          : "border-white/10 bg-black/20 hover:bg-white/5"
      }`}
    >
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </button>
  );
}
