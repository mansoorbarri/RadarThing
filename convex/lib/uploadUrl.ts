// Community-uploaded chart/image URLs come exclusively from UploadThing
// (file.ufsUrl → https://<app>.ufs.sh/f/<key>). These `create` mutations accept
// the URL as a string and are callable directly by any authenticated user, so
// validate at the boundary: reject anything that isn't an https ufs.sh URL
// (e.g. javascript:/data: URIs or attacker-controlled hosts).
export function assertUploadThingUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid upload URL");
  }
  const isUfs =
    parsed.hostname === "ufs.sh" || parsed.hostname.endsWith(".ufs.sh");
  if (parsed.protocol !== "https:" || !isUfs) {
    throw new Error("Upload URL must be an UploadThing (ufs.sh) https URL");
  }
}
