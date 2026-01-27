import L from "leaflet";
import React from "react";

// SVG Icons for map controls (matching theme style)
const ICONS = {
  settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`,
  radar: `<img src="/icons/radar.svg" width="18" height="18" alt="Radar" style="filter: brightness(0) saturate(100%) invert(79%) sepia(44%) saturate(1177%) hue-rotate(152deg) brightness(98%) contrast(90%);" />`,
  osm: `<img src="/icons/OSM.svg" width="18" height="18" alt="OSM" />`,
  globe: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>`,
};

function applyMetarStyleButton(
  container: HTMLDivElement,
  title: string,
  iconHtml: string,
) {
  container.className =
    "map-control-btn w-[36px] h-[36px] top-15 flex items-center justify-center text-cyan-400 text-[18px] font-semibold border border-cyan-400/30 rounded-md bg-black/70 shadow-[0_0_6px_rgba(0,255,255,0.25)] cursor-pointer transition-all duration-200 hover:bg-cyan-400/10 hover:shadow-[0_0_10px_rgba(0,255,255,0.4)] hover:border-cyan-400/60";
  container.innerHTML = `${iconHtml}<span class="map-tooltip">${title}</span>`;
}

function setActiveStyle(container: HTMLDivElement, active: boolean) {
  if (active) {
    container.classList.add(
      "bg-cyan-500/30",
      "border-cyan-400",
      "shadow-[0_0_12px_rgba(0,255,255,0.8)]",
      "animate-radarPulse",
    );
    container.classList.remove("bg-black/70");
  } else {
    container.classList.remove(
      "bg-cyan-500/30",
      "border-cyan-400",
      "shadow-[0_0_12px_rgba(0,255,255,0.8)]",
      "animate-radarPulse",
    );
    container.classList.add("bg-black/70");
  }
}

export class RadarSettingsControl extends L.Control {
  public options = { position: "topleft" as L.ControlPosition };
  public _container: HTMLDivElement | null = null;
  private _toggleSettings: React.Dispatch<React.SetStateAction<boolean>>;
  private _boundClick: () => void;
  private _currentState = false;

  constructor(
    options: L.ControlOptions,
    toggleSettings: React.Dispatch<React.SetStateAction<boolean>>,
  ) {
    super(options);
    this._toggleSettings = toggleSettings;
    this._boundClick = () => {
      this._toggleSettings((prev) => !prev);
    };
  }

  onAdd(): HTMLDivElement {
    const container = L.DomUtil.create("div");
    applyMetarStyleButton(container, "Configuration", ICONS.settings);
    L.DomEvent.on(container, "click", L.DomEvent.stopPropagation);
    L.DomEvent.on(container, "click", L.DomEvent.preventDefault);
    L.DomEvent.on(container, "click", this._boundClick);
    this._container = container;
    return container;
  }

  onRemove() {
    if (this._container)
      L.DomEvent.off(this._container, "click", this._boundClick);
  }

  updateState(enabled: boolean) {
    this._currentState = enabled;
    if (this._container) setActiveStyle(this._container, enabled);
  }
}

export class HeadingModeControl extends L.Control {
  public options = { position: "topleft" as L.ControlPosition };
  public _container: HTMLDivElement | null = null;
  private _setHeadingMode: React.Dispatch<React.SetStateAction<boolean>>;
  private _boundClick: () => void;

  constructor(
    options: L.ControlOptions,
    setHeadingMode: React.Dispatch<React.SetStateAction<boolean>>,
  ) {
    super(options);
    this._setHeadingMode = setHeadingMode;
    this._boundClick = () => {
      this._setHeadingMode(true);
    };
  }

  onAdd(): HTMLDivElement {
    const container = L.DomUtil.create("div");
    applyMetarStyleButton(container, "Heading Mode", "&#8599;");
    L.DomEvent.on(container, "click", L.DomEvent.stopPropagation);
    L.DomEvent.on(container, "click", L.DomEvent.preventDefault);
    L.DomEvent.on(container, "click", this._boundClick);
    this._container = container;
    return container;
  }

  onRemove() {
    if (this._container) {
      L.DomEvent.off(this._container, "click", this._boundClick);
    }
  }

  updateState(enabled: boolean) {
    if (this._container) setActiveStyle(this._container, enabled);
  }
}

export class RadarModeControl extends L.Control {
  public options = { position: "topleft" as L.ControlPosition };
  public _container: HTMLDivElement | null = null;
  private _toggleRadarMode: () => void;
  private _boundClick: () => void;
  private _currentState = false;

  constructor(
    options: L.ControlOptions,
    toggleRadarMode: () => void,
  ) {
    super(options);
    this._toggleRadarMode = toggleRadarMode;
    this._boundClick = () => {
      this._toggleRadarMode();
    };
  }

  onAdd(): HTMLDivElement {
    const container = L.DomUtil.create("div");
    applyMetarStyleButton(container, "Radar Mode", ICONS.radar);
    L.DomEvent.on(container, "click", L.DomEvent.stopPropagation);
    L.DomEvent.on(container, "click", L.DomEvent.preventDefault);
    L.DomEvent.on(container, "click", this._boundClick);
    this._container = container;
    return container;
  }

  onRemove() {
    if (this._container)
      L.DomEvent.off(this._container, "click", this._boundClick);
  }

  updateState(enabled: boolean) {
    this._currentState = enabled;
    if (this._container) setActiveStyle(this._container, enabled);
  }
}

export class LockedRadarModeControl extends L.Control {
  public options = { position: "topleft" as L.ControlPosition };
  public _container: HTMLDivElement | null = null;
  private _boundClick: () => void;

  constructor(options: L.ControlOptions) {
    super(options);
    this._boundClick = () => {
      window.location.href = "/pricing";
    };
  }

  onAdd(): HTMLDivElement {
    const container = L.DomUtil.create("div");
    container.className =
      "map-control-btn relative w-[36px] h-[36px] top-15 flex items-center justify-center text-white/40 text-[18px] font-semibold border border-yellow-500/30 rounded-md bg-black/70 shadow-[0_0_6px_rgba(234,179,8,0.25)] cursor-pointer transition-all duration-200 hover:bg-yellow-500/10 hover:shadow-[0_0_10px_rgba(234,179,8,0.4)] hover:border-yellow-500/60";
    container.innerHTML = `
      <span style="opacity: 0.4">${ICONS.radar}</span>
      <span style="position: absolute; top: -6px; right: -6px; background: rgba(234, 179, 8, 0.2); color: #facc15; font-size: 8px; padding: 1px 4px; border-radius: 4px; font-weight: bold;">PRO</span>
      <span class="map-tooltip">Radar Mode (PRO)</span>
    `;
    L.DomEvent.on(container, "click", L.DomEvent.stopPropagation);
    L.DomEvent.on(container, "click", L.DomEvent.preventDefault);
    L.DomEvent.on(container, "click", this._boundClick);
    this._container = container;
    return container;
  }

  onRemove() {
    if (this._container)
      L.DomEvent.off(this._container, "click", this._boundClick);
  }
}

export class OSMControl extends L.Control {
  public options = { position: "topleft" as L.ControlPosition };
  public _container: HTMLDivElement | null = null;
  private _toggleOSM: () => void;
  private _boundClick: () => void;
  private _currentState = false;

  constructor(
    options: L.ControlOptions,
    toggleOSM: () => void,
  ) {
    super(options);
    this._toggleOSM = toggleOSM;
    this._boundClick = () => {
      this._toggleOSM();
    };
  }

  onAdd(): HTMLDivElement {
    const container = L.DomUtil.create("div");
    applyMetarStyleButton(container, "OpenStreetMap", ICONS.osm);
    L.DomEvent.on(container, "click", L.DomEvent.stopPropagation);
    L.DomEvent.on(container, "click", L.DomEvent.preventDefault);
    L.DomEvent.on(container, "click", this._boundClick);
    this._container = container;
    return container;
  }

  onRemove() {
    if (this._container)
      L.DomEvent.off(this._container, "click", this._boundClick);
  }

  updateState(enabled: boolean) {
    this._currentState = enabled;
    if (this._container) setActiveStyle(this._container, enabled);
  }
}

export class OpenAIPControl extends L.Control {
  public options = { position: "topleft" as L.ControlPosition };
  public _container: HTMLDivElement | null = null;
  private _toggleAIP: () => void;
  private _boundClick: () => void;
  private _currentState = false;

  constructor(
    options: L.ControlOptions,
    toggleAIP: () => void,
  ) {
    super(options);
    this._toggleAIP = toggleAIP;
    this._boundClick = () => {
      this._toggleAIP();
    };
  }

  onAdd(): HTMLDivElement {
    const container = L.DomUtil.create("div");
    applyMetarStyleButton(container, "OpenAIP Layer", ICONS.globe);
    L.DomEvent.on(container, "click", L.DomEvent.stopPropagation);
    L.DomEvent.on(container, "click", L.DomEvent.preventDefault);
    L.DomEvent.on(container, "click", this._boundClick);
    this._container = container;
    return container;
  }

  onRemove() {
    if (this._container)
      L.DomEvent.off(this._container, "click", this._boundClick);
  }

  updateState(enabled: boolean) {
    this._currentState = enabled;
    if (this._container) setActiveStyle(this._container, enabled);
  }
}
