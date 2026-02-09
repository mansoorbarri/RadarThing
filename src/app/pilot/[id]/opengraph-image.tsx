import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";
import { convex, api } from "~/server/convex";
import type { Id } from "../../../../convex/_generated/dataModel";

const logoSvg = readFileSync(
  join(process.cwd(), "public", "logo-white.svg"),
  "utf-8",
);
const logoDataUri = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`;

export const alt = "Pilot Profile - RadarThing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function formatFlightTime(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export default async function OGImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stats = await convex.query(api.flights.getStatsById, {
    userId: id as Id<"users">,
  });

  const callsign = stats?.pilotCallsign ?? "Unknown Pilot";
  const totalFlights = stats?.totalFlights ?? 0;
  const totalDistance = stats?.totalDistanceNm ?? 0;
  const totalTime = stats?.totalFlightTimeMs ?? 0;
  const topAircraft = stats?.topAircraft?.[0]?.name ?? null;
  const isPro =
    stats?.userRole === "PRO" || stats?.userRole === "ADMIN";
  const topRoute = stats?.topRoutes?.[0]?.route ?? null;
  const uniqueAirports = stats?.uniqueAirports ?? 0;

  if (isPro) {
    return new ImageResponse(
      (
        <div
          style={{
            background: "#010b10",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            padding: "44px 52px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 36,
            }}
          >
            <img src={logoDataUri} width={150} height={31} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background:
                  "linear-gradient(135deg, rgba(52, 211, 153, 0.15) 0%, rgba(34, 211, 238, 0.1) 100%)",
                border: "1px solid rgba(52, 211, 153, 0.3)",
                borderRadius: 20,
                padding: "6px 16px",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: "#34d399",
                  boxShadow: "0 0 8px rgba(52, 211, 153, 0.6)",
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  color: "#34d399",
                  fontWeight: 700,
                  letterSpacing: 1,
                }}
              >
                PRO PILOT
              </span>
            </div>
          </div>
          <div style={{ display: "flex", flex: 1, gap: 40 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: 340,
                borderRadius: 20,
                border: "1px solid rgba(34, 211, 238, 0.15)",
                background:
                  "linear-gradient(180deg, rgba(34, 211, 238, 0.08) 0%, rgba(34, 211, 238, 0.02) 100%)",
                padding: "28px 20px",
              }}
            >
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  border: "3px solid #34d399",
                  background:
                    "linear-gradient(135deg, rgba(52, 211, 153, 0.15) 0%, rgba(34, 211, 238, 0.08) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 40,
                  fontWeight: 700,
                  color: "#34d399",
                  boxShadow: "0 0 30px rgba(52, 211, 153, 0.12)",
                }}
              >
                {callsign.charAt(0).toUpperCase()}
              </div>
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: "white",
                  marginTop: 14,
                }}
              >
                {callsign}
              </span>
              {topAircraft ? (
                <span
                  style={{
                    fontSize: 14,
                    color: "rgba(255,255,255,0.35)",
                    marginTop: 6,
                  }}
                >
                  Flies {topAircraft}
                </span>
              ) : null}
              {topRoute ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 14,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    padding: "6px 14px",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.3)",
                    }}
                  >
                    Top route
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#22d3ee",
                    }}
                  >
                    {topRoute}
                  </span>
                </div>
              ) : null}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                gap: 12,
                justifyContent: "center",
              }}
            >
              <div style={{ display: "flex", gap: 12 }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    borderRadius: 16,
                    border: "1px solid rgba(34, 211, 238, 0.12)",
                    background: "rgba(34, 211, 238, 0.04)",
                    padding: "20px 22px",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.3)",
                      letterSpacing: 1,
                      marginBottom: 6,
                    }}
                  >
                    FLIGHTS
                  </span>
                  <span
                    style={{
                      fontSize: 34,
                      fontWeight: 700,
                      color: "white",
                    }}
                  >
                    {totalFlights.toLocaleString()}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    borderRadius: 16,
                    border: "1px solid rgba(99, 102, 241, 0.12)",
                    background: "rgba(99, 102, 241, 0.04)",
                    padding: "20px 22px",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.3)",
                      letterSpacing: 1,
                      marginBottom: 6,
                    }}
                  >
                    DISTANCE
                  </span>
                  <span
                    style={{
                      fontSize: 34,
                      fontWeight: 700,
                      color: "white",
                    }}
                  >
                    {totalDistance.toLocaleString()} nm
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    borderRadius: 16,
                    border: "1px solid rgba(168, 85, 247, 0.12)",
                    background: "rgba(168, 85, 247, 0.04)",
                    padding: "20px 22px",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.3)",
                      letterSpacing: 1,
                      marginBottom: 6,
                    }}
                  >
                    FLIGHT TIME
                  </span>
                  <span
                    style={{
                      fontSize: 34,
                      fontWeight: 700,
                      color: "white",
                    }}
                  >
                    {formatFlightTime(totalTime)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    borderRadius: 16,
                    border: "1px solid rgba(52, 211, 153, 0.12)",
                    background: "rgba(52, 211, 153, 0.04)",
                    padding: "20px 22px",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.3)",
                      letterSpacing: 1,
                      marginBottom: 6,
                    }}
                  >
                    AIRPORTS
                  </span>
                  <span
                    style={{
                      fontSize: 34,
                      fontWeight: 700,
                      color: "white",
                    }}
                  >
                    {uniqueAirports.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
      { ...size },
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: "#010b10",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "48px 56px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 40,
          }}
        >
          <img src={logoDataUri} width={160} height={33} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(34, 211, 238, 0.1)",
              border: "1px solid rgba(34, 211, 238, 0.25)",
              borderRadius: 20,
              padding: "6px 16px",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: "#34d399",
                boxShadow: "0 0 8px rgba(52, 211, 153, 0.6)",
              }}
            />
            <span
              style={{
                fontSize: 13,
                color: "#22d3ee",
                fontWeight: 600,
                letterSpacing: 1,
              }}
            >
              PILOT PROFILE
            </span>
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, gap: 48 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 360,
              borderRadius: 20,
              border: "1px solid rgba(34, 211, 238, 0.15)",
              background:
                "linear-gradient(180deg, rgba(34, 211, 238, 0.08) 0%, rgba(34, 211, 238, 0.02) 100%)",
              padding: "32px 24px",
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                border: "3px solid #22d3ee",
                background:
                  "linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(34, 211, 238, 0.05) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 42,
                fontWeight: 700,
                color: "#22d3ee",
                boxShadow: "0 0 30px rgba(34, 211, 238, 0.15)",
              }}
            >
              {callsign.charAt(0).toUpperCase()}
            </div>
            <span
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: "white",
                marginTop: 16,
              }}
            >
              {callsign}
            </span>
            {topAircraft ? (
              <span
                style={{
                  fontSize: 15,
                  color: "rgba(255,255,255,0.35)",
                  marginTop: 8,
                }}
              >
                Flies {topAircraft}
              </span>
            ) : null}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              gap: 16,
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                padding: "24px 28px",
                gap: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: "rgba(34, 211, 238, 0.1)",
                  border: "1px solid rgba(34, 211, 238, 0.2)",
                  fontSize: 22,
                }}
              >
                <span style={{ color: "#22d3ee" }}>✈</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: "white",
                  }}
                >
                  {totalFlights.toLocaleString()}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.35)",
                    letterSpacing: 1,
                  }}
                >
                  TOTAL FLIGHTS
                </span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                padding: "24px 28px",
                gap: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: "rgba(99, 102, 241, 0.1)",
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                  fontSize: 22,
                }}
              >
                <span style={{ color: "#818cf8" }}>⟿</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: "white",
                  }}
                >
                  {totalDistance.toLocaleString()} nm
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.35)",
                    letterSpacing: 1,
                  }}
                >
                  DISTANCE FLOWN
                </span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                padding: "24px 28px",
                gap: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: "rgba(168, 85, 247, 0.1)",
                  border: "1px solid rgba(168, 85, 247, 0.2)",
                  fontSize: 22,
                }}
              >
                <span style={{ color: "#a855f7" }}>◷</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: "white",
                  }}
                >
                  {formatFlightTime(totalTime)}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.35)",
                    letterSpacing: 1,
                  }}
                >
                  FLIGHT TIME
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
