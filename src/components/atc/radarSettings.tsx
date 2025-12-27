"use client";

import React from "react";
import { useUser } from "@clerk/nextjs";
import { UploadButton } from "~/utils/uploadthing";

export const RadarSettings = () => {
  const { user } = useUser();
  
  // Check role from Clerk metadata
  const isPremium = user?.publicMetadata?.role === "PREMIUM";
  const radarKey = user?.publicMetadata?.radarKey as string;

  return (
    <div className="flex flex-col gap-4 p-4 rounded-md border border-cyan-400/30 bg-black/90 font-mono text-cyan-400 shadow-xl backdrop-blur-md">
      <h3 className="text-[14px] font-bold uppercase tracking-widest text-white border-b border-white/10 pb-2">
        Radar Configuration
      </h3>
      
      {/* Radar Key Section */}
      <div className="space-y-2">
        <label className="text-[10px] text-cyan-400/60 uppercase font-bold">Your Secret Radar Key</label>
        <div className="flex gap-2">
          <input
            type="password"
            readOnly
            value={radarKey || ""}
            className="flex-1 rounded border border-cyan-400/20 bg-black/50 px-3 py-1.5 text-[12px] focus:outline-none"
          />
          <button
            onClick={() => {
              void navigator.clipboard.writeText(radarKey);
              alert("Key copied!");
            }}
            className="rounded border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-bold hover:bg-cyan-400/20 transition-all"
          >
            COPY
          </button>
        </div>
      </div>

      {/* Airline Logo Section */}
      <div className="mt-2 pt-4 border-t border-white/10">
        <label className="text-[10px] text-cyan-400/60 uppercase font-bold mb-3 block">
          Custom Airline Logo
        </label>
        
        {isPremium ? (
          <UploadButton
            endpoint="airlineLogoUploader"
            onClientUploadComplete={() => {
              alert("Airline Logo Updated! Refresh GeoFS to see changes.");
            }}
            onUploadError={(error: Error) => {
              alert(`Upload Error: ${error.message}`);
            }}
            appearance={{
              button: "bg-cyan-400 text-black font-mono text-[11px] font-bold px-4 py-2 w-full hover:bg-cyan-300 transition-colors h-auto rounded-none",
              allowedContent: "text-[9px] text-white/30 mt-2 uppercase font-bold"
            }}
            content={{
              button: "SELECT LOGO FILE (PNG/JPG)"
            }}
          />
        ) : (
          <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-md text-center">
            <p className="text-[10px] text-yellow-500/70 italic leading-relaxed">
              Premium required to upload custom airline branding.
            </p>
          </div>
        )}
      </div>

      <div className="text-[9px] text-white/30 leading-tight bg-white/5 p-2 rounded italic">
        * After uploading, the logo will appear on the radar for everyone when you fly.
      </div>
    </div>
  );
};