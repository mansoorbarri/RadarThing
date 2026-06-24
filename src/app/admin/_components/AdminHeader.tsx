"use client";

import { useRouter } from "next/navigation";
import { UserAuth } from "~/components/atc/userAuth";
import { SystemThemeLogo } from "~/components/ui/SystemThemeLogo";

export function AdminHeader() {
  const router = useRouter();

  return (
    <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <button
          onClick={() => router.push("/radar")}
          className="cursor-pointer font-mono text-xl text-cyan-400"
        >
          <SystemThemeLogo
            alt="RadarThing"
            width={100}
            height={30}
            className="h-7 w-auto sm:h-[30px]"
          />
        </button>
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => router.push("/radar")}
            className="cursor-pointer text-sm text-slate-400 transition-colors hover:text-white"
          >
            <span className="hidden sm:inline">Back to Map</span>
            <span className="sm:hidden">Map</span>
          </button>
          <UserAuth />
        </div>
      </div>
    </header>
  );
}
