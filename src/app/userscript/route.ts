import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const USERSCRIPT_FILE_PATH = path.join(
  process.cwd(),
  "public",
  "userscript",
  "radarthing.user.js",
);

export async function GET() {
  try {
    const source = await readFile(USERSCRIPT_FILE_PATH, "utf8");

    return new NextResponse(source, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (error) {
    console.error("Failed to serve userscript installer:", error);

    return NextResponse.json(
      { error: "Userscript installer is unavailable." },
      { status: 503 },
    );
  }
}
