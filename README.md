<p align="center">
  <img src="public/logo-white.svg" alt="RadarThing" width="200">
</p>

A modern, feature-rich flight radar for the [GeoFS](https://www.geo-fs.com/) flight simulator. Track flights in real-time, view detailed flight information, and manage air traffic with professional-grade tools.

This project is a complete reimagining of the original [GeoFS Radar](https://github.com/seabus0316/GeoFS-flightradar/) — rebuilt from the ground up with a focus on usability, accuracy, and a clean interface.

## Quick Start

1. **Install the mod:** [xyzmani.com/radar](https://xyzmani.com/radar)
2. **Open the radar:** [radarthing](https://radarthing.com)
3. Enter your departure/arrival airports (ICAO codes), callsign, and squawk code
4. Click **Save** — you're now visible on the radar

> Press **W** to toggle the settings popup. Press **T** to start Heading Mode. Clear the fields and save to go invisible.

---

## Features

### Flight Tracking
- **Click-to-track** — Select any aircraft directly on the map to view full details
- **Search** — Find flights instantly by callsign or GeoFS username
- **Detailed flight plans** — View speed and altitude at every waypoint

### Controller Tools
- **Heading Mode** — Calculate headings between any two points on the map
- **Airport markers** — Highlight airports for quick reference
- **AGL altitude** — Accurate ground-relative altitude, essential for ATC operations
- **Radar Mode** — Clean, professional display inspired by real-world radar screens and VATSIM

### Weather & Charts
- **METAR overlays** — Live weather data displayed on the map
- **Airport charts** — Access approach plates and taxi diagrams via [GeoFS-Charts](https://github.com/mansoorbarri/geofs-charts) integration

---

## What's Different From the Original

| Original | This Version |
|----------|--------------|
| Multiple confusing map options | Single, streamlined interface |
| Hard to see aircraft headings | Clear heading indicators |
| Required zooming to select flights | Click any aircraft, anywhere |
| MSL altitude (less useful for ATC) | AGL altitude (ground-relative) |
| Basic flight plan display | Detailed waypoints with speed/altitude |

---

## Issues & Feedback

Found a bug or have a suggestion? Open an issue on [GitHub](https://github.com/mansoorbarri/RadarThing/issues).

---

## Technical Details

**Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Convex (real-time database)

**Mapping:** [Leaflet](https://leafletjs.com/) for interactive maps

**Authentication:** Clerk

**Architecture:** Built on the T3 stack with a modular, type-safe codebase. The original project was written in JavaScript with Express — this version is a complete TypeScript rewrite with modern tooling and better separation of concerns.

### Development

```bash
# Install dependencies
bun install

# Run development server
bun dev

# Build for production
bun run build
```
