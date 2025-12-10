import React from "react";

export const MapGlobalStyles = () => (
  <style jsx global>{`
    /* === Tooltip Styling (HUD Cyan Theme) === */
    .heading-tooltip {
      background: rgba(0, 10, 15, 0.85) !important;
      color: #00ffff !important;
      border: 1px solid rgba(0, 255, 255, 0.3) !important;
      border-radius: 6px !important;
      padding: 8px 10px !important;
      font-size: 12px !important;
      font-family: monospace !important;
      text-shadow: 0 0 6px rgba(0, 255, 255, 0.7) !important;
      box-shadow: 0 0 10px rgba(0, 255, 255, 0.25) !important;
      pointer-events: none !important;
    }
    .heading-tooltip::before {
      display: none !important;
    }

    /* === Leaflet Popup (Aircraft / Airport info) === */
    .leaflet-popup-content-wrapper {
      background-color: rgba(0, 10, 15, 0.95) !important;
      color: #00ffff !important;
      border: 1px solid rgba(0, 255, 255, 0.25) !important;
      border-radius: 10px !important;
      box-shadow: 0 0 10px rgba(0, 255, 255, 0.15) !important;
      font-family: monospace !important;
      text-shadow: 0 0 5px rgba(0, 255, 255, 0.2) !important;
    }
    .leaflet-popup-tip {
      background-color: rgba(0, 10, 15, 0.95) !important;
      border: 1px solid rgba(0, 255, 255, 0.2) !important;
    }

    /* === Radar Popups (Flight tracks, emergencies) === */
    .radar-popup .leaflet-popup-content-wrapper {
      background-color: rgba(0, 10, 15, 0.9) !important;
      color: #00ffff !important;
      border: 1px solid #00ffff !important;
      box-shadow: 0 0 10px rgba(0, 255, 255, 0.6) !important;
      animation: radar-glow-pulse 1.4s ease-in-out infinite !important;
    }
    .radar-popup .leaflet-popup-tip {
      background-color: rgba(0, 10, 15, 0.9) !important;
      border-top: 1px solid #00ffff !important;
      border-left: 1px solid transparent !important;
      border-right: 1px solid transparent !important;
    }

    /* === Keyframes for the cyan glow effect === */
    @keyframes radar-glow-pulse {
      0% {
        box-shadow: 0 0 6px rgba(0, 255, 255, 0.4),
          0 0 10px rgba(0, 255, 255, 0.25);
      }
      50% {
        box-shadow: 0 0 12px rgba(0, 255, 255, 0.7),
          0 0 20px rgba(0, 255, 255, 0.5);
      }
      100% {
        box-shadow: 0 0 6px rgba(0, 255, 255, 0.4),
          0 0 10px rgba(0, 255, 255, 0.25);
      }
    }

    /* === Emergency pulse (for red aircraft highlights) === */
    @keyframes emergency-plane-pulse {
      0% {
        box-shadow: 0 0 10px #ff0000, 0 0 20px #ff0000;
      }
      100% {
        box-shadow: 0 0 22px #ff0000, 0 0 35px #ff0000, 0 0 45px #ff0000;
      }
    }

    @keyframes radar-emergency-pulse {
      0% {
        transform: scale(1);
        box-shadow: 0 0 6px rgba(255, 0, 0, 0.8);
      }
      50% {
        transform: scale(1.2);
        box-shadow: 0 0 14px rgba(255, 0, 0, 1);
      }
      100% {
        transform: scale(1);
        box-shadow: 0 0 6px rgba(255, 0, 0, 0.8);
      }
    }

    /* === Default Leaflet controls re-theme (Zoom, etc.) === */
    .leaflet-control-zoom a {
      width: 36px !important;
      height: 36px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      border-radius: 6px !important;
      font-weight: bold !important;
      font-family: monospace !important;
      background: rgba(0, 0, 0, 0.8) !important;
      border: 1px solid rgba(0, 255, 255, 0.3) !important;
      color: #00ffff !important;
      box-shadow: 0 0 6px rgba(0, 255, 255, 0.25) !important;
      transition: all 0.2s ease-in-out !important;
    }
    .leaflet-control-zoom a:hover {
      background: rgba(0, 255, 255, 0.15) !important;
      box-shadow: 0 0 10px rgba(0, 255, 255, 0.5) !important;
      border-color: rgba(0, 255, 255, 0.5) !important;
    }
    .leaflet-control-zoom {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
    }
  `}</style>
);