export function GET(request: Request) {
  const latHeader = request.headers.get("x-vercel-ip-latitude");
  const lngHeader = request.headers.get("x-vercel-ip-longitude");
  const city = request.headers.get("x-vercel-ip-city");
  const country = request.headers.get("x-vercel-ip-country");
  const region = request.headers.get("x-vercel-ip-country-region");

  const lat = latHeader ? Number(latHeader) : Number.NaN;
  const lng = lngHeader ? Number(lngHeader) : Number.NaN;

  return Response.json(
    {
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      city: city || null,
      country: country || null,
      region: region || null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
