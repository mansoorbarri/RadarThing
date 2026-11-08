"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plane } from "lucide-react";

export function AdminAccessDenied() {
  const router = useRouter();

  return (
    <div className="bg-site min-h-screen text-white">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <button
            onClick={() => router.push("/radar")}
            className="cursor-pointer font-mono text-xl text-cyan-400"
          >
            <Image
              src="/logo-white.svg"
              alt="RadarThing"
              width={100}
              height={30}
            />
          </button>
          <button
            onClick={() => router.push("/radar")}
            className="cursor-pointer text-sm text-slate-400 transition-colors hover:text-white"
          >
            Back to map
          </button>
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto max-w-2xl px-6 py-20 text-center"
      >
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2">
          <Plane className="h-4 w-4 text-red-400" />
          <span className="font-mono text-sm text-red-400">ACCESS DENIED</span>
        </div>
        <h1 className="mb-4 text-4xl font-bold text-white">
          Admin access required
        </h1>
        <p className="mb-8 text-xl text-slate-400">
          Only Admin users can access this panel
        </p>
        <button
          onClick={() => router.push("/radar")}
          className="cursor-pointer rounded-xl bg-cyan-400 px-8 py-4 font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-300 hover:shadow-cyan-500/40 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none"
        >
          Back to map
        </button>
      </main>
    </div>
  );
}
