"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Dialog } from "radix-ui";
import { AlertTriangle, Ban } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { createPortalSession } from "~/app/actions/create-portal";
import { getCurrentUserDataExport } from "~/app/actions/export-user-data";
import { downloadAccountDataExport } from "~/lib/account-data-export";
import { moderationButton } from "./ModerationControls";

export function ModerationGate({ children }: { children: ReactNode }) {
  const { user } = useUser();
  // A new account sign-in starts a fresh visit, even without a full page reload.
  return <AccountNotices key={user?.id ?? "guest"}>{children}</AccountNotices>;
}

function AccountNotices({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const status = useQuery(
    api.moderation.myStatus,
    isAuthenticated ? {} : "skip",
  );
  const acknowledge = useMutation(api.moderation.acknowledge);
  const [visitStartedAt, setVisitStartedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const { signOut, openUserProfile } = useClerk();
  const pathname = usePathname();
  const router = useRouter();
  const isLegalPage = pathname === "/terms" || pathname === "/privacy";
  useEffect(() => {
    if (status && visitStartedAt === null) setVisitStartedAt(status.checkedAt);
  }, [status, visitStartedAt]);
  useEffect(() => {
    if (status?.ban && pathname !== "/banned" && !isLegalPage)
      router.replace("/banned");
    if (status && !status.ban && pathname === "/banned")
      router.replace("/radar");
  }, [status, pathname, router, isLegalPage]);
  const warning = status?.warnings.find(
    (w) => visitStartedAt !== null && w.createdAt <= visitStartedAt,
  );
  if (isLoading || (isAuthenticated && status === undefined))
    return (
      <div
        role="status"
        className="flex min-h-screen items-center justify-center bg-[#050f14] text-slate-300"
      >
        Loading your account…
      </div>
    );
  if (status?.ban && !isLegalPage)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050f14] p-6 text-white">
        <div className="w-full max-w-xl rounded-xl border border-red-400/25 bg-[#08151c] p-8 shadow-2xl">
          <Ban className="mb-6 text-red-300" size={32} />
          <p className="font-mono text-xs tracking-widest text-red-300">
            ACCOUNT RESTRICTED
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            Your RT account is banned
          </h1>
          <p className="mt-4 text-sm text-slate-300">
            This ban remains in place until the super-admin lifts it.
          </p>
          <div className="my-6 border-l-2 border-red-400/50 pl-4">
            <p className="break-words whitespace-pre-wrap">
              {status.ban.reason}
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Issued {new Date(status.ban.createdAt).toLocaleString()}
            </p>
          </div>
          <p className="mb-4 text-sm text-slate-400">
            You can still manage your account and billing. A ban does not cancel
            your subscription.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className={moderationButton}
              onClick={() => openUserProfile()}
            >
              Manage account
            </button>
            <button
              disabled={busy}
              className={moderationButton}
              onClick={async () => {
                setBusy(true);
                try {
                  window.location.assign(await createPortalSession());
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not open billing",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Manage billing
            </button>
            <button
              disabled={busy}
              className={moderationButton}
              onClick={async () => {
                setBusy(true);
                try {
                  downloadAccountDataExport(await getCurrentUserDataExport());
                } catch {
                  toast.error("Could not export account data");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Export my data
            </button>
            <button
              className={moderationButton}
              onClick={() => void signOut({ redirectUrl: "/" })}
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  return (
    <>
      {children}
      <Dialog.Root open={!!warning}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-sm" />
          <Dialog.Content
            onEscapeKeyDown={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
            className="fixed top-1/2 left-1/2 z-[1101] max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-amber-400/30 bg-[#08151c] p-7 text-white shadow-2xl"
          >
            <AlertTriangle className="mb-5 text-amber-300" size={30} />
            <Dialog.Title className="text-2xl font-semibold">
              A warning about your RT account
            </Dialog.Title>
            <Dialog.Description className="mt-3 text-sm text-slate-300">
              An admin has issued a warning. Please read the reason below and
              follow the site rules.
            </Dialog.Description>
            <p className="my-6 border-l-2 border-amber-400/50 pl-4 break-words whitespace-pre-wrap">
              {warning?.reason}
            </p>
            <p className="mb-5 text-xs text-slate-400">
              {warning && new Date(warning.createdAt).toLocaleString()}
            </p>
            <button
              disabled={busy}
              className={`${moderationButton} w-full bg-amber-400/10 text-amber-200`}
              onClick={async () => {
                if (!warning) return;
                setBusy(true);
                try {
                  await acknowledge({ id: warning.id });
                } catch {
                  toast.error(
                    "Could not acknowledge warning. Please try again.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving…" : "I have read and understood"}
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
