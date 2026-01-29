"use client";

interface RejectModalProps {
  isOpen: boolean;
  targetCount: number;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RejectModal({ isOpen, targetCount, reason, onReasonChange, onConfirm, onCancel }: RejectModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">
          Reject {targetCount} image{targetCount > 1 ? "s" : ""}
        </h3>
        <p className="mb-4 text-sm text-slate-400">Please provide a reason for rejection. This will be sent to the uploader.</p>
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="e.g., Image quality too low, wrong aircraft type, etc."
          className="mb-4 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-white placeholder-slate-500 outline-none focus:border-red-500/50"
          rows={3}
          autoFocus
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 cursor-pointer rounded-lg border border-white/10 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5">Cancel</button>
          <button onClick={onConfirm} disabled={!reason.trim()} className="flex-1 cursor-pointer rounded-lg bg-red-500/20 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50">Reject</button>
        </div>
      </div>
    </div>
  );
}
