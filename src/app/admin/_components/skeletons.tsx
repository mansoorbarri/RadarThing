"use client";

import { Plane } from "lucide-react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/10 rounded ${className}`} />;
}

export function ImageCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Skeleton className="h-6 w-12 rounded-md" />
          <Skeleton className="h-6 w-12 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>
        <Skeleton className="h-3 w-32 mb-2" />
        <Skeleton className="h-3 w-48 mb-1" />
        <Skeleton className="h-3 w-24 mb-3" />
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="h-9 flex-1 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function AdminSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Skeleton className="h-8 w-24" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Title */}
        <div className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
            <Plane className="h-4 w-4 text-cyan-400" />
            <span className="font-mono text-sm text-cyan-400">ADMIN PANEL</span>
          </div>
          <Skeleton className="h-9 w-64 mt-2" />
        </div>

        {/* Main Tabs Skeleton */}
        <div className="mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
          <Skeleton className="h-10 w-40 rounded-lg" />
          <Skeleton className="h-10 w-48 rounded-lg" />
        </div>

        {/* Search and Filters Skeleton */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </div>

        {/* Sub Tabs Skeleton */}
        <div className="mb-6 flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>

        {/* Cards Grid Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ImageCardSkeleton />
          <ImageCardSkeleton />
          <ImageCardSkeleton />
          <ImageCardSkeleton />
          <ImageCardSkeleton />
          <ImageCardSkeleton />
        </div>
      </main>
    </div>
  );
}
