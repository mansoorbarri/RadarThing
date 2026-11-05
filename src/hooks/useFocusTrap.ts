import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab focus inside `containerRef` while mounted, closes on Escape and
 * returns focus to whatever was focused before. `onEscape` is read through a
 * ref so callers can pass inline functions without re-running the effect
 * (which would otherwise bounce focus on every parent re-render).
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  onEscape?: () => void,
  {
    autoFocus = true,
    returnFocusTo,
  }: {
    autoFocus?: boolean;
    /** Selector to focus on close if the opener is gone (e.g. re-rendered). */
    returnFocusTo?: string;
  } = {},
) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (autoFocus && !container.contains(document.activeElement)) {
      (container.querySelector<HTMLElement>(FOCUSABLE) ?? container).focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onEscapeRef.current) {
        event.stopPropagation();
        onEscapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !container.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // The opener may have been unmounted while the dialog was open; fall
      // back to a stable selector so focus doesn't drop to <body>.
      requestAnimationFrame(() => {
        if (previouslyFocused?.isConnected) previouslyFocused.focus();
        else if (returnFocusTo)
          document.querySelector<HTMLElement>(returnFocusTo)?.focus();
      });
    };
    // Run once per mount; callbacks are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
