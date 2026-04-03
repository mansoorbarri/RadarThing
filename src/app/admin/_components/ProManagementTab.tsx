"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Switch } from "~/components/ui/switch";
import { Search } from "lucide-react";

export function ProManagementTab() {
  const [search, setSearch] = useState("");
  const allUsers = useQuery(api.users.getAll);
  const updateUser = useMutation(api.users.update);

  if (allUsers === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

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

  // Sort: PRO first, then by _creationTime desc
  const sorted = [...filtered].sort((a, b) => {
    const aIsPro = a.role === "PRO" ? 1 : 0;
    const bIsPro = b.role === "PRO" ? 1 : 0;
    if (aIsPro !== bIsPro) return bIsPro - aIsPro;
    return b._creationTime - a._creationTime;
  });

  async function handleToggle(userId: Id<"users">, currentRole: string) {
    await updateUser({
      id: userId,
      role: currentRole === "PRO" ? "FREE" : "PRO",
    });
  }

  return (
    <div className="space-y-4">
      {/* Search */}
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

      {/* Count */}
      <p className="text-sm text-slate-500">
        {sorted.length} user{sorted.length !== 1 ? "s" : ""}
        {search && ` matching "${search}"`}
      </p>

      {/* User list */}
      <div className="space-y-2">
        {sorted.map((user) => (
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
                    user.role === "PRO"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : user.role === "ADMIN"
                        ? "bg-purple-500/20 text-purple-400"
                        : "bg-white/10 text-slate-400"
                  }`}
                >
                  {user.role}
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
            </div>

            {user.role !== "ADMIN" && (
              <Switch
                checked={user.role === "PRO"}
                onCheckedChange={() => handleToggle(user._id, user.role)}
                className="ml-4 h-5 w-10 shrink-0 data-[state=checked]:bg-yellow-500 data-[state=unchecked]:bg-white/20"
              />
            )}
          </div>
        ))}

        {sorted.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">
            No users found.
          </div>
        )}
      </div>
    </div>
  );
}
