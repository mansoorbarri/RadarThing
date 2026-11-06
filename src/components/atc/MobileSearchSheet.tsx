"use client";

import type { ComponentProps } from "react";
import { SearchBar } from "~/components/atc/searchbar";
import { FocusTrap } from "~/components/ui/focus-trap";

type SearchBarProps = ComponentProps<typeof SearchBar>;

interface MobileSearchSheetProps extends Omit<
  SearchBarProps,
  | "variant"
  | "isMobile"
  | "autoFocus"
  | "dataTour"
  | "inputDebugId"
  | "onAfterSelect"
  | "onEscape"
> {
  onClose: () => void;
}

/** Phone search: a modal bottom sheet wrapping the shared SearchBar. */
export function MobileSearchSheet({
  onClose,
  setSearchTerm,
  ...searchProps
}: MobileSearchSheetProps) {
  const dismiss = () => {
    onClose();
    setSearchTerm("");
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[10019] bg-black/50"
        onClick={dismiss}
        aria-hidden="true"
      />
      <FocusTrap
        returnFocusTo='[data-debug-id="radar-mobile-search-button"]'
        onEscape={dismiss}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="animate-in slide-in-from-bottom fixed inset-x-0 bottom-0 z-[10020] rounded-t-2xl border-t border-white/10 bg-[#0a1219] px-4 pt-3 pb-8 duration-200"
        style={{
          paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))",
        }}
      >
        <div className="mb-4 flex justify-center" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <SearchBar
          {...searchProps}
          setSearchTerm={setSearchTerm}
          variant="sheet"
          isMobile
          autoFocus
          dataTour="radar-mobile-search"
          inputDebugId="radar-mobile-search-input"
          // Clear the query when the sheet closes, so it opens fresh next time.
          onAfterSelect={dismiss}
          onEscape={dismiss}
        />
      </FocusTrap>
    </>
  );
}
