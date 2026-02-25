"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import {
  changelog,
  LATEST_CHANGELOG_ID,
  type ChangelogEntry,
} from "~/lib/changelog";
import { Analytics } from "~/lib/analytics";

const SEEN_KEY = "radarthing_whats_new_seen";
const TOAST_KEY = "radarthing_whats_new_toast";

const typeBadge: Record<ChangelogEntry["type"], { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-cyan-400/20 text-cyan-400" },
  improvement: { label: "Improvement", cls: "bg-emerald-400/20 text-emerald-400" },
  fix: { label: "Fix", cls: "bg-amber-400/20 text-amber-400" },
};

export function WhatsNew({ isMobile }: { isMobile: boolean }) {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check unread status on mount
  useEffect(() => {
    const seen = localStorage.getItem(SEEN_KEY);
    if (seen !== LATEST_CHANGELOG_ID) {
      setHasUnread(true);
    }
  }, []);

  // Toast on first visit after update
  useEffect(() => {
    const toastSeen = localStorage.getItem(TOAST_KEY);
    if (toastSeen === LATEST_CHANGELOG_ID) return;

    const latest = changelog[0];
    if (!latest) return;

    const timer = setTimeout(() => {
      localStorage.setItem(TOAST_KEY, LATEST_CHANGELOG_ID);
      Analytics.whatsNewToastShown({ entry_id: latest.id });

      toast(
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10">
            <Megaphone className="h-4 w-4 text-cyan-400" strokeWidth={2} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-slate-100">{latest.title}</span>
            <span className="text-xs leading-relaxed text-slate-400">{latest.description}</span>
          </div>
        </div>,
        {
          duration: 8000,
          className:
            "!rounded-xl !bg-black/80 !backdrop-blur-xl !border !border-cyan-400/20 !shadow-[0_4px_24px_rgba(0,255,255,0.08)] !p-4",
          actionButtonStyle: {
            background: "rgba(34,211,238,0.15)",
            color: "#22d3ee",
            border: "1px solid rgba(34,211,238,0.3)",
            borderRadius: "0.5rem",
            fontSize: "12px",
            fontWeight: "600",
          },
          action: {
            label: "See what's new",
            onClick: () => {
              Analytics.whatsNewToastClicked({ entry_id: latest.id });
              setOpen(true);
              localStorage.setItem(SEEN_KEY, LATEST_CHANGELOG_ID);
              setHasUnread(false);
            },
          },
        },
      );
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Outside click dismiss
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleToggle = useCallback(() => {
    const willOpen = !open;
    setOpen(willOpen);

    if (willOpen) {
      Analytics.whatsNewOpened({ had_unread: hasUnread });
      localStorage.setItem(SEEN_KEY, LATEST_CHANGELOG_ID);
      setHasUnread(false);
    }
  }, [open, hasUnread]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={handleToggle}
        className="relative flex cursor-pointer items-center justify-center rounded-md border border-slate-600/50 bg-black/70 p-1.5 text-slate-400 transition-all hover:border-cyan-400/50 hover:text-cyan-400 hover:shadow-[0_0_8px_rgba(0,255,255,0.3)]"
      >
        <Megaphone className={isMobile ? "h-4 w-4" : "h-[18px] w-[18px]"} strokeWidth={1.8} />

        {hasUnread && (
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,255,255,0.8)]" />
        )}
      </button>

      {open && (
        <div
          className={`animate-fade-in-up absolute right-0 top-full z-50 mt-2 rounded-xl border border-cyan-400/30 bg-black/90 shadow-[0_0_15px_rgba(0,255,255,0.1)] backdrop-blur-xl ${isMobile ? "w-72" : "w-80"}`}
        >
          <div className="border-b border-slate-700/50 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-200">
              What&apos;s New
            </h3>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {changelog.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg px-3 py-2.5 transition-colors hover:bg-cyan-400/5"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${typeBadge[entry.type].cls}`}
                  >
                    {typeBadge[entry.type].label}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {entry.date}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-300">
                  {entry.title}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {entry.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
