import L from "leaflet";
import React from "react";
import { Analytics } from "~/lib/analytics";

const tooltipCleanupMap = new WeakMap<HTMLDivElement, () => void>();
const tooltipHideTimerMap = new WeakMap<
  HTMLDivElement,
  ReturnType<typeof setTimeout>
>();

// SVG Icons for map controls (matching theme style)
const ICONS = {
  reset: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/>
    <path d="M3 3v5h5"/>
  </svg>`,
  zoomIn: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 5v14"/>
    <path d="M5 12h14"/>
  </svg>`,
  zoomOut: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M5 12h14"/>
  </svg>`,
  settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`,
  heading: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8"/>
    <path d="M12 8v8"/>
    <path d="M8 12h8"/>
  </svg>`,
  // Line icons in the same style as the other controls (Lucide "radar" and
  // "map"), so every map button reads as one family.
  radar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/>
    <path d="M4 6h.01"/>
    <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/>
    <path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/>
    <path d="M12 18h.01"/>
    <path d="M17.99 11.66A6 6 0 0 1 15.77 16.67"/>
    <circle cx="12" cy="12" r="2"/>
    <path d="m13.41 10.59 5.66-5.66"/>
  </svg>`,
  osm: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/>
    <path d="M15 5.764v15"/>
    <path d="M9 3.236v15"/>
  </svg>`,
  globe: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>`,
};

function applyMetarStyleButton(
  container: HTMLDivElement,
  title: string,
  iconHtml: string,
) {
  container.className =
    "map-control-btn flex h-10 w-10 items-center justify-center rounded-md border border-cyan-400/30 bg-black/70 text-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.28)] transition-all duration-200 hover:border-cyan-300/60 hover:bg-cyan-500/10";
  container.innerHTML = `${iconHtml}<span class="map-tooltip" aria-hidden="true">${title}</span>`;
  makeKeyboardAccessible(container, title);
  attachTooltipBehavior(container);
}

const keyboardHandlerMap = new WeakMap<
  HTMLDivElement,
  (event: KeyboardEvent) => void
>();

/**
 * Leaflet controls are plain divs. Give them button semantics, a label and
 * Enter/Space activation so they work with a keyboard and screen readers.
 */
function makeKeyboardAccessible(container: HTMLDivElement, label: string) {
  container.setAttribute("role", "button");
  container.setAttribute("aria-label", label);
  container.tabIndex = 0;
  if (keyboardHandlerMap.has(container)) return;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    container.click();
  };
  keyboardHandlerMap.set(container, onKeyDown);
  container.addEventListener("keydown", onKeyDown);
}

function clearTooltipHideTimer(container: HTMLDivElement) {
  const existingTimer = tooltipHideTimerMap.get(container);
  if (existingTimer) {
    clearTimeout(existingTimer);
    tooltipHideTimerMap.delete(container);
  }
}

function showTooltip(container: HTMLDivElement) {
  clearTooltipHideTimer(container);
  container.classList.add("map-tooltip-visible");
}

function scheduleHideTooltip(container: HTMLDivElement, delayMs = 240) {
  clearTooltipHideTimer(container);
  const timer = setTimeout(() => {
    container.classList.remove("map-tooltip-visible");
    tooltipHideTimerMap.delete(container);
  }, delayMs);
  tooltipHideTimerMap.set(container, timer);
}

function attachTooltipBehavior(container: HTMLDivElement) {
  const handlePointerEnter = () => showTooltip(container);
  const handlePointerLeave = () => scheduleHideTooltip(container);
  const handleFocus = () => showTooltip(container);
  const handleBlur = () => scheduleHideTooltip(container, 120);
  const handlePointerDown = () => {
    showTooltip(container);
    scheduleHideTooltip(container, 450);
  };

  container.addEventListener("pointerenter", handlePointerEnter);
  container.addEventListener("pointerleave", handlePointerLeave);
  container.addEventListener("focus", handleFocus);
  container.addEventListener("blur", handleBlur);
  container.addEventListener("pointerdown", handlePointerDown);

  tooltipCleanupMap.set(container, () => {
    clearTooltipHideTimer(container);
    container.classList.remove("map-tooltip-visible");
    container.removeEventListener("pointerenter", handlePointerEnter);
    container.removeEventListener("pointerleave", handlePointerLeave);
    container.removeEventListener("focus", handleFocus);
    container.removeEventListener("blur", handleBlur);
    container.removeEventListener("pointerdown", handlePointerDown);
  });
}

function detachTooltipBehavior(container: HTMLDivElement) {
  tooltipCleanupMap.get(container)?.();
  tooltipCleanupMap.delete(container);
}

function setActiveStyle(
  container: HTMLDivElement,
  active: boolean,
  stateAttribute: "aria-pressed" | "aria-expanded" = "aria-pressed",
) {
  // Tell assistive tech whether the toggle is on, not just sighted users.
  container.setAttribute(stateAttribute, String(active));
  if (active) {
    container.classList.add(
      "bg-cyan-500/30",
      "border-cyan-300/80",
      "shadow-[0_0_14px_rgba(34,211,238,0.48)]",
    );
    container.classList.remove("bg-black/70");
  } else {
    container.classList.remove(
      "bg-cyan-500/30",
      "border-cyan-300/80",
      "shadow-[0_0_14px_rgba(34,211,238,0.48)]",
    );
    container.classList.add("bg-black/70");
  }
}

abstract class IconButtonControl extends L.Control {
  public options = { position: "topleft" as L.ControlPosition };
  public _container: HTMLDivElement | null = null;
  protected controlName?: string;
  protected abstract title: string;
  protected abstract iconHtml: string;
  protected abstract onButtonClick(): void;

  onAdd(): HTMLDivElement {
    const container = L.DomUtil.create("div");
    applyMetarStyleButton(container, this.title, this.iconHtml);
    if (this.controlName) container.dataset.control = this.controlName;
    L.DomEvent.on(container, "click", L.DomEvent.stopPropagation);
    L.DomEvent.on(container, "click", L.DomEvent.preventDefault);
    L.DomEvent.on(container, "click", this.handleClick);
    this._container = container;
    return container;
  }

  onRemove() {
    if (this._container) {
      L.DomEvent.off(this._container, "click", this.handleClick);
      detachTooltipBehavior(this._container);
    }
  }

  private handleClick = () => {
    this.onButtonClick();
  };
}

export class AltitudeModeControl extends IconButtonControl {
  protected controlName = "altitude-mode";
  protected title = "3D altitude · heights exaggerated for visibility";
  protected iconHtml =
    '<span style="font-size:12px;font-weight:700" aria-hidden="true">3D</span>';

  constructor(
    options: L.ControlOptions,
    private readonly toggle: () => void,
  ) {
    super(options);
  }

  protected onButtonClick() {
    this.toggle();
  }

  onAdd() {
    const container = super.onAdd();
    container.setAttribute("aria-label", "3D altitude");
    return container;
  }

  updateState(enabled: boolean, estimated: boolean) {
    if (!this._container) return;
    const settings = this._container.parentElement?.querySelector(
      '[data-control="radar-settings"]',
    );
    if (settings && this._container.nextElementSibling !== settings) {
      settings.parentElement?.insertBefore(this._container, settings);
    }
    setActiveStyle(this._container, enabled);
    this._container.setAttribute("aria-pressed", String(enabled));
    const tooltip = this._container.querySelector(".map-tooltip");
    if (tooltip)
      tooltip.textContent = enabled
        ? `3D altitude on · heights exaggerated${estimated ? " · some altitudes estimated" : ""}`
        : this.title;
  }
}

export class ResetMapViewControl extends IconButtonControl {
  protected controlName = "reset-map-view";
  protected title = "Reset map view";
  protected iconHtml = ICONS.reset;
  private readonly resetMapView: () => void;

  constructor(options: L.ControlOptions, resetMapView: () => void) {
    super(options);
    this.resetMapView = resetMapView;
  }

  protected onButtonClick() {
    this.resetMapView();
  }
}

export class ZoomInControl extends IconButtonControl {
  protected title = "Zoom in";
  protected iconHtml = ICONS.zoomIn;
  private readonly mapRef: React.MutableRefObject<L.Map | null>;

  constructor(
    options: L.ControlOptions,
    mapRef: React.MutableRefObject<L.Map | null>,
  ) {
    super(options);
    this.mapRef = mapRef;
  }

  protected onButtonClick() {
    this.mapRef.current?.zoomIn();
  }
}

export class ZoomOutControl extends IconButtonControl {
  protected title = "Zoom out";
  protected iconHtml = ICONS.zoomOut;
  private readonly mapRef: React.MutableRefObject<L.Map | null>;

  constructor(
    options: L.ControlOptions,
    mapRef: React.MutableRefObject<L.Map | null>,
  ) {
    super(options);
    this.mapRef = mapRef;
  }

  protected onButtonClick() {
    this.mapRef.current?.zoomOut();
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
    applyMetarStyleButton(container, "Map settings", ICONS.settings);
    setActiveStyle(container, this._currentState ?? false, "aria-expanded");
    container.dataset.control = "radar-settings";
    L.DomEvent.on(container, "click", L.DomEvent.stopPropagation);
    L.DomEvent.on(container, "click", L.DomEvent.preventDefault);
    L.DomEvent.on(container, "click", this._boundClick);
    this._container = container;
    return container;
  }

  onRemove() {
    if (this._container) {
      L.DomEvent.off(this._container, "click", this._boundClick);
      detachTooltipBehavior(this._container);
    }
  }

  updateState(enabled: boolean) {
    this._currentState = enabled;
    if (this._container)
      setActiveStyle(this._container, enabled, "aria-expanded");
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
    applyMetarStyleButton(container, "Heading mode", ICONS.heading);
    setActiveStyle(container, false);
    container.dataset.control = "heading";
    L.DomEvent.on(container, "click", L.DomEvent.stopPropagation);
    L.DomEvent.on(container, "click", L.DomEvent.preventDefault);
    L.DomEvent.on(container, "click", this._boundClick);
    this._container = container;
    return container;
  }

  onRemove() {
    if (this._container) {
      L.DomEvent.off(this._container, "click", this._boundClick);
      detachTooltipBehavior(this._container);
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

  constructor(options: L.ControlOptions, toggleRadarMode: () => void) {
    super(options);
    this._toggleRadarMode = toggleRadarMode;
    this._boundClick = () => {
      this._toggleRadarMode();
    };
  }

  onAdd(): HTMLDivElement {
    const container = L.DomUtil.create("div");
    applyMetarStyleButton(container, "Radar mode", ICONS.radar);
    setActiveStyle(container, this._currentState);
    container.dataset.control = "radar-mode";
    L.DomEvent.on(container, "click", L.DomEvent.stopPropagation);
    L.DomEvent.on(container, "click", L.DomEvent.preventDefault);
    L.DomEvent.on(container, "click", this._boundClick);
    this._container = container;
    return container;
  }

  onRemove() {
    if (this._container) {
      L.DomEvent.off(this._container, "click", this._boundClick);
      detachTooltipBehavior(this._container);
    }
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
      Analytics.upgradeButtonClicked({
        source: "map_locked_radar_mode",
        feature: "radar_mode_layer",
      });
      window.location.href = "/pricing";
    };
  }

  onAdd(): HTMLDivElement {
    const container = L.DomUtil.create("div");
    container.className =
      "map-control-btn relative flex h-10 w-10 items-center justify-center rounded-md border border-yellow-500/30 bg-black/70 text-white/60 shadow-[0_0_6px_rgba(234,179,8,0.25)] transition-all duration-200 hover:border-yellow-500/60 hover:bg-yellow-500/10 hover:shadow-[0_0_10px_rgba(234,179,8,0.4)]";
    container.innerHTML = `
      <span style="opacity: 0.4">${ICONS.radar}</span>
      <span aria-hidden="true" style="position: absolute; z-index: 1; top: 1px; right: 1px; pointer-events: none; background: rgba(0, 0, 0, 0.75); color: #facc15; font-size: 9px; line-height: 1; padding: 2px 3px; border-radius: 4px; font-weight: bold;">Pro</span>
      <span class="map-tooltip" aria-hidden="true">Radar mode (Pro)</span>
    `;
    makeKeyboardAccessible(container, "Radar mode (Pro feature)");
    container.dataset.control = "radar-mode-pro";
    attachTooltipBehavior(container);
    L.DomEvent.on(container, "click", L.DomEvent.stopPropagation);
    L.DomEvent.on(container, "click", L.DomEvent.preventDefault);
    L.DomEvent.on(container, "click", this._boundClick);
    this._container = container;
    return container;
  }

  onRemove() {
    if (this._container) {
      L.DomEvent.off(this._container, "click", this._boundClick);
      detachTooltipBehavior(this._container);
    }
  }
}

export class OSMControl extends L.Control {
  public options = { position: "topleft" as L.ControlPosition };
  public _container: HTMLDivElement | null = null;
  private _toggleOSM: () => void;
  private _boundClick: () => void;
  private _currentState = false;

  constructor(options: L.ControlOptions, toggleOSM: () => void) {
    super(options);
    this._toggleOSM = toggleOSM;
    this._boundClick = () => {
      this._toggleOSM();
    };
  }

  onAdd(): HTMLDivElement {
    const container = L.DomUtil.create("div");
    applyMetarStyleButton(container, "Street map", ICONS.osm);
    setActiveStyle(container, this._currentState);
    container.dataset.control = "osm-layer";
    L.DomEvent.on(container, "click", L.DomEvent.stopPropagation);
    L.DomEvent.on(container, "click", L.DomEvent.preventDefault);
    L.DomEvent.on(container, "click", this._boundClick);
    this._container = container;
    return container;
  }

  onRemove() {
    if (this._container) {
      L.DomEvent.off(this._container, "click", this._boundClick);
      detachTooltipBehavior(this._container);
    }
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

  constructor(options: L.ControlOptions, toggleAIP: () => void) {
    super(options);
    this._toggleAIP = toggleAIP;
    this._boundClick = () => {
      this._toggleAIP();
    };
  }

  onAdd(): HTMLDivElement {
    const container = L.DomUtil.create("div");
    applyMetarStyleButton(container, "Airspace layer (OpenAIP)", ICONS.globe);
    setActiveStyle(container, this._currentState);
    container.dataset.control = "openaip-layer";
    L.DomEvent.on(container, "click", L.DomEvent.stopPropagation);
    L.DomEvent.on(container, "click", L.DomEvent.preventDefault);
    L.DomEvent.on(container, "click", this._boundClick);
    this._container = container;
    return container;
  }

  onRemove() {
    if (this._container) {
      L.DomEvent.off(this._container, "click", this._boundClick);
      detachTooltipBehavior(this._container);
    }
  }

  updateState(enabled: boolean) {
    this._currentState = enabled;
    if (this._container) setActiveStyle(this._container, enabled);
  }
}
