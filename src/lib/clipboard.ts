/**
 * Copies text. Uses the Clipboard API when it's available and allowed, and
 * otherwise falls back to a hidden textarea (older browsers, non-secure
 * origins, iframes that deny clipboard permission). Rejects if both fail, so
 * callers can show an error.
 */
export async function copyText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Permission denied or blocked: try the fallback below.
    }
  }

  const previouslyFocused = document.activeElement as HTMLElement | null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    // execCommand is deprecated but is the only fallback that still works.
    const ok = document.execCommand("copy");
    if (!ok) throw new Error("Copy command was rejected");
  } finally {
    textarea.remove();
    // Put keyboard focus back where the user was.
    previouslyFocused?.focus?.({ preventScroll: true });
  }
}
