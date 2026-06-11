export interface NavFix {
  ident: string;
  lat: number;
  lon: number;
}

export interface NavFixBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

const NAV_FIX_URL =
  "https://8knm0qcclu.ufs.sh/f/ValjPeTrsakyfm7xl9hskaCld3HZGnNY9Dipqe4cXzxFWgyh";
const NAV_FIX_CACHE_NAME = "radarthing-navdata";
const NAV_FIX_CACHE_META_KEY = "radarthing.navfixes.cachedAt";
const NAV_FIX_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

let cachedFixes: NavFix[] | null = null;
let pendingLoad: Promise<NavFix[]> | null = null;

function isValidLatLon(lat: number, lon: number) {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function parseFixLine(line: string): NavFix | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 3) return null;

  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  const ident = parts[2]?.trim();
  if (!ident || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!isValidLatLon(lat, lon)) return null;

  return { ident, lat, lon };
}

export function loadNavFixes() {
  if (cachedFixes) return Promise.resolve(cachedFixes);
  if (pendingLoad) return pendingLoad;

  pendingLoad = loadNavFixText()
    .then((text) => {
      const fixes = text
        .split(/\r?\n/)
        .map(parseFixLine)
        .filter((fix): fix is NavFix => fix !== null);
      cachedFixes = fixes;
      return fixes;
    })
    .finally(() => {
      pendingLoad = null;
    });

  return pendingLoad;
}

async function loadNavFixText() {
  const cacheFresh = isNavFixCacheFresh();
  const cachedText = await getCachedNavFixText();
  if (cachedText !== null) return cachedText;

  const response = await fetch(NAV_FIX_URL, {
    cache: cacheFresh ? "force-cache" : "reload",
  });
  if (!response.ok) {
    throw new Error(`Failed to load ${NAV_FIX_URL}`);
  }

  await storeNavFixResponse(response.clone());
  return response.text();
}

function isNavFixCacheFresh() {
  if (typeof window === "undefined") return false;

  try {
    const cachedAt = Number(
      window.localStorage.getItem(NAV_FIX_CACHE_META_KEY),
    );
    return (
      Number.isFinite(cachedAt) && Date.now() - cachedAt <= NAV_FIX_CACHE_TTL_MS
    );
  } catch {
    return false;
  }
}

async function getCachedNavFixText() {
  if (typeof window === "undefined" || !("caches" in window)) return null;

  try {
    if (!isNavFixCacheFresh()) return null;

    const cache = await window.caches.open(NAV_FIX_CACHE_NAME);
    const response = await cache.match(NAV_FIX_URL);
    return response ? response.text() : null;
  } catch {
    return null;
  }
}

async function storeNavFixResponse(response: Response) {
  if (typeof window === "undefined" || !("caches" in window)) return;

  try {
    const cache = await window.caches.open(NAV_FIX_CACHE_NAME);
    await cache.put(NAV_FIX_URL, response);
    window.localStorage.setItem(NAV_FIX_CACHE_META_KEY, String(Date.now()));
  } catch {
    // Cache persistence is best-effort; navdata loading should still succeed.
  }
}

export function filterNavFixesInBounds(
  fixes: NavFix[],
  bounds: NavFixBounds,
  maxFixes: number,
) {
  const visible: NavFix[] = [];

  for (const fix of fixes) {
    if (fix.lat < bounds.south || fix.lat > bounds.north) continue;
    const inLonRange =
      bounds.west <= bounds.east
        ? fix.lon >= bounds.west && fix.lon <= bounds.east
        : fix.lon >= bounds.west || fix.lon <= bounds.east;
    if (!inLonRange) continue;

    visible.push(fix);
    if (visible.length >= maxFixes) break;
  }

  return visible;
}
