"use client";

import { useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getProAndAdminStatus } from "~/app/actions/is-pro";
import { Plane, Bell, ImageIcon, Map, Crown } from "lucide-react";

import { AdminHeader } from "./_components/AdminHeader";
import { AdminAccessDenied } from "./_components/AdminAccessDenied";
import { AdminSkeleton } from "./_components/skeletons";
import { AircraftImagesTab } from "./_components/AircraftImagesTab";
import { MissingNotificationsTab } from "./_components/MissingNotificationsTab";
import { AirportChartsTab } from "./_components/AirportChartsTab";
import { ProManagementTab } from "./_components/ProManagementTab";

type MainTab = "images" | "charts" | "notifications" | "pro";

export default function AdminPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminCheckDone, setAdminCheckDone] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("images");

  // Queries for counts in tab badges
  const pendingQuery = useQuery(api.aircraftImages.getPending);
  const pendingChartsQuery = useQuery(api.airportCharts.getPending);
  const notificationsQuery = useQuery(api.missingImageNotifications.getAll);

  const pendingCount = pendingQuery?.length ?? 0;
  const pendingChartsCount = pendingChartsQuery?.length ?? 0;
  const notificationsCount = notificationsQuery?.length ?? 0;

  const loading = !adminCheckDone || pendingQuery === undefined || pendingChartsQuery === undefined || notificationsQuery === undefined;

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

  if (!isLoaded || loading) {
    return <AdminSkeleton />;
  }

  if (!isSignedIn || !isAdminUser) {
    return <AdminAccessDenied />;
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
        <div className="mb-6 flex items-center gap-2 border-b border-white/10 pb-4 flex-wrap">
          <button
            onClick={() => setMainTab("images")}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
              mainTab === "images" ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            Aircraft Images
            {pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">{pendingCount}</span>
            )}
          </button>
          <button
            onClick={() => setMainTab("charts")}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
              mainTab === "charts" ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <Map className="h-4 w-4" />
            Airport Charts
            {pendingChartsCount > 0 && (
              <span className="ml-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">{pendingChartsCount}</span>
            )}
          </button>
          <button
            onClick={() => setMainTab("notifications")}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
              mainTab === "notifications" ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <Bell className="h-4 w-4" />
            Missing Notifications
            <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-400">{notificationsCount}</span>
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setMainTab("pro")}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all ${
                mainTab === "pro" ? "bg-yellow-500/20 text-yellow-400" : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              <Crown className="h-4 w-4" />
              Pro
            </button>
          )}
        </div>

        {mainTab === "images" && <AircraftImagesTab />}
        {mainTab === "charts" && <AirportChartsTab />}
        {mainTab === "notifications" && <MissingNotificationsTab />}
        {mainTab === "pro" && <ProManagementTab />}
      </main>
    </div>
  );
}
