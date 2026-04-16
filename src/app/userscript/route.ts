import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET(request: Request) {
  const installerUrl = new URL("/userscript/radarthing.user.js", request.url);

  return NextResponse.redirect(installerUrl, {
    status: 302,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
