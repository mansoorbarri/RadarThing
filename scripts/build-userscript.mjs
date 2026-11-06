import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const configPath = path.join(repoRoot, "userscript-src", "config.json");
const config = JSON.parse(await readFile(configPath, "utf8"));

const { version, siteUrl, assetBaseUrl, sourceFiles } = config;

const publicDir = path.join(repoRoot, "public", "userscript");
const releaseDir = path.join(publicDir, "releases", version);
const stableBundlePath = path.join(publicDir, "radarthing.bundle.js");
const versionedBundlePath = path.join(releaseDir, "radarthing.bundle.js");
const loaderPath = path.join(publicDir, "radarthing.loader.js");
const manifestPath = path.join(publicDir, "latest.json");
const publicInstallerPath = path.join(publicDir, "radarthing.user.js");
const rootInstallerPath = path.join(repoRoot, "radarthing.user.js");

function stripUserscriptHeader(source) {
  return source.replace(
    /^\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/m,
    "",
  );
}

function buildBundle(sourceBlocks) {
  const wrappedSources = sourceBlocks
    .map(
      ({ relativePath, content }) =>
        `  // Source: ${relativePath}\n${indent(content.trim())}`,
    )
    .join("\n\n");

  return `(() => {
  "use strict";

  if (window.__radarThingLoaded) {
    console.info("[RadarThing] Runtime already active.");
    return;
  }

  if (window.__radarThingBooting) {
    console.info("[RadarThing] Runtime is already booting.");
    return;
  }

  // A previous boot that failed partway has already registered some timers
  // and listeners; running the sources again would duplicate them (double
  // position sends, double toasts). Ask for a reload instead.
  if (window.__radarThingBootAttempted) {
    console.warn("[RadarThing] A previous start failed partway; reload GeoFS to retry.");
    window.__radarThingNeedsReload = true;
    return;
  }

  window.__radarThingBooting = true;
  window.__radarThingBootAttempted = true;

  try {
    window.__radarThingVersion = ${JSON.stringify(version)};

${wrappedSources}

    window.__radarThingLoaded = true;
    window.__radarThingLastBootAt = new Date().toISOString();
  } catch (error) {
    console.error("[RadarThing] Failed to boot runtime.", error);
    throw error;
  } finally {
    window.__radarThingBooting = false;
  }
})();
`;
}

function buildLoader() {
  return `(() => {
  "use strict";

  const BASE_URL = ${JSON.stringify(assetBaseUrl)};
  const STABLE_BUNDLE_URL = BASE_URL + "/radarthing.bundle.js";
  const MANIFEST_URL = BASE_URL + "/latest.json";
  const STATE_KEY = "__radarThingLoaderState";
  const state = (window[STATE_KEY] = window[STATE_KEY] || {});

  if (window.__radarThingLoaded || window.__radarThingBooting) {
    return;
  }

  if (state.promise) {
    return;
  }

  function withCacheBust(url) {
    const separator = url.includes("?") ? "&" : "?";
    return url + separator + "t=" + Date.now();
  }

  function injectScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = withCacheBust(url);
      script.async = true;
      script.dataset.radarthing = "bundle";
      // A hung request or a bundle that throws while booting should surface
      // the same "couldn't load" message as a network failure.
      const timeoutId = setTimeout(
        () => reject(new Error("[RadarThing] Runtime bundle timed out.")),
        20000,
      );
      script.onload = () => {
        clearTimeout(timeoutId);
        if (window.__radarThingLoaded) {
          // A slow bundle can still start after the timeout has shown the
          // failure alert; take the alert down so it doesn't contradict the
          // working panel.
          document.getElementById("radarthing-load-failed")?.remove();
          resolve();
        } else reject(new Error("[RadarThing] Runtime failed to start."));
      };
      script.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error("[RadarThing] Failed to load runtime bundle."));
      };
      document.documentElement.appendChild(script);
    });
  }

  async function resolveBundleUrl() {
    try {
      const response = await fetch(withCacheBust(MANIFEST_URL), {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Manifest request failed.");
      }

      const manifest = await response.json();
      if (typeof manifest.bundle !== "string" || !manifest.bundle) {
        throw new Error("Manifest bundle URL missing.");
      }

      return new URL(manifest.bundle, BASE_URL + "/").toString();
    } catch (error) {
      console.warn("[RadarThing] Falling back to stable bundle.", error);
      return STABLE_BUNDLE_URL;
    }
  }

  state.promise = resolveBundleUrl()
    .then((bundleUrl) => injectScript(bundleUrl))
    .catch((error) => {
      console.error("[RadarThing] Loader failed.", error);
      state.promise = null;
      // Handled here (logged and shown to the pilot); re-throwing would only
      // add an unhandled-rejection error to the console.
      showLoadFailure();
    });

  // Without this the only sign of a failed load is a console message, so
  // pilots would fly without being tracked and not know why.
  function showLoadFailure() {
    if (document.getElementById("radarthing-load-failed")) return;
    const chip = document.createElement("div");
    chip.id = "radarthing-load-failed";
    chip.setAttribute("role", "alert");
    chip.style.cssText =
      "position:fixed;top:72px;right:16px;z-index:999998;display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid rgba(248,113,113,0.5);border-radius:12px;background:rgba(23,28,42,0.95);color:#fecaca;font:600 12px system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,0.4);";
    // If the bundle already ran and failed partway, a retry can't help (it
    // would refuse to run twice), so offer a reload straight away.
    const needsReload = Boolean(
      window.__radarThingNeedsReload ||
        (window.__radarThingBootAttempted && !window.__radarThingLoaded),
    );
    const text = document.createElement("span");
    text.textContent = needsReload
      ? "RadarThing didn't start properly. Reload GeoFS to try again."
      : "RadarThing couldn't load, so this flight isn't tracked.";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = needsReload ? "Reload GeoFS" : "Retry";
    retry.style.cssText =
      "padding:4px 10px;border:1px solid rgba(255,255,255,0.3);border-radius:8px;background:transparent;color:#fff;font:600 12px system-ui,sans-serif;cursor:pointer;";
    retry.onclick = () => {
      if (needsReload) {
        window.location.reload();
        return;
      }
      chip.remove();
      state.promise = resolveBundleUrl()
        .then((bundleUrl) => injectScript(bundleUrl))
        .catch(() => {
          state.promise = null;
          showLoadFailure();
        });
    };
    chip.append(text, retry);
    (document.body || document.documentElement).appendChild(chip);
  }
})();
`;
}

function buildInstaller() {
  const loaderUrl = `${siteUrl}/loader`;
  const installerUrl = `${siteUrl}/userscript/radarthing.user.js`;
  const iconUrl = `${siteUrl}/favicon.ico`;

  return `// ==UserScript==
// @name         RadarThing
// @namespace    ${siteUrl}/
// @version      ${version}
// @description  Shows your GeoFS flight on the RadarThing live radar. Loads the latest runtime from radarthing.com and, while you track a flight, sends your position and flight plan to radarthing.com.
// @author       xyzmani
// @icon         ${iconUrl}
// @match        https://www.geo-fs.com/geofs.php*
// @match        https://geo-fs.com/geofs.php*
// @match        https://*.geo-fs.com/geofs.php*
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @homepageURL  ${siteUrl}/
// @supportURL   ${siteUrl}/guides/aircraft-not-appearing
// @downloadURL  ${installerUrl}
// @updateURL    ${installerUrl}
// ==/UserScript==

(function () {
  "use strict";

  // Granting the menu API runs this file in Tampermonkey's sandbox, so page
  // globals are read through unsafeWindow. The runtime itself still loads
  // into the page through a script tag.
  const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  const LOADER_URL = ${JSON.stringify(loaderUrl)};
  const STATE_KEY = "__radarThingInstallerState";
  const state = (pageWindow[STATE_KEY] = pageWindow[STATE_KEY] || {});

  // Extension-menu shortcuts, for pilots who don't remember the hotkeys.
  if (typeof GM_registerMenuCommand === "function" && !state.menuRegistered) {
    state.menuRegistered = true;
    const send = (name) => document.dispatchEvent(new Event(name));
    GM_registerMenuCommand("Show or hide the RadarThing panel", () =>
      send("radarthing-menu-toggle-panel"),
    );
    GM_registerMenuCommand("Open airport charts", () =>
      send("radarthing-menu-open-charts"),
    );
    GM_registerMenuCommand("Reset panel position", () =>
      send("radarthing-menu-reset-position"),
    );
  }

  if (pageWindow.__radarThingLoaded || pageWindow.__radarThingBooting) {
    return;
  }

  if (state.promise) {
    return;
  }

  state.promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = LOADER_URL + "?t=" + Date.now();
    script.async = true;
    script.dataset.radarthing = "loader";
    script.onload = resolve;
    script.onerror = () =>
      reject(new Error("[RadarThing] Failed to load remote loader."));
    document.documentElement.appendChild(script);
  }).catch((error) => {
    console.error(error);
    state.promise = null;
  });
})();
`;
}

function indent(value) {
  return value
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

const sources = await Promise.all(
  sourceFiles.map(async (relativePath) => {
    const absolutePath = path.join(repoRoot, relativePath);
    const source = await readFile(absolutePath, "utf8");

    return {
      relativePath,
      content: stripUserscriptHeader(source),
    };
  }),
);

const bundle = buildBundle(sources);
const loader = buildLoader();
const installer = buildInstaller();
const manifest = JSON.stringify(
  {
    version,
    bundle: `/userscript/releases/${version}/radarthing.bundle.js`,
    generatedAt: new Date().toISOString(),
  },
  null,
  2,
);

await mkdir(releaseDir, { recursive: true });
await writeFile(stableBundlePath, bundle);
await writeFile(versionedBundlePath, bundle);
await writeFile(loaderPath, loader);
await writeFile(manifestPath, `${manifest}\n`);
await writeFile(publicInstallerPath, installer);
await writeFile(rootInstallerPath, installer);

console.log(`Built RadarThing userscript artifacts for ${version}.`);
