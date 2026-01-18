"use client";

import { useRouter } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useState, useEffect, useMemo } from "react";
import {
  getApprovedAircraftImages,
  createAircraftImage,
  type AircraftImage,
} from "~/app/actions/aircraft-images";
import { Upload, Plane, Check, Clock, Search } from "lucide-react";
import Loading from "~/components/loading";
import Image from "next/image";
import { UserAuth } from "~/components/atc/userAuth";
import { ImageUploader } from "~/components/ui/image-uploader";

export default function AircraftImagesPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<AircraftImage[]>([]);
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
    photographer: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadImages();
  }, []);

  async function loadImages() {
    const data = await getApprovedAircraftImages();
    setImages(data);
    setLoading(false);
  }

  // Helper to check if image matches search query
  const matchesSearch = (image: AircraftImage, query: string) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      image.airlineIata?.toLowerCase().includes(q) ||
      image.airlineIcao?.toLowerCase().includes(q) ||
      image.aircraftType?.toLowerCase().includes(q) ||
      image.photographer?.toLowerCase().includes(q)
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
    return images.filter((image) => {
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
          image.photographer?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      return true;
    });
  }, [images, searchQuery, airlineFilter, aircraftFilter]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.imageUrl) {
      setError("Please upload an image first");
      return;
    }
    if (!formData.airlineIata || !formData.airlineIcao) {
      setError("Both IATA and ICAO airline codes are required");
      return;
    }
    setSubmitting(true);
    setError(null);

    const result = await createAircraftImage({
      airlineIata: formData.airlineIata,
      airlineIcao: formData.airlineIcao,
      aircraftType: formData.aircraftType,
      imageUrl: formData.imageUrl,
      imageKey: formData.imageKey || undefined,
      photographer: formData.photographer || undefined,
    });

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        setShowUploadModal(false);
        setFormData({ airlineIata: "", airlineIcao: "", aircraftType: "", imageUrl: "", imageKey: "", photographer: "" });
        setSuccess(false);
      }, 2000);
    } else {
      setError(result.error || "Failed to submit image");
    }
    setSubmitting(false);
  }

  if (!isLoaded || loading) {
    return <Loading />;
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
              placeholder="Search by airline, aircraft type, photographer..."
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
                  {image.photographer && (
                    <p className="mt-2 text-xs text-slate-500">
                      Photo by {image.photographer}
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
                setShowUploadModal(false);
                setError(null);
                setSuccess(false);
                setFormData({ airlineIata: "", airlineIcao: "", aircraftType: "", imageUrl: "", imageKey: "", photographer: "" });
              }}
              className="absolute top-4 right-4 cursor-pointer text-slate-400 transition-colors hover:text-white"
            >
              ✕
            </button>

            <h2 className="mb-2 text-xl font-bold text-white">Upload Aircraft Image</h2>
            <p className="mb-6 text-sm text-slate-400">
              Your image will be reviewed by our team before appearing in the gallery.
            </p>

            {success ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="mb-4 rounded-full bg-emerald-500/20 p-4">
                  <Clock className="h-8 w-8 text-emerald-400" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">Submitted for Review</h3>
                <p className="text-center text-sm text-slate-400">
                  Your image has been submitted and is pending approval.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
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
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-500/50"
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
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-500/50"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block font-mono text-xs text-slate-400">
                      AIRCRAFT TYPE *
                    </label>
                    <input
                      type="text"
                      value={formData.aircraftType}
                      onChange={(e) =>
                        setFormData({ ...formData, aircraftType: e.target.value.toUpperCase() })
                      }
                      placeholder="e.g., A350"
                      maxLength={10}
                      required
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-500/50"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  IATA is 2 letters (e.g., EK), ICAO is 3 letters (e.g., UAE)
                </p>

                <div>
                  <label className="mb-2 block font-mono text-xs text-slate-400">
                    PHOTOGRAPHER (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    value={formData.photographer}
                    onChange={(e) =>
                      setFormData({ ...formData, photographer: e.target.value })
                    }
                    placeholder="Photo credit"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-mono text-xs text-slate-400">
                    UPLOAD IMAGE
                  </label>
                  {formData.imageUrl ? (
                    <div className="relative aspect-video">
                      <Image
                        src={formData.imageUrl}
                        alt="Preview"
                        fill
                        className="rounded-lg border border-white/10 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, imageUrl: "", imageKey: "" })}
                        className="absolute top-2 right-2 cursor-pointer rounded-lg bg-red-500/80 px-3 py-1 text-sm text-white hover:bg-red-500"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <ImageUploader
                      airlineIata={formData.airlineIata}
                      airlineIcao={formData.airlineIcao}
                      aircraftType={formData.aircraftType}
                      onUploadComplete={(url, key) => {
                        setFormData({
                          ...formData,
                          imageUrl: url,
                          imageKey: key,
                        });
                        setError(null);
                      }}
                      onError={() => {
                        // Error is handled internally by ImageUploader
                      }}
                    />
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting || !formData.imageUrl}
                  className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit for Review"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
