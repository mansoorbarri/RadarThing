"use client";

import { useUser } from "@clerk/nextjs";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getProAndAdminStatus } from "~/app/actions/is-pro";
import { Plane, ImageIcon, Map, Crown, Users, Upload, Flag } from "lucide-react";

import { AdminHeader } from "./_components/AdminHeader";
import { AdminAccessDenied } from "./_components/AdminAccessDenied";
import { AdminSkeleton, AdminTabSkeleton } from "./_components/skeletons";
import { getAdminTabFromPath, getAdminTabHref } from "./adminTabs";

const AircraftImagesTab = dynamic(
  () =>
    import("./_components/AircraftImagesTab").then(
      (mod) => mod.AircraftImagesTab,
    ),
  {
    loading: () => <AdminTabSkeleton />,
  },
);

const AirportChartsTab = dynamic(
  () =>
    import("./_components/AirportChartsTab").then(
      (mod) => mod.AirportChartsTab,
    ),
  {
    loading: () => <AdminTabSkeleton />,
  },
);

const ChallengesTab = dynamic(
  () => import("./_components/ChallengesTab").then((mod) => mod.ChallengesTab),
  {
    loading: () => <AdminTabSkeleton />,
  },
);

const ProManagementTab = dynamic(
  () =>
    import("./_components/ProManagementTab").then(
      (mod) => mod.ProManagementTab,
    ),
  {
    loading: () => <AdminTabSkeleton />,
  },
);

const VirtualAirlinesTab = dynamic(
  () =>
    import("./_components/VirtualAirlinesTab").then(
      (mod) => mod.VirtualAirlinesTab,
    ),
  {
    loading: () => <AdminTabSkeleton />,
  },
);

const ChartUploadModal = dynamic(
  () =>
    import("./_components/ChartUploadModal").then(
      (mod) => mod.ChartUploadModal,
    ),
  {
    loading: () => null,
  },
);

const ImageUploadModal = dynamic(
  () =>
    import("./_components/ImageUploadModal").then(
      (mod) => mod.ImageUploadModal,
    ),
  {
    loading: () => null,
  },
);

export default function AdminPage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminCheckDone, setAdminCheckDone] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const mainTab = getAdminTabFromPath(pathname);

  // Queries for counts in tab badges
  const pendingQuery = useQuery(api.aircraftImages.getPending);
  const approvedChartsQuery = useQuery(api.airportCharts.getApproved);
  const pendingCount = pendingQuery?.length ?? 0;

  const loading = !adminCheckDone || pendingQuery === undefined;

  // Check admin status
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      getProAndAdminStatus()
        .then(({ isAdmin, isSuperAdmin: superAdmin }) => {
          setIsAdminUser(isAdmin);
          setIsSuperAdmin(superAdmin);
          setAdminCheckDone(true);
        })
        .catch(() => setAdminCheckDone(true));
    } else if (isLoaded) {
      setAdminCheckDone(true);
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!adminCheckDone || !isAdminUser) return;
    if (mainTab === "pro" && !isSuperAdmin) {
      router.replace("/admin");
    }
  }, [adminCheckDone, isAdminUser, isSuperAdmin, mainTab, router]);

  if (!isLoaded || loading) {
    return <AdminSkeleton />;
  }

  if (!isSignedIn || !isAdminUser) {
    return <AdminAccessDenied />;
  }

  if (mainTab === "pro" && !isSuperAdmin) {
    return <AdminSkeleton />;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <AdminHeader />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
            <Plane className="h-4 w-4 text-cyan-400" />
            <span className="font-mono text-sm text-cyan-400">ADMIN PANEL</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
        </div>

        {/* Main Tabs */}
        <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
          <button
            onClick={() => router.push(getAdminTabHref("images"))}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
              mainTab === "images"
                ? "bg-cyan-500/20 text-cyan-400"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            Aircraft Images
            {pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => router.push(getAdminTabHref("charts"))}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
              mainTab === "charts"
                ? "bg-cyan-500/20 text-cyan-400"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <Map className="h-4 w-4" />
            Airport Charts
          </button>
          <button
            onClick={() => router.push(getAdminTabHref("virtual-airlines"))}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
              mainTab === "virtual-airlines"
                ? "bg-cyan-500/20 text-cyan-400"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <Users className="h-4 w-4" />
            Virtual Airlines
          </button>
          <button
            onClick={() => router.push(getAdminTabHref("challenges"))}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
              mainTab === "challenges"
                ? "bg-cyan-500/20 text-cyan-400"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <Flag className="h-4 w-4" />
            Challenges
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => router.push(getAdminTabHref("pro"))}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
                mainTab === "pro"
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              <Crown className="h-4 w-4" />
              Pro
            </button>
          )}
        </div>

        {mainTab === "images" && <AircraftImagesTab />}
        {mainTab === "charts" && (
          <AirportChartsTab approvedCharts={approvedChartsQuery} />
        )}
        {mainTab === "challenges" && <ChallengesTab />}
        {mainTab === "virtual-airlines" && <VirtualAirlinesTab />}
        {mainTab === "pro" && <ProManagementTab />}
      </main>

      {/* Floating Upload Button */}
      {(mainTab === "images" || mainTab === "charts") && (
        <button
          onClick={() => setShowUploadModal(true)}
          className="fixed right-8 bottom-8 z-40 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/30 transition-all hover:scale-110 hover:shadow-cyan-500/50"
          title={
            mainTab === "images"
              ? "Upload Aircraft Image"
              : "Upload Airport Chart"
          }
        >
          <Upload className="h-6 w-6 text-white" />
        </button>
      )}

      {/* Upload Modal */}
      {showUploadModal && mainTab === "images" && (
        <ImageUploadModal onClose={() => setShowUploadModal(false)} />
      )}
      {showUploadModal && mainTab === "charts" && (
        <ChartUploadModal onClose={() => setShowUploadModal(false)} />
      )}
    </div>
  );
}
