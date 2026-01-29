"use client";

import { useRouter } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { createAircraftImage, validateUploadEligibility } from "~/app/actions/aircraft-images";
import { ImageUploader, type ImageUploaderRef } from "~/components/ui/image-uploader";

// Cookie helpers
function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(";").shift() || "");
  return "";
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}
import { Upload, Plane, Check, Search, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { UserAuth } from "~/components/atc/userAuth";

type SubmitStage = "idle" | "validating" | "uploading" | "submitting" | "success";

export default function AircraftImagesPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  // Real-time query - auto-updates when data changes in Convex
  const imagesQuery = useQuery(api.aircraftImages.getApproved);
  const images = useMemo(() => imagesQuery ?? [], [imagesQuery]);
  const loading = imagesQuery === undefined;

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [airlineFilter, setAirlineFilter] = useState("");
  const [aircraftFilter, setAircraftFilter] = useState("");
  const [formData, setFormData] = useState({
    airlineIata: "",
    airlineIcao: "",
    aircraftType: "",
    imageUrl: "",
    imageKey: "",
    discordUsername: "",
  });

  // Load Discord username from cookie on mount
  useEffect(() => {
    const savedUsername = getCookie("radarthing_discord");
    if (savedUsername) {
      setFormData((prev) => ({ ...prev, discordUsername: savedUsername }));
    }
  }, []);
  const [submitStage, setSubmitStage] = useState<SubmitStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hasSelectedFile, setHasSelectedFile] = useState(false);
  const uploaderRef = useRef<ImageUploaderRef>(null);
  const uploadedDataRef = useRef<{ url: string; key: string } | null>(null);

  // Helper to check if image matches search query
  const matchesSearch = (image: (typeof images)[number], query: string) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      image.airlineIata?.toLowerCase().includes(q) ||
      image.airlineIcao?.toLowerCase().includes(q) ||
      image.aircraftType?.toLowerCase().includes(q) ||
      image.discordUsername?.toLowerCase().includes(q)
    );
  };

  // Get unique airlines based on search and aircraft filter
  const uniqueAirlines = useMemo(() => {
    const airlinesMap = new Map<string, { iata: string; icao: string }>();
    images.forEach((img) => {
      if (!img.airlineIata) return;
      // Apply search filter
      if (!matchesSearch(img, searchQuery)) return;
      // Apply aircraft filter (but not airline filter)
      if (aircraftFilter && img.aircraftType !== aircraftFilter) return;
      if (!airlinesMap.has(img.airlineIata)) {
        airlinesMap.set(img.airlineIata, {
          iata: img.airlineIata,
          icao: img.airlineIcao || "",
        });
      }
    });
    return Array.from(airlinesMap.values()).sort((a, b) => a.iata.localeCompare(b.iata));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, searchQuery, aircraftFilter]);

  // Get unique aircraft types based on search and airline filter
  const uniqueAircraftTypes = useMemo(() => {
    const types = new Set<string>();
    images.forEach((img) => {
      if (!img.aircraftType) return;
      // Apply search filter
      if (!matchesSearch(img, searchQuery)) return;
      // Apply airline filter (but not aircraft filter)
      if (airlineFilter && img.airlineIata !== airlineFilter) return;
      types.add(img.aircraftType);
    });
    return Array.from(types).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, searchQuery, airlineFilter]);

  // Clear filters if selected value is no longer available
  useEffect(() => {
    if (airlineFilter && !uniqueAirlines.some((a) => a.iata === airlineFilter)) {
      setAirlineFilter("");
    }
  }, [uniqueAirlines, airlineFilter]);

  useEffect(() => {
    if (aircraftFilter && !uniqueAircraftTypes.includes(aircraftFilter)) {
      setAircraftFilter("");
    }
  }, [uniqueAircraftTypes, aircraftFilter]);

  // Filter images based on search and filters
  const filteredImages = useMemo(() => {
    return images
      .filter((image) => {
        // Airline filter
        if (airlineFilter && image.airlineIata !== airlineFilter) {
          return false;
        }
        // Aircraft type filter
        if (aircraftFilter && image.aircraftType !== aircraftFilter) {
          return false;
        }
        // Search query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const matchesSearch =
            image.airlineIata?.toLowerCase().includes(query) ||
            image.airlineIcao?.toLowerCase().includes(query) ||
            image.aircraftType?.toLowerCase().includes(query) ||
            image.discordUsername?.toLowerCase().includes(query);
          if (!matchesSearch) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by airline IATA, then by aircraft type
        const airlineCompare = (a.airlineIata || "").localeCompare(b.airlineIata || "");
        if (airlineCompare !== 0) return airlineCompare;
        return (a.aircraftType || "").localeCompare(b.aircraftType || "");
      });
  }, [images, searchQuery, airlineFilter, aircraftFilter]);

  // Handle upload complete callback from ImageUploader
  const handleUploadComplete = (url: string, key: string) => {
    uploadedDataRef.current = { url, key };
    setFormData(prev => ({ ...prev, imageUrl: url, imageKey: key }));
  };

  async function handleUploadAndSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Basic validation
    if (!hasSelectedFile) {
      toast.error("Please select an image first");
      setError("Please select an image first");
      return;
    }
    if (!formData.airlineIata || !formData.airlineIcao) {
      toast.error("Both IATA and ICAO airline codes are required");
      setError("Both IATA and ICAO airline codes are required");
      return;
    }
    if (!formData.aircraftType) {
      toast.error("Aircraft type is required");
      setError("Aircraft type is required");
      return;
    }

    setError(null);
    uploadedDataRef.current = null;

    // Stage 1: Validating
    setSubmitStage("validating");
    const validation = await validateUploadEligibility({
      airlineIata: formData.airlineIata,
      airlineIcao: formData.airlineIcao,
      aircraftType: formData.aircraftType,
    });

    if (!validation.canUpload) {
      setError(validation.error || "Validation failed");
      toast.error(validation.error || "Validation failed");
      setSubmitStage("idle");
      return;
    }

    // Stage 2: Uploading
    setSubmitStage("uploading");
    const uploadSuccess = await uploaderRef.current?.triggerUpload();

    // uploadedDataRef.current is set by the onUploadComplete callback during triggerUpload
    if (!uploadSuccess || !uploadedDataRef.current) {
      setError("Failed to upload image");
      setSubmitStage("idle");
      return;
    }

    // Extract the uploaded data (TypeScript needs this after the null check)
    const { url: imageUrl, key: imageKey } = uploadedDataRef.current;

    // Stage 3: Submitting
    setSubmitStage("submitting");
    const result = await createAircraftImage({
      airlineIata: formData.airlineIata,
      airlineIcao: formData.airlineIcao,
      aircraftType: formData.aircraftType,
      imageUrl,
      imageKey,
      discordUsername: formData.discordUsername || undefined,
    });

    if (result.success) {
      // Save Discord username to cookie for next time
      if (formData.discordUsername) {
        setCookie("radarthing_discord", formData.discordUsername);
      }

      // Stage 4: Success animation
      setSubmitStage("success");

      // Close modal after animation
      setTimeout(() => {
        toast.success("Image submitted for review!");
        setShowUploadModal(false);
        setSubmitStage("idle");
        setHasSelectedFile(false);
        uploadedDataRef.current = null;
        uploaderRef.current?.reset();
        // Keep Discord username when resetting form
        setFormData((prev) => ({
          airlineIata: "",
          airlineIcao: "",
          aircraftType: "",
          imageUrl: "",
          imageKey: "",
          discordUsername: prev.discordUsername,
        }));
      }, 1500);
    } else {
      toast.error(result.error || "Failed to submit image");
      setError(result.error || "Failed to submit image");
      setSubmitStage("idle");
    }
  }

  const getButtonContent = () => {
    switch (submitStage) {
      case "validating":
        return (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Validating...
          </>
        );
      case "uploading":
        return (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Uploading Image...
          </>
        );
      case "submitting":
        return (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Submitting...
          </>
        );
      case "success":
        return (
          <>
            <CheckCircle2 className="h-5 w-5" />
            Success!
          </>
        );
      default:
        return (
          <>
            <Upload className="h-5 w-5" />
            Upload & Submit
          </>
        );
    }
  };

  const isProcessing = submitStage !== "idle" && submitStage !== "success";

  if (!isLoaded || loading) {
    return <GallerySkeleton />;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <button
            onClick={() => router.push("/")}
            className="cursor-pointer font-mono text-xl text-cyan-400"
          >
            <Image src="/logo-white.svg" alt="RadarThing" width={100} height={30} />
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="cursor-pointer text-sm text-slate-400 transition-colors hover:text-white"
            >
              Back to Map
            </button>
            {isSignedIn ? <UserAuth /> : (
              <SignInButton mode="modal">
                <button className="cursor-pointer rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/30">
                  Sign In
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
              <Plane className="h-4 w-4 text-cyan-400" />
              <span className="font-mono text-sm text-cyan-400">AIRCRAFT GALLERY</span>
            </div>
            <h1 className="text-3xl font-bold text-white">Aircraft Images</h1>
            <p className="mt-2 text-slate-400">
              Community-contributed aircraft photos. Upload your own!
            </p>
          </div>
          {isSignedIn ? (
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40"
            >
              <Upload className="h-5 w-5" />
              Upload Image
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40">
                <Upload className="h-5 w-5" />
                Sign in to Upload
              </button>
            </SignInButton>
          )}
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by airline, aircraft type, discord username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-500/50"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={airlineFilter}
              onChange={(e) => setAirlineFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/50"
            >
              <option value="">All Airlines</option>
              {uniqueAirlines.map((airline) => (
                <option key={airline.iata} value={airline.iata}>
                  {airline.icao ? `${airline.icao} | ${airline.iata}` : airline.iata}
                </option>
              ))}
            </select>
            <select
              value={aircraftFilter}
              onChange={(e) => setAircraftFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/50"
            >
              <option value="">All Aircraft</option>
              {uniqueAircraftTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {(searchQuery || airlineFilter || aircraftFilter) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setAirlineFilter("");
                  setAircraftFilter("");
                }}
                className="cursor-pointer rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-slate-400 transition-all hover:border-red-500/30 hover:text-red-400"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        {(searchQuery || airlineFilter || aircraftFilter) && (
          <p className="mb-4 text-sm text-slate-400">
            Showing {filteredImages.length} of {images.length} images
          </p>
        )}

        {filteredImages.length === 0 && images.length > 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
            <Search className="mx-auto mb-4 h-12 w-12 text-slate-600" />
            <h3 className="mb-2 text-xl font-semibold text-white">No Results Found</h3>
            <p className="text-slate-400">Try adjusting your search or filters</p>
          </div>
        ) : images.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
            <Plane className="mx-auto mb-4 h-12 w-12 text-slate-600" />
            <h3 className="mb-2 text-xl font-semibold text-white">No Images Yet</h3>
            <p className="text-slate-400">Be the first to contribute an aircraft image!</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredImages.map((image) => (
              <div
                key={image.id}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl transition-all hover:border-cyan-500/30"
              >
                <div className="relative aspect-video">
                  <Image
                    src={image.imageUrl}
                    alt={`${image.airlineIata || image.airlineIcao} ${image.aircraftType}`}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {image.airlineIata && (
                      <span className="rounded-md bg-cyan-500/20 px-2 py-1 font-mono text-sm font-bold text-cyan-400">
                        {image.airlineIata}
                      </span>
                    )}
                    {image.airlineIcao && (
                      <span className="rounded-md bg-blue-500/20 px-2 py-1 font-mono text-sm font-bold text-blue-400">
                        {image.airlineIcao}
                      </span>
                    )}
                    <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-sm text-white">
                      {image.aircraftType}
                    </span>
                    <Check className="ml-auto h-4 w-4 text-emerald-400" />
                  </div>
                  {image.discordUsername && (
                    <p className="mt-2 text-xs text-slate-500">
                      Discord: {image.discordUsername}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a0f14] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                if (isProcessing) return; // Don't allow closing during processing
                setShowUploadModal(false);
                setError(null);
                setSubmitStage("idle");
                setHasSelectedFile(false);
                uploadedDataRef.current = null;
                uploaderRef.current?.reset();
                // Keep Discord username when closing modal
                setFormData((prev) => ({
                  airlineIata: "",
                  airlineIcao: "",
                  aircraftType: "",
                  imageUrl: "",
                  imageKey: "",
                  discordUsername: prev.discordUsername
                }));
              }}
              disabled={isProcessing}
              className="absolute top-4 right-4 cursor-pointer text-slate-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              ✕
            </button>

            <h2 className="mb-2 text-xl font-bold text-white">Upload Aircraft Image</h2>
            <p className="mb-6 text-sm text-slate-400">
              Your image will be reviewed by our team before appearing in the gallery.
            </p>

            <form onSubmit={handleUploadAndSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="mb-2 block font-mono text-xs text-slate-400">
                      IATA CODE *
                    </label>
                    <input
                      type="text"
                      value={formData.airlineIata}
                      onChange={(e) =>
                        setFormData({ ...formData, airlineIata: e.target.value.toUpperCase() })
                      }
                      placeholder="e.g., EK"
                      maxLength={2}
                      required
                      disabled={isProcessing}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-500/50 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block font-mono text-xs text-slate-400">
                      ICAO CODE *
                    </label>
                    <input
                      type="text"
                      value={formData.airlineIcao}
                      onChange={(e) =>
                        setFormData({ ...formData, airlineIcao: e.target.value.toUpperCase() })
                      }
                      placeholder="e.g., UAE"
                      maxLength={3}
                      required
                      disabled={isProcessing}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-500/50 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block font-mono text-xs text-slate-400">
                      AIRCRAFT *
                    </label>
                    <input
                      type="text"
                      value={formData.aircraftType}
                      onChange={(e) =>
                        setFormData({ ...formData, aircraftType: e.target.value.toUpperCase() })
                      }
                      placeholder="B777"
                      maxLength={10}
                      required
                      disabled={isProcessing}
                      title="Use base model only (e.g., B777, A350) — not variants"
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-500/50 disabled:opacity-50"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Aircraft should be base model only, not the varient. Like: B777. Not: B77W.
                </p>

                <div>
                  <label className="mb-2 block font-mono text-xs text-slate-400">
                    YOUR DISCORD USERNAME (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    value={formData.discordUsername}
                    onChange={(e) =>
                      setFormData({ ...formData, discordUsername: e.target.value })
                    }
                    placeholder="e.g., xyzmani"
                    disabled={isProcessing}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-500/50 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-mono text-xs text-slate-400">
                    SELECT IMAGE
                  </label>
                  <ImageUploader
                    ref={uploaderRef}
                    airlineIata={formData.airlineIata}
                    airlineIcao={formData.airlineIcao}
                    aircraftType={formData.aircraftType}
                    externalUploadTrigger={true}
                    onUploadComplete={handleUploadComplete}
                    onFileSelected={setHasSelectedFile}
                    onError={(err) => {
                      setError(err);
                      setSubmitStage("idle");
                    }}
                  />
                </div>

                {/* Success Animation Overlay - Aviation Themed */}
                {submitStage === "success" && (
                  <div className="relative flex flex-col items-center justify-center overflow-hidden py-6">
                    {/* Animated plane flying across */}
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="animate-[fly_1.5s_ease-out_forwards] absolute left-0 top-1/2 -translate-y-1/2">
                        <Plane className="h-6 w-6 rotate-[-30deg] text-cyan-400" />
                      </div>
                    </div>

                    {/* Contrail effect */}
                    <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 overflow-hidden">
                      <div className="animate-[trail_1.5s_ease-out_forwards] h-full w-0 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
                    </div>

                    {/* Main success icon with radar ping effect */}
                    <div className="relative z-10">
                      <div className="absolute inset-0 animate-[radar_1s_ease-out_forwards] rounded-full border-2 border-cyan-400/50" />
                      <div className="absolute inset-0 animate-[radar_1s_ease-out_0.3s_forwards] rounded-full border-2 border-cyan-400/30" />
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/40">
                        <Plane className="h-8 w-8 text-white" />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <span className="font-semibold text-emerald-400">Cleared for Review!</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">Your image is now in the queue</p>

                    {/* Custom keyframes via style tag */}
                    <style jsx>{`
                      @keyframes fly {
                        0% { transform: translateX(-20px) translateY(-50%) rotate(-30deg); opacity: 0; }
                        20% { opacity: 1; }
                        100% { transform: translateX(calc(100vw + 20px)) translateY(-50%) rotate(-30deg); opacity: 0; }
                      }
                      @keyframes trail {
                        0% { width: 0; opacity: 0; }
                        20% { opacity: 1; }
                        100% { width: 100%; opacity: 0; }
                      }
                      @keyframes radar {
                        0% { transform: scale(1); opacity: 1; }
                        100% { transform: scale(2.5); opacity: 0; }
                      }
                    `}</style>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isProcessing || !hasSelectedFile || submitStage === "success"}
                  className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold text-white shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    submitStage === "success"
                      ? "bg-gradient-to-r from-emerald-500 to-green-500 shadow-emerald-500/20"
                      : "bg-gradient-to-r from-cyan-500 to-blue-500 shadow-cyan-500/20 hover:shadow-cyan-500/40"
                  }`}
                >
                  {getButtonContent()}
                </button>
              </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/10 rounded ${className}`} />;
}

function ImageCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-12 rounded-md" />
          <Skeleton className="h-6 w-12 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="ml-auto h-4 w-4 rounded-full" />
        </div>
        <Skeleton className="h-3 w-32 mt-2" />
      </div>
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Skeleton className="h-8 w-24" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Title */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
              <Plane className="h-4 w-4 text-cyan-400" />
              <span className="font-mono text-sm text-cyan-400">AIRCRAFT GALLERY</span>
            </div>
            <Skeleton className="h-9 w-48 mt-2" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-12 w-36 rounded-xl" />
        </div>

        {/* Search and Filters Skeleton */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
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
