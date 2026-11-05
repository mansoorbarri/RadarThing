import type { KeyboardEvent } from "react";

/**
 * Props that make a non-button element behave like a button for keyboard and
 * screen-reader users (focusable, announced as a button, Enter/Space work).
 * Prefer a real <button>; use this where the element contains block layout.
 */
export function buttonLikeProps(onActivate: () => void, label?: string) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": label,
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
  };
}
