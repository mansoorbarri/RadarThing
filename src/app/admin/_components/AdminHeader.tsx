"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { UserAuth } from "~/components/atc/userAuth";

export function AdminHeader() {
  const router = useRouter();

  return (
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/radar")}
            className="cursor-pointer text-sm text-slate-400 transition-colors hover:text-white"
          >
            Back to Map
          </button>
          <UserAuth />
        </div>
      </div>
    </header>
  );
}
