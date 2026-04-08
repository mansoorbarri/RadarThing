"use client";

import React, { useEffect, useRef, useCallback } from "react";

interface MobileDrawerProps {
  children: React.ReactNode;
  onClose: () => void;
}

export const MobileDrawer = ({ children, onClose }: MobileDrawerProps) => {
  const backdropRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={handleBackdropClick}
        className="fixed inset-0 z-[10014] bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed inset-y-0 right-0 z-[10015] w-[85vw] max-w-[400px] border-l border-white/10 bg-black/95 backdrop-blur-xl animate-in slide-in-from-right duration-250 ease-out"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 left-3 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Content */}
        <div className="h-full overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom,0px)]">
          {children}
        </div>
      </div>
    </>
  );
};
