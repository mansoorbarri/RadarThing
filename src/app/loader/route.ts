import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const LOADER_FILE_PATH = path.join(
  process.cwd(),
  "public",
  "userscript",
  "radarthing.loader.js",
);

export async function GET() {
  try {
    const source = await readFile(LOADER_FILE_PATH, "utf8");

    return new NextResponse(source, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    });
  } catch (error) {
    console.error("Failed to serve userscript loader:", error);

    return NextResponse.json(
      { error: "Userscript loader is unavailable." },
      { status: 503 },
    );
  }
}
