// components/map/MapControls.ts
import L from "leaflet";
import React from "react";

export class HeadingModeControl extends L.Control {
  public options = {
    position: "topleft" as L.ControlPosition,
  };
  public _container: HTMLDivElement | null = null;
  private _toggleHeadingMode: React.Dispatch<React.SetStateAction<boolean>>;
  private _boundClickHandler: (event: Event) => void;

  constructor(
    options: L.ControlOptions,
    toggleHeadingMode: React.Dispatch<React.SetStateAction<boolean>>,
  ) {
    super(options);
    this._toggleHeadingMode = toggleHeadingMode;
    this._boundClickHandler = (event: Event) => {
      this._toggleHeadingMode((prev) => !prev);
    };
  }

  onAdd(map: L.Map): HTMLDivElement {
    const container = L.DomUtil.create("div");
    container.style.cssText = `
      width: 30px;
      height: 30px;
      line-height: 30px;
      text-align: center;
      cursor: pointer;
      background-color: white;
      border: 2px solid rgba(0,0,0,0.2);
      border-radius: 4px;
      box-shadow: 0 1px 5px rgba(0,0,0,0.65);
      transition: all 0.2s ease;
      font-size: 16px;
      font-weight: bold;
    `;
    container.title = "Toggle Heading Mode";
    container.innerHTML = "&#8599;";

    L.DomEvent.on(container, "click", L.DomEvent.stopPropagation);
    L.DomEvent.on(container, "click", L.DomEvent.preventDefault);
    L.DomEvent.on(container, "click", this._boundClickHandler);
    this._container = container;
    return container;
  }

  onRemove(map: L.Map) {
    if (this._container) {
      L.DomEvent.off(this._container, "click", this._boundClickHandler);
    }
  }

  updateState(enabled: boolean) {
    if (this._container) {
      if (enabled) {
        this._container.style.backgroundColor = "#3b82f6";
        this._container.style.color = "white";
      } else {
        this._container.style.backgroundColor = "white";
        this._container.style.color = "black";
      }
    }
  }
}

export class RadarModeControl extends L.Control {
  public options = {
    position: "topleft" as L.ControlPosition,
  };
  public _container: HTMLDivElement | null = null;
  private _toggleRadarMode: React.Dispatch<React.SetStateAction<boolean>>;
  private _boundClickHandler: (event: Event) => void;

  constructor(
    options: L.ControlOptions,
    toggleRadarMode: React.Dispatch<React.SetStateAction<boolean>>,
  ) {
    super(options);
    this._toggleRadarMode = toggleRadarMode;
    this._boundClickHandler = (event: Event) => {
      this._toggleRadarMode((prev) => !prev);
    };
  }

  onAdd(map: L.Map): HTMLDivElement {
    const container = L.DomUtil.create("div");
    container.style.cssText = `
      width: 30px;
      height: 30px;
      line-height: 30px;
      text-align: center;
      cursor: pointer;
      background-color: white;
      border: 2px solid rgba(0,0,0,0.2);
      border-radius: 4px;
      box-shadow: 0 1px 5px rgba(0,0,0,0.65);
      transition: all 0.2s ease;
      font-size: 16px;
      font-weight: bold;
    `;
    container.title = "Toggle Radar Mode";
    container.innerHTML = "&#x1F4DF;";

    L.DomEvent.on(container, "click", L.DomEvent.stopPropagation);
    L.DomEvent.on(container, "click", L.DomEvent.preventDefault);
    L.DomEvent.on(container, "click", this._boundClickHandler);
    this._container = container;
    return container;
  }

  onRemove(map: L.Map) {
    if (this._container) {
      L.DomEvent.off(this._container, "click", this._boundClickHandler);
    }
  }

  updateState(enabled: boolean) {
    if (this._container) {
      if (enabled) {
        this._container.style.backgroundColor = "#0066cc";
        this._container.style.color = "white";
      } else {
        this._container.style.backgroundColor = "white";
        this._container.style.color = "black";
      }
    }
  }
}

export class OpenAIPControl extends L.Control {
  public options = {
    position: "topleft" as L.ControlPosition,
  };
  public _container: HTMLDivElement | null = null;
  private _toggleOpenAIP: React.Dispatch<React.SetStateAction<boolean>>;
  private _boundClickHandler: (event: Event) => void;

  constructor(
    options: L.ControlOptions,
    toggleOpenAIP: React.Dispatch<React.SetStateAction<boolean>>,
  ) {
    super(options);
    this._toggleOpenAIP = toggleOpenAIP;
    this._boundClickHandler = (event: Event) => {
      this._toggleOpenAIP((prev) => !prev);
    };
  }

  onAdd(map: L.Map): HTMLDivElement {
    const container = L.DomUtil.create("div");
    container.style.cssText = `
      width: 30px;
      height: 30px;
      line-height: 30px;
      text-align: center;
      cursor: pointer;
      background-color: white;
      border: 2px solid rgba(0,0,0,0.2);
      border-radius: 4px;
      box-shadow: 0 1px 5px rgba(0,0,0,0.65);
      transition: all 0.2s ease;
      font-size: 16px;
      font-weight: bold;
    `;
    container.title = "Toggle OpenAIP Layer";
    container.innerHTML = "&#x1F30D;";

    L.DomEvent.on(container, "click", L.DomEvent.stopPropagation);
    L.DomEvent.on(container, "click", L.DomEvent.preventDefault);
    L.DomEvent.on(container, "click", this._boundClickHandler);
    this._container = container;
    return container;
  }

  onRemove(map: L.Map) {
    if (this._container) {
      L.DomEvent.off(this._container, "click", this._boundClickHandler);
    }
  }

  updateState(enabled: boolean) {
    if (this._container) {
      if (enabled) {
        this._container.style.backgroundColor = "#28a745";
        this._container.style.color = "white";
      } else {
        this._container.style.backgroundColor = "white";
        this._container.style.color = "black";
      }
    }
  }
}
