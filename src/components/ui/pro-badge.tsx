"use client";

import { useRouter } from "next/navigation";

interface ProBadgeProps {
  className?: string;
  size?: "sm" | "md";
}

export function ProBadge({ className = "", size = "sm" }: ProBadgeProps) {
  const router = useRouter();

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-1 text-xs",
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        router.push("/pricing");
      }}
      className={`cursor-pointer rounded bg-yellow-500/20 font-mono font-bold tracking-wider text-yellow-400 transition-all hover:bg-yellow-500/30 hover:scale-105 ${sizeClasses[size]} ${className}`}
    >
      PRO
    </button>
  );
}
