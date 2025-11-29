// components/atc/SearchBar.tsx
import React from "react";
import { type PositionUpdate } from "~/lib/aircraft-store"; // Ensure correct path

interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
}

interface SearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchResults: (PositionUpdate | Airport)[];
  isMobile: boolean;
  onSelectAircraft: (aircraft: PositionUpdate) => void;
  onSelectAirport: (airport: Airport) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  setSearchTerm,
  searchResults,
  isMobile,
  onSelectAircraft,
  onSelectAirport,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMobile ? "center" : "flex-start",
      }}
    >
      <input
        type="text"
        placeholder="Search callsign, flight, ICAO, or squawk..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          padding: "10px 14px",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          backgroundColor: "rgba(17, 24, 39, 0.9)",
          color: "white",
          fontSize: "14px",
          outline: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          width: isMobile ? "90vw" : "280px",
          maxWidth: "320px",
          marginBottom: searchTerm && searchResults.length > 0 ? "10px" : "0",
        }}
      />

      {searchTerm && searchResults.length > 0 && (
        <div
          style={{
            maxHeight: "300px",
            overflowY: "auto",
            width: isMobile ? "90vw" : "280px",
            maxWidth: "320px",
            backgroundColor: "rgba(17, 24, 39, 0.95)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          {searchResults.map((result, index) => (
            <div
              key={
                "callsign" in result
                  ? result.callsign || result.flightNo || `ac-${index}` // Fallback key
                  : `ap-${result.icao}` // Airport key
              }
              style={{
                padding: "10px 14px",
                borderBottom:
                  index < searchResults.length - 1
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "none",
                cursor: "pointer",
                color: "white",
                fontSize: "14px",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "rgba(59, 130, 246, 0.15)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
              onClick={() => {
                if ("callsign" in result) {
                  onSelectAircraft(result);
                } else {
                  onSelectAirport(result);
                }
                setSearchTerm(""); // Clear search term after selection
              }}
            >
              {"callsign" in result ? (
                <>
                  <div style={{ fontWeight: "bold" }}>
                    {result.callsign || result.flightNo || "N/A"}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    {result.type} ({result.departure} to{" "}
                    {result.arrival || "UNK"})
                    {result.squawk && (
                      <span style={{ marginLeft: "8px", opacity: 0.8 }}>
                        SQK: {result.squawk}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: "bold" }}>{result.icao}</div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    {result.name} (Airport)
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
