"use client";

import { ModalShell } from "~/components/ui/modal-shell";
import { SiteFooter } from "~/components/site/SiteFooter";
import { SiteHeader } from "~/components/site/SiteHeader";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Fragment, useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import {
  createAircraftImage,
  validateUploadEligibility,
} from "~/app/actions/aircraft-images";
import {
  ImageUploader,
  type ImageUploaderRef,
} from "~/components/ui/image-uploader";
import { GoogleSignInButton } from "~/components/auth/GoogleSignInButton";

import {
  Upload,
  Plane,
  Check,
  Search,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { UserAuth } from "~/components/atc/userAuth";
import { Analytics } from "~/lib/analytics";
import { SystemThemeLogo } from "~/components/ui/SystemThemeLogo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import Link from "next/link";
import { AdSenseInContent } from "~/components/ads/AdSenseInContent";

type SubmitStage =
  | "idle"
  | "validating"
  | "uploading"
  | "submitting"
  | "success";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const ALL_AIRLINES_VALUE = "__all_airlines__";
const ALL_AIRCRAFT_VALUE = "__all_aircraft__";

export default function AircraftImagesClient({
  initialImages,
}: {
  initialImages: FunctionReturnType<typeof api.aircraftImages.getApproved>;
}) {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  // Real-time query - auto-updates when data changes in Convex
  const imagesQuery = useQuery(api.aircraftImages.getApproved);
  const images = useMemo(
    () => imagesQuery ?? initialImages,
    [imagesQuery, initialImages],
  );
  const hasFullGallery = imagesQuery !== undefined;

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [airlineFilter, setAirlineFilter] = useState("");
  const [aircraftFilter, setAircraftFilter] = useState("");
  const clearAllFilters = () => {
    setSearchQuery("");
    setAirlineFilter("");
    setAircraftFilter("");
  };
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMilitary, setIsMilitary] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"airlineIata" | "airlineIcao" | "aircraftType", string>>
  >({});
  const [formData, setFormData] = useState({
    airlineIata: "",
    airlineIcao: "",
    aircraftType: "",
    imageUrl: "",
    imageKey: "",
  });

  // Clear a field's error as soon as the user fills it in.
  useEffect(() => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(prev) as (keyof typeof prev)[]) {
        if (formData[key]) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [formData]);

  // Track page view
  useEffect(() => {
    document.cookie = "radarthing_discord=; Max-Age=0; path=/; SameSite=Lax";
    Analytics.imageGalleryViewed();
  }, []);
  const [submitStage, setSubmitStage] = useState<SubmitStage>("idle");
  const [error, setError] = useState<string | null>(null);

  // Once every highlighted field is fixed, drop the summary banner too.
  useEffect(() => {
    if (Object.keys(fieldErrors).length === 0)
      setError((current) =>
        current === "Fix the highlighted fields." ? null : current,
      );
  }, [fieldErrors]);
  const [hasSelectedFile, setHasSelectedFile] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
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
    return Array.from(airlinesMap.values()).sort((a, b) =>
      a.iata.localeCompare(b.iata),
    );
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
    if (
      airlineFilter &&
      !uniqueAirlines.some((a) => a.iata === airlineFilter)
    ) {
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
        const airlineCompare = (a.airlineIata || "").localeCompare(
          b.airlineIata || "",
        );
        if (airlineCompare !== 0) return airlineCompare;
        return (a.aircraftType || "").localeCompare(b.aircraftType || "");
      });
  }, [images, searchQuery, airlineFilter, aircraftFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredImages.length / pageSize));
  const paginatedImages = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredImages.slice(start, start + pageSize);
  }, [currentPage, filteredImages, pageSize]);
  const pageStart =
    filteredImages.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filteredImages.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, airlineFilter, aircraftFilter, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Handle upload complete callback from ImageUploader
  const handleUploadComplete = (url: string, key: string) => {
    uploadedDataRef.current = { url, key };
    setFormData((prev) => ({ ...prev, imageUrl: url, imageKey: key }));
  };

  type UploadField = "airlineIata" | "airlineIcao" | "aircraftType";

  async function handleUploadAndSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate every field up front and show each problem next to its field.
    const errors: Partial<Record<UploadField, string>> = {};
    if (isMilitary) {
      if (!formData.airlineIcao)
        errors.airlineIcao = "Enter the air force, e.g. USAF or PAF.";
    } else {
      if (!formData.airlineIata)
        errors.airlineIata = "Enter the airline's 2-letter IATA code.";
      else if (!/^[A-Z0-9]{2}$/.test(formData.airlineIata))
        errors.airlineIata = "IATA codes are 2 characters, e.g. BA.";
      if (!formData.airlineIcao)
        errors.airlineIcao = "Enter the airline's 3-letter ICAO code.";
      else if (!/^[A-Z]{3}$/.test(formData.airlineIcao))
        errors.airlineIcao = "ICAO codes are 3 letters, e.g. BAW.";
    }
    if (!formData.aircraftType)
      errors.aircraftType = "Enter the aircraft type, e.g. A320.";
    setFieldErrors(errors);
    const firstInvalid = (
      ["airlineIata", "airlineIcao", "aircraftType"] as const
    ).find((field) => errors[field]);
    if (firstInvalid) {
      setError("Fix the highlighted fields.");
      const fieldIds: Partial<Record<UploadField, string>> = isMilitary
        ? { airlineIcao: "upload-field-1", aircraftType: "upload-field-2" }
        : {
            airlineIata: "upload-field-3",
            airlineIcao: "upload-field-4",
            aircraftType: "upload-field-5",
          };
      const firstId = fieldIds[firstInvalid];
      if (firstId)
        requestAnimationFrame(() => document.getElementById(firstId)?.focus());
      return;
    }
    if (!hasSelectedFile) {
      setError("Choose an image to upload.");
      return;
    }
    if (!rightsConfirmed) {
      setError("Confirm that you have permission to share this image.");
      return;
    }

    setError(null);
    uploadedDataRef.current = null;

    const effectiveIata = isMilitary ? "MIL" : formData.airlineIata;

    // Track upload start
    Analytics.imageUploadStarted({
      airlineIata: effectiveIata,
      airlineIcao: formData.airlineIcao,
      aircraftType: formData.aircraftType,
    });

    // Stage 1: Validating
    setSubmitStage("validating");
    const validation = await validateUploadEligibility({
      airlineIata: effectiveIata,
      airlineIcao: formData.airlineIcao,
      aircraftType: formData.aircraftType,
      isMilitary,
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
      airlineIata: effectiveIata,
      airlineIcao: formData.airlineIcao,
      aircraftType: formData.aircraftType,
      imageUrl,
      imageKey,
      isMilitary,
      rightsConfirmed,
    });

    if (result.success) {
      // Track upload completion
      Analytics.imageUploadCompleted({
        airlineIata: effectiveIata,
        airlineIcao: formData.airlineIcao,
        aircraftType: formData.aircraftType,
      });

      // Stage 4: Success animation
      setSubmitStage("success");

      // Close modal after animation
      setTimeout(() => {
        toast.success("Image submitted for review!");
        setShowUploadModal(false);
        setSubmitStage("idle");
        setHasSelectedFile(false);
        setRightsConfirmed(false);
        uploadedDataRef.current = null;
        uploaderRef.current?.reset();
        setIsMilitary(false);
        setFormData({
          airlineIata: "",
          airlineIcao: "",
          aircraftType: "",
          imageUrl: "",
          imageKey: "",
        });
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
            Validating…
          </>
        );
      case "uploading":
        return (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Uploading image…
          </>
        );
      case "submitting":
        return (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Submitting…
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

  const closeUploadModal = () => {
    if (isProcessing) return; // Don't allow closing during processing
    setFieldErrors({});
    setShowUploadModal(false);
    setError(null);
    setSubmitStage("idle");
    setHasSelectedFile(false);
    setRightsConfirmed(false);
    uploadedDataRef.current = null;
    uploaderRef.current?.reset();
    setFormData({
      airlineIata: "",
      airlineIcao: "",
      aircraftType: "",
      imageUrl: "",
      imageKey: "",
    });
  };

  return (
    <div className="aircraft-images-theme-surface bg-site min-h-screen text-white">
      <SiteHeader tone="themed" />

      <main
        id="main-content"
        className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12"
      >
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 sm:px-4">
              <Plane className="h-4 w-4 text-cyan-400" />
              <span className="font-mono text-xs text-cyan-400 sm:text-sm">
                Aircraft gallery
              </span>
            </div>
            <h1 className="text-3xl leading-tight font-bold text-white sm:text-4xl">
              Aircraft images
            </h1>
            <p className="mt-2 max-w-xl text-slate-400">
              Browse aircraft images contributed by GeoFS pilots. Search by
              airline or aircraft type to find the livery you want to see on the
              radar.
            </p>
          </div>
          {isSignedIn ? (
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-300 hover:shadow-cyan-500/40 sm:w-auto sm:px-6"
            >
              <Upload className="h-5 w-5" />
              Upload image
            </button>
          ) : (
            <GoogleSignInButton>
              <button className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-300 hover:shadow-cyan-500/40 sm:w-auto sm:px-6">
                <Upload className="h-5 w-5" />
                Sign in to Upload
              </button>
            </GoogleSignInButton>
          )}
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Search aircraft images by airline, aircraft type or Discord username"
              placeholder="Search by airline, aircraft type or Discord username…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 py-2.5 pr-4 pl-10 text-sm text-white placeholder-slate-500 transition-all outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Select
              value={airlineFilter || ALL_AIRLINES_VALUE}
              onValueChange={(value) =>
                setAirlineFilter(value === ALL_AIRLINES_VALUE ? "" : value)
              }
            >
              <SelectTrigger className="h-11 w-full min-w-0 rounded-lg border-white/10 bg-black/40 font-mono text-sm text-white shadow-none hover:bg-white/[0.06] focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/20">
                <SelectValue placeholder="All airlines" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#0d1218] text-white shadow-2xl">
                <SelectItem
                  value={ALL_AIRLINES_VALUE}
                  className="font-mono text-sm text-slate-200 focus:bg-cyan-500/10 focus:text-cyan-200"
                >
                  All airlines
                </SelectItem>
                {uniqueAirlines.map((airline) => (
                  <SelectItem
                    key={airline.iata}
                    value={airline.iata}
                    className="font-mono text-sm text-slate-200 focus:bg-cyan-500/10 focus:text-cyan-200"
                  >
                    {airline.icao
                      ? `${airline.icao} | ${airline.iata}`
                      : airline.iata}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={aircraftFilter || ALL_AIRCRAFT_VALUE}
              onValueChange={(value) =>
                setAircraftFilter(value === ALL_AIRCRAFT_VALUE ? "" : value)
              }
            >
              <SelectTrigger className="h-11 w-full min-w-0 rounded-lg border-white/10 bg-black/40 font-mono text-sm text-white shadow-none hover:bg-white/[0.06] focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/20">
                <SelectValue placeholder="All aircraft" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#0d1218] text-white shadow-2xl">
                <SelectItem
                  value={ALL_AIRCRAFT_VALUE}
                  className="font-mono text-sm text-slate-200 focus:bg-cyan-500/10 focus:text-cyan-200"
                >
                  All aircraft
                </SelectItem>
                {uniqueAircraftTypes.map((type) => (
                  <SelectItem
                    key={type}
                    value={type}
                    className="font-mono text-sm text-slate-200 focus:bg-cyan-500/10 focus:text-cyan-200"
                  >
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(searchQuery || airlineFilter || aircraftFilter) && (
              <button
                onClick={clearAllFilters}
                className="cursor-pointer rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-slate-400 transition-all hover:border-red-500/30 hover:text-red-400"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Results and pagination controls */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-400">
            {!hasFullGallery
              ? "Showing approved images while the full gallery loads"
              : searchQuery || airlineFilter || aircraftFilter
                ? `Showing ${pageStart}-${pageEnd} of ${filteredImages.length} filtered images (${images.length} total)`
                : `Showing ${pageStart}-${pageEnd} of ${filteredImages.length} images`}
          </p>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-sm text-slate-400">Per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) =>
                setPageSize(Number(value) as (typeof PAGE_SIZE_OPTIONS)[number])
              }
            >
              <SelectTrigger className="h-10 min-w-[84px] rounded-lg border-white/10 bg-black/40 font-mono text-sm text-white shadow-none hover:bg-white/[0.06] focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#0d1218] text-white shadow-2xl">
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem
                    key={option}
                    value={String(option)}
                    className="font-mono text-sm text-slate-200 focus:bg-cyan-500/10 focus:text-cyan-200"
                  >
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredImages.length === 0 && images.length > 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
            <Search className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <h3 className="mb-2 text-xl font-semibold text-white">
              No images match your filters
            </h3>
            <p className="text-slate-300">
              Try a different search, or clear the filters to see every image.
            </p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-5 cursor-pointer rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
            >
              Clear filters
            </button>
          </div>
        ) : images.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
            <Plane className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <h3 className="mb-2 text-xl font-semibold text-white">
              No images yet
            </h3>
            <p className="text-slate-400">
              Be the first to add one: upload a photo of an aircraft in its
              airline&apos;s livery.
            </p>
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="mt-5 cursor-pointer rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:outline-none"
            >
              Upload an image
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedImages.map((image, index) => (
                <Fragment key={image.id}>
                  {/* Ad sits after the first row of real content, not first. */}
                  {index === 3 && <AdSenseInContent placement="gallery-card" />}
                  <div className="group overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl transition-all hover:border-cyan-500/30">
                    <div className="relative aspect-video">
                      <Image
                        src={image.imageUrl}
                        alt={`${[image.airlineIata, image.airlineIcao].find((code) => code && code !== "-") ?? "Aircraft"} ${image.aircraftType}`}
                        fill
                        sizes="(min-width: 1024px) 352px, (min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                        // Community uploads can come from hosts outside
                        // next.config's image allow-list, so skip the optimizer.
                        unoptimized
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {image.airlineIata && image.airlineIata !== "-" && (
                          <span className="rounded-md bg-cyan-500/20 px-2 py-1 font-mono text-sm font-bold text-cyan-400">
                            {image.airlineIata}
                          </span>
                        )}
                        {image.airlineIcao && image.airlineIcao !== "-" && (
                          <span className="rounded-md bg-blue-500/20 px-2 py-1 font-mono text-sm font-bold text-blue-400">
                            {image.airlineIcao}
                          </span>
                        )}
                        <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-sm text-white">
                          {image.aircraftType}
                        </span>
                        <Check
                          className="ml-auto h-4 w-4 text-emerald-400"
                          aria-label="Approved"
                          role="img"
                        />
                      </div>
                      {image.discordUsername && (
                        <p className="mt-2 text-xs text-slate-400">
                          Discord: {image.discordUsername}
                        </p>
                      )}
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-400">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                  <button
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentPage === 1}
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white transition-all hover:border-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white transition-all hover:border-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        <section className="mt-14 grid gap-8 border-t border-white/10 pt-8 text-sm leading-7 text-slate-400 md:grid-cols-2">
          <div>
            <h2 className="mb-2 text-lg font-semibold text-white">
              How images reach the radar
            </h2>
            <p>
              Each image is attached to an airline&apos;s IATA and ICAO codes
              and a base aircraft type, such as B777 or A320. When a pilot flies
              that type with a callsign starting with the airline&apos;s code,
              the radar shows the matching image behind their flight details. A
              moderator reviews every submission before it appears here. Use the
              filters above to check whether a combination is already covered.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-lg font-semibold text-white">
              Contribute an image
            </h2>
            <p>
              Upload a sharp photo of a real aircraft that you have the right to
              share, and use the base model rather than a variant. Approved
              images count towards the Contribution leaderboard. If you see a
              rights issue with an existing image, use our{" "}
              <Link href="/copyright" className="text-cyan-300 hover:underline">
                copyright contact
              </Link>{" "}
              so we can review it.
            </p>
            <Link
              href="/guides/contributing-aircraft-images"
              className="mt-3 inline-block text-cyan-300 hover:underline"
            >
              Read the contribution guidelines
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />

      {/* Upload Modal */}
      {showUploadModal && (
        <ModalShell
          labelledBy="aircraft-upload-title"
          describedBy="aircraft-upload-desc"
          onClose={closeUploadModal}
          closeDisabled={isProcessing}
        >
          <button
            type="button"
            aria-label="Close upload dialog"
            onClick={closeUploadModal}
            disabled={isProcessing}
            className="absolute top-4 right-4 cursor-pointer text-slate-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true">✕</span>
          </button>

          <h2
            id="aircraft-upload-title"
            className="mb-2 text-xl font-bold text-white"
          >
            Upload aircraft image
          </h2>
          <p id="aircraft-upload-desc" className="mb-6 text-sm text-slate-300">
            Your image will be reviewed by our team before appearing in the
            gallery.
          </p>

          <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <div>
                <h3 className="text-sm font-semibold text-amber-100">
                  Image upload rules
                </h3>
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-5 text-amber-50/90 marker:font-mono marker:text-amber-300">
                  <li>Enter the base aircraft model, not a variant.</li>
                  <li>Use a high-quality image.</li>
                  <li>
                    Show the complete aircraft without cropping it, with the
                    livery clearly visible.
                  </li>
                  <li>
                    Make sure the ICAO, IATA, and aircraft name are correct and
                    match the aircraft in the image.
                  </li>
                  <li>Check that the image is not already uploaded.</li>
                  <li>
                    Use a real airline; military uploads must use the correct
                    air force.
                  </li>
                </ol>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleUploadAndSubmit}
            noValidate
            className="space-y-4"
          >
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={isMilitary}
                aria-labelledby="military-aircraft-label"
                className={`relative h-5 w-9 cursor-pointer rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none ${isMilitary ? "bg-cyan-500/40" : "bg-white/12"}`}
                onClick={() => {
                  setIsMilitary(!isMilitary);
                  setFormData((prev) => ({
                    ...prev,
                    airlineIata: "",
                    airlineIcao: "",
                  }));
                }}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-slate-200 transition-[left] ${isMilitary ? "left-[18px]" : "left-0.5"}`}
                />
              </button>
              <span
                id="military-aircraft-label"
                className="font-mono text-xs text-slate-300"
              >
                Military aircraft
              </span>
            </div>

            {isMilitary ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="upload-field-1"
                    className="mb-2 block font-mono text-xs text-slate-300"
                  >
                    Air force *
                  </label>
                  <input
                    id="upload-field-1"
                    aria-invalid={Boolean(fieldErrors.airlineIcao)}
                    aria-describedby={
                      fieldErrors.airlineIcao
                        ? "upload-field-1-error"
                        : undefined
                    }
                    type="text"
                    value={formData.airlineIcao}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        airlineIcao: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g., USAF"
                    maxLength={10}
                    required
                    disabled={isProcessing}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 transition-all outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:opacity-50 aria-[invalid=true]:border-red-400/70"
                  />
                  {fieldErrors.airlineIcao && (
                    <p
                      id="upload-field-1-error"
                      className="mt-1 text-xs text-red-300"
                    >
                      {fieldErrors.airlineIcao}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="upload-field-2"
                    className="mb-2 block font-mono text-xs text-slate-300"
                  >
                    Aircraft *
                  </label>
                  <input
                    id="upload-field-2"
                    aria-invalid={Boolean(fieldErrors.aircraftType)}
                    aria-describedby={
                      fieldErrors.aircraftType
                        ? "upload-field-2-error"
                        : undefined
                    }
                    type="text"
                    value={formData.aircraftType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        aircraftType: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="F16"
                    maxLength={10}
                    required
                    disabled={isProcessing}
                    title="Use base model only (e.g., F16, C130)"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 transition-all outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:opacity-50 aria-[invalid=true]:border-red-400/70"
                  />
                  {fieldErrors.aircraftType && (
                    <p
                      id="upload-field-2-error"
                      className="mt-1 text-xs text-red-300"
                    >
                      {fieldErrors.aircraftType}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="upload-field-3"
                    className="mb-2 block font-mono text-xs text-slate-300"
                  >
                    IATA code *
                  </label>
                  <input
                    id="upload-field-3"
                    aria-invalid={Boolean(fieldErrors.airlineIata)}
                    aria-describedby={
                      fieldErrors.airlineIata
                        ? "upload-field-3-error"
                        : undefined
                    }
                    type="text"
                    value={formData.airlineIata}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        airlineIata: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g., EK"
                    maxLength={2}
                    required
                    disabled={isProcessing}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 transition-all outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:opacity-50 aria-[invalid=true]:border-red-400/70"
                  />
                  {fieldErrors.airlineIata && (
                    <p
                      id="upload-field-3-error"
                      className="mt-1 text-xs text-red-300"
                    >
                      {fieldErrors.airlineIata}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="upload-field-4"
                    className="mb-2 block font-mono text-xs text-slate-300"
                  >
                    ICAO code *
                  </label>
                  <input
                    id="upload-field-4"
                    aria-invalid={Boolean(fieldErrors.airlineIcao)}
                    aria-describedby={
                      fieldErrors.airlineIcao
                        ? "upload-field-4-error"
                        : undefined
                    }
                    type="text"
                    value={formData.airlineIcao}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        airlineIcao: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g., UAE"
                    maxLength={3}
                    required
                    disabled={isProcessing}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 transition-all outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:opacity-50 aria-[invalid=true]:border-red-400/70"
                  />
                  {fieldErrors.airlineIcao && (
                    <p
                      id="upload-field-4-error"
                      className="mt-1 text-xs text-red-300"
                    >
                      {fieldErrors.airlineIcao}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="upload-field-5"
                    className="mb-2 block font-mono text-xs text-slate-300"
                  >
                    Aircraft *
                  </label>
                  <input
                    id="upload-field-5"
                    aria-invalid={Boolean(fieldErrors.aircraftType)}
                    aria-describedby={
                      fieldErrors.aircraftType
                        ? "upload-field-5-error"
                        : undefined
                    }
                    type="text"
                    value={formData.aircraftType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        aircraftType: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="B777"
                    maxLength={10}
                    required
                    disabled={isProcessing}
                    title="Use base model only (e.g., B777, A350) — not variants"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 transition-all outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:opacity-50 aria-[invalid=true]:border-red-400/70"
                  />
                  {fieldErrors.aircraftType && (
                    <p
                      id="upload-field-5-error"
                      className="mt-1 text-xs text-red-300"
                    >
                      {fieldErrors.aircraftType}
                    </p>
                  )}
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400">
              {isMilitary
                ? "Enter the air force name (e.g., USAF, PAF, RAF) and aircraft model."
                : "Aircraft should be base model only, not the varient. Like: B777. Not: B77W."}
            </p>

            <div>
              <label className="mb-2 block font-mono text-xs text-slate-400">
                Select image
              </label>
              <ImageUploader
                ref={uploaderRef}
                airlineIata={isMilitary ? "MIL" : formData.airlineIata}
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

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm leading-5 text-slate-300">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(event) => setRightsConfirmed(event.target.checked)}
                required
                disabled={isProcessing}
                className="mt-0.5 h-4 w-4 accent-cyan-400"
              />
              <span>
                I created this image or have permission to upload and share it,
                and it follows the{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-cyan-300 hover:underline"
                >
                  submission terms
                </Link>
                .
              </span>
            </label>

            {/* Success overlay is rendered outside the form */}

            <button
              type="submit"
              disabled={
                isProcessing ||
                !hasSelectedFile ||
                !rightsConfirmed ||
                submitStage === "success"
              }
              className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold text-slate-950 shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                submitStage === "success"
                  ? "bg-gradient-to-r from-emerald-500 to-green-500 shadow-emerald-500/20"
                  : "bg-cyan-400 text-slate-950 shadow-cyan-500/20 hover:bg-cyan-300 hover:shadow-cyan-500/40"
              }`}
            >
              {getButtonContent()}
            </button>
          </form>

          {/* Success Overlay — covers entire modal */}
          {submitStage === "success" && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-[#0a0f14]">
              {/* Radar sweep glow */}
              <div className="pointer-events-none absolute inset-0">
                <div
                  className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 animate-[radarSweep_2s_linear_infinite] rounded-full opacity-30"
                  style={{
                    background:
                      "conic-gradient(from 0deg, transparent 0deg, rgba(34,211,238,0.4) 40deg, transparent 80deg)",
                  }}
                />
              </div>

              {/* Concentric radar rings */}
              <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="absolute -inset-12 rounded-full border border-cyan-500/10" />
                <div className="absolute -inset-20 rounded-full border border-cyan-500/[0.06]" />
                <div className="absolute -inset-28 rounded-full border border-cyan-500/[0.03]" />
              </div>

              {/* Animated plane flyover */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div
                  className="absolute top-[38%] animate-[planePass_1.8s_cubic-bezier(0.4,0,0.2,1)_0.2s_forwards]"
                  style={{ left: "-40px", opacity: 0 }}
                >
                  <Plane className="h-5 w-5 -rotate-12 text-cyan-400/70" />
                </div>
                {/* Contrail */}
                <div className="absolute top-[38%] mt-2.5 h-px w-0 animate-[contrail_1.8s_cubic-bezier(0.4,0,0.2,1)_0.2s_forwards] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
              </div>

              {/* Center content */}
              <div
                className="relative z-10 flex animate-[fadeInUp_0.5s_ease-out_forwards] flex-col items-center"
                style={{ opacity: 0 }}
              >
                {/* Ping rings */}
                <div className="relative mb-5">
                  <div className="absolute inset-0 animate-[ping_1.2s_ease-out_forwards] rounded-full border-2 border-cyan-400/40" />
                  <div className="absolute inset-0 animate-[ping_1.2s_ease-out_0.25s_forwards] rounded-full border border-cyan-400/20" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 shadow-[0_0_40px_rgba(34,211,238,0.15)]">
                    <Plane className="h-9 w-9 text-cyan-400" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="text-lg font-semibold text-emerald-400">
                    Cleared for review!
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-slate-400">
                  Your image is now in the queue
                </p>
              </div>

              <style jsx>{`
                @keyframes radarSweep {
                  from {
                    transform: translate(-50%, -50%) rotate(0deg);
                  }
                  to {
                    transform: translate(-50%, -50%) rotate(360deg);
                  }
                }
                @keyframes planePass {
                  0% {
                    transform: translateX(0);
                    opacity: 0;
                  }
                  10% {
                    opacity: 0.7;
                  }
                  90% {
                    opacity: 0.7;
                  }
                  100% {
                    transform: translateX(calc(100vw + 80px));
                    opacity: 0;
                  }
                }
                @keyframes contrail {
                  0% {
                    width: 0;
                    opacity: 0;
                  }
                  10% {
                    opacity: 0.5;
                  }
                  100% {
                    width: 100%;
                    opacity: 0;
                  }
                }
                @keyframes ping {
                  0% {
                    transform: scale(1);
                    opacity: 1;
                  }
                  100% {
                    transform: scale(2.8);
                    opacity: 0;
                  }
                }
                @keyframes fadeInUp {
                  0% {
                    transform: translateY(12px);
                    opacity: 0;
                  }
                  100% {
                    transform: translateY(0);
                    opacity: 1;
                  }
                }
              `}</style>
            </div>
          )}
        </ModalShell>
      )}
    </div>
  );
}
