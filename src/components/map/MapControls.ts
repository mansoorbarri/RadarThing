import L from "leaflet";
import React from "react";

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
    applyMetarStyleButton(container, "Configuration", "&#9881;");
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
  private _toggleRadarMode: React.Dispatch<React.SetStateAction<boolean>>;
  private _boundClick: () => void;
  private _currentState = false;

  constructor(
    options: L.ControlOptions,
    toggleRadarMode: React.Dispatch<React.SetStateAction<boolean>>,
  ) {
    super(options);
    this._toggleRadarMode = toggleRadarMode;
    this._boundClick = () => {
      this._toggleRadarMode((prev) => !prev);
    };
  }

  onAdd(): HTMLDivElement {
    const container = L.DomUtil.create("div");
    applyMetarStyleButton(container, "Radar Mode", "&#128223;");
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
      <span style="opacity: 0.4">&#128223;</span>
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
  private _toggleOSM: React.Dispatch<React.SetStateAction<boolean>>;
  private _boundClick: () => void;
  private _currentState = false;

  constructor(
    options: L.ControlOptions,
    toggleOSM: React.Dispatch<React.SetStateAction<boolean>>,
  ) {
    super(options);
    this._toggleOSM = toggleOSM;
    this._boundClick = () => {
      this._toggleOSM((prev) => !prev);
    };
  }

  onAdd(): HTMLDivElement {
    const container = L.DomUtil.create("div");
    applyMetarStyleButton(container, "OpenStreetMap", "&#128506;");
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
  private _toggleAIP: React.Dispatch<React.SetStateAction<boolean>>;
  private _boundClick: () => void;
  private _currentState = false;

  constructor(
    options: L.ControlOptions,
    toggleAIP: React.Dispatch<React.SetStateAction<boolean>>,
  ) {
    super(options);
    this._toggleAIP = toggleAIP;
    this._boundClick = () => {
      this._toggleAIP((prev) => !prev);
    };
  }

  onAdd(): HTMLDivElement {
    const container = L.DomUtil.create("div");
    applyMetarStyleButton(container, "OpenAIP Layer", "&#127758;");
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
