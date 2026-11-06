/**
 * Copies text, falling back to a hidden textarea where the Clipboard API is
 * missing (older browsers, non-secure origins). Rejects if both fail, so
 * callers can show an error.
 */
export async function copyText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
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
  }
}
