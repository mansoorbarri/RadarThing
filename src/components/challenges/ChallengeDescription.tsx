"use client";

import { useState } from "react";

const PREVIEW_LENGTH = 200;

export function ChallengeDescription({
  description,
  className,
}: {
  description: string;
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isTruncated = description.length > PREVIEW_LENGTH;
  const displayedDescription =
    isExpanded || !isTruncated
      ? description
      : description.slice(0, PREVIEW_LENGTH);

  return (
    <p className={className}>
      {displayedDescription}
      {isTruncated && (
        <button
          type="button"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="ml-1 cursor-pointer text-cyan-300 underline decoration-cyan-300/50 underline-offset-2 transition-colors hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          aria-expanded={isExpanded}
        >
          {isExpanded ? "show less" : "read more..."}
        </button>
      )}
    </p>
  );
}
