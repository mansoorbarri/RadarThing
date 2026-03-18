import { type NextRequest } from "next/server";
import { UTApi } from "uploadthing/server";
import { api, convex } from "~/server/convex";
import { getAirlineCodeCandidates } from "~/lib/airline-logos";

const AIRLINES_JSON_URL =
  "https://raw.githubusercontent.com/anhthang/soaring-symbols/main/airlines.json";
const ASSET_BASE_URL =
  "https://raw.githubusercontent.com/anhthang/soaring-symbols/main/assets";
const REVALIDATE_SECONDS = 60 * 60 * 24;
const utapi = new UTApi();

interface AirlineRecord {
  iata?: string;
  icao?: string;
  slug?: string;
}

interface ResolvedAirlineAsset {
  airlineIata: string;
  airlineIcao: string;
  slug: string;
  sourceAsset: string;
  sourceUrl: string;
}

function getCachedFileName(asset: ResolvedAirlineAsset): string {
  const extension = asset.sourceAsset.split(".").pop() ?? "svg";
  const assetType = asset.sourceAsset === "icon.svg" ? "tail" : "logo";
  const airlineIcao = asset.airlineIcao || "UNK";
  const airlineIata = asset.airlineIata || "UNK";

  return `${airlineIcao}-${airlineIata}-${assetType}.${extension}`;
}

async function getAirlines(): Promise<AirlineRecord[]> {
  const response = await fetch(AIRLINES_JSON_URL, {
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch airline index: ${response.status}`);
  }

  return (await response.json()) as AirlineRecord[];
}

async function fetchImageResponse(url: string): Promise<Response | null> {
  const response = await fetch(url, {
    next: { revalidate: REVALIDATE_SECONDS },
  });

  return response.ok ? response : null;
}

async function resolveGitHubAsset(
  airline: AirlineRecord,
): Promise<ResolvedAirlineAsset | null> {
  if (!airline.slug) return null;

  for (const fileName of ["icon.svg", "logo.svg"]) {
    const sourceUrl = `${ASSET_BASE_URL}/${airline.slug}/${fileName}`;
    const response = await fetch(sourceUrl, {
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (response.ok) {
      return {
        airlineIata: airline.iata?.toUpperCase() ?? "",
        airlineIcao: airline.icao?.toUpperCase() ?? "",
        slug: airline.slug,
        sourceAsset: fileName,
        sourceUrl,
      };
    }
  }

  return null;
}

function toImageResponse(response: Response): Response {
  return new Response(response.body, {
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") ?? "application/octet-stream",
      "Cache-Control": `public, max-age=${REVALIDATE_SECONDS}, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=604800`,
    },
  });
}

async function cacheAirlineAsset(
  asset: ResolvedAirlineAsset,
  contentType: string | null,
) {
  const now = Date.now();

  try {
    const uploadResult = await utapi.uploadFilesFromUrl({
      url: asset.sourceUrl,
      name: getCachedFileName(asset),
    });

    if (uploadResult.data) {
      await convex.mutation(api.airlineLogos.upsert, {
        airlineIata: asset.airlineIata,
        airlineIcao: asset.airlineIcao,
        slug: asset.slug,
        sourceAsset: asset.sourceAsset,
        sourceUrl: asset.sourceUrl,
        contentType: contentType ?? undefined,
        cachedUrl: uploadResult.data.ufsUrl,
        imageKey: uploadResult.data.key,
        lastFetchedAt: now,
        lastCachedAt: now,
      });
      return;
    }
  } catch {
    // Fall through to source-only persistence.
  }

  await convex.mutation(api.airlineLogos.upsert, {
    airlineIata: asset.airlineIata,
    airlineIcao: asset.airlineIcao,
    slug: asset.slug,
    sourceAsset: asset.sourceAsset,
    sourceUrl: asset.sourceUrl,
    contentType: contentType ?? undefined,
    cachedUrl: undefined,
    imageKey: undefined,
    lastFetchedAt: now,
    lastCachedAt: undefined,
  });
}

export async function GET(request: NextRequest) {
  const lookup = request.nextUrl.searchParams.get("code");
  const candidates = getAirlineCodeCandidates(lookup ?? undefined);

  if (candidates.length === 0) {
    return new Response("Missing airline code", { status: 404 });
  }

  try {
    const cachedEntry = await convex.query(api.airlineLogos.getByCode, {
      codes: candidates,
    });

    if (cachedEntry?.cachedUrl) {
      const cachedResponse = await fetchImageResponse(cachedEntry.cachedUrl);
      if (cachedResponse) {
        return toImageResponse(cachedResponse);
      }
    }

    if (cachedEntry?.sourceUrl) {
      const sourceResponse = await fetchImageResponse(cachedEntry.sourceUrl);
      if (sourceResponse) {
        if (!cachedEntry.cachedUrl) {
          await cacheAirlineAsset(
            {
              airlineIata: cachedEntry.airlineIata,
              airlineIcao: cachedEntry.airlineIcao,
              slug: cachedEntry.slug,
              sourceAsset: cachedEntry.sourceAsset,
              sourceUrl: cachedEntry.sourceUrl,
            },
            sourceResponse.headers.get("Content-Type"),
          );
        }

        return toImageResponse(sourceResponse);
      }
    }

    const airlines = await getAirlines();
    const airline = airlines.find((entry) => {
      const iata = entry.iata?.toUpperCase();
      const icao = entry.icao?.toUpperCase();

      return candidates.some(
        (candidate) => candidate === iata || candidate === icao,
      );
    });

    const resolvedAsset = airline ? await resolveGitHubAsset(airline) : null;
    if (!resolvedAsset) {
      return new Response("Airline logo not found", { status: 404 });
    }

    const sourceResponse = await fetchImageResponse(resolvedAsset.sourceUrl);
    if (!sourceResponse) {
      return new Response("Airline logo not found", { status: 404 });
    }

    await cacheAirlineAsset(
      resolvedAsset,
      sourceResponse.headers.get("Content-Type"),
    );

    return toImageResponse(sourceResponse);
  } catch {
    return new Response("Airline logo unavailable", { status: 502 });
  }
}
