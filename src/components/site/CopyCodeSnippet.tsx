"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

/** A code block with a Copy button, used for the console loader snippet. */
export function CopyCodeSnippet({
  code,
  label = "Copy code",
}: {
  code: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    navigator.clipboard
      .writeText(code)
      .then(() => setCopied(true))
      .catch(() =>
        toast.error("Couldn't copy. Select the code and copy it manually."),
      );
  };

  return (
    <div className="relative">
      <pre className="bg-site overflow-x-auto rounded-2xl border border-white/8 p-4 pr-24 text-xs leading-6 text-cyan-100">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute top-3 right-3 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-black/60 px-3 text-xs font-medium text-slate-200 transition-colors hover:border-cyan-300/50 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span aria-live="polite">{copied ? "Copied" : label}</span>
      </button>
    </div>
  );
}
