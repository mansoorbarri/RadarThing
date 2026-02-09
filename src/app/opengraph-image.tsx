import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";
export const alt = "RadarThing - Real-time Flight Radar for GeoFS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logoSvg = readFileSync(
  join(process.cwd(), "public", "logo-white.svg"),
  "utf-8",
);
const logoDataUri = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`;

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#010b10",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            width: "100%",
            borderRadius: 24,
            border: "1px solid rgba(34, 211, 238, 0.15)",
            background:
              "linear-gradient(145deg, rgba(34, 211, 238, 0.06) 0%, rgba(10, 22, 40, 0.8) 50%, rgba(34, 211, 238, 0.03) 100%)",
            boxShadow:
              "0 0 80px rgba(34, 211, 238, 0.08), inset 0 0 60px rgba(34, 211, 238, 0.03)",
            padding: "40px 60px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                background: "#22d3ee",
                boxShadow: "0 0 12px rgba(34, 211, 238, 0.6)",
              }}
            />
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#22d3ee",
                letterSpacing: 4,
                textTransform: "uppercase" as const,
              }}
            >
              Flight Radar for GeoFS
            </span>
          </div>
          <img
            src={logoDataUri}
            width={480}
            height={100}
            style={{ marginBottom: 32 }}
          />
          <span
            style={{
              fontSize: 22,
              color: "rgba(255, 255, 255, 0.45)",
              textAlign: "center" as const,
              lineHeight: 1.5,
              maxWidth: 600,
              marginBottom: 40,
            }}
          >
            Real-time aircraft tracking, flight recording, aviation weather, and airport charts.
          </span>
          <div
            style={{
              display: "flex",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(34, 211, 238, 0.1)",
                border: "1px solid rgba(34, 211, 238, 0.2)",
                borderRadius: 8,
                padding: "8px 16px",
              }}
            >
              <span style={{ fontSize: 14, color: "#22d3ee", fontWeight: 600 }}>
                Live Tracking
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(34, 211, 238, 0.1)",
                border: "1px solid rgba(34, 211, 238, 0.2)",
                borderRadius: 8,
                padding: "8px 16px",
              }}
            >
              <span style={{ fontSize: 14, color: "#22d3ee", fontWeight: 600 }}>
                Weather Data
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(34, 211, 238, 0.1)",
                border: "1px solid rgba(34, 211, 238, 0.2)",
                borderRadius: 8,
                padding: "8px 16px",
              }}
            >
              <span style={{ fontSize: 14, color: "#22d3ee", fontWeight: 600 }}>
                Airport Charts
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(34, 211, 238, 0.1)",
                border: "1px solid rgba(34, 211, 238, 0.2)",
                borderRadius: 8,
                padding: "8px 16px",
              }}
            >
              <span style={{ fontSize: 14, color: "#22d3ee", fontWeight: 600 }}>
                Flight Recording
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
