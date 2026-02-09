import { ImageResponse } from "next/og";

export const alt = "RadarThing - Real-time Flight Radar for GeoFS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          position: "relative",
        }}
      >
        {/* Radar rings */}
        {[200, 340, 480].map((ringSize) => (
          <div
            key={ringSize}
            style={{
              position: "absolute",
              width: ringSize,
              height: ringSize,
              borderRadius: "50%",
              border: "1px solid rgba(34, 211, 238, 0.12)",
            }}
          />
        ))}

        {/* Glow */}
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(34, 211, 238, 0.06) 0%, transparent 60%)",
          }}
        />

        {/* Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "white",
              letterSpacing: "-2px",
            }}
          >
            RadarThing
          </div>
          <div
            style={{
              fontSize: 28,
              color: "rgba(34, 211, 238, 0.8)",
              fontWeight: 500,
            }}
          >
            Real-time Flight Radar for GeoFS
          </div>
          <div
            style={{
              display: "flex",
              gap: 32,
              marginTop: 24,
              fontSize: 18,
              color: "rgba(255, 255, 255, 0.4)",
            }}
          >
            <span>Live Tracking</span>
            <span style={{ color: "rgba(34, 211, 238, 0.4)" }}>|</span>
            <span>Flight Recording</span>
            <span style={{ color: "rgba(34, 211, 238, 0.4)" }}>|</span>
            <span>Weather Data</span>
            <span style={{ color: "rgba(34, 211, 238, 0.4)" }}>|</span>
            <span>Airport Charts</span>
          </div>
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background:
              "linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.6), transparent)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
