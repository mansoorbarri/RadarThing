"use client";

import { MobileSwipeSheet } from "~/components/ui/MobileSwipeSheet";

import type { ComponentProps } from "react";
import { SearchBar } from "~/components/atc/searchbar";

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
    <MobileSwipeSheet label="Search" onClose={dismiss} fitContent>
      <div className="px-4 pb-6">
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
      </div>
    </MobileSwipeSheet>
  );
}
