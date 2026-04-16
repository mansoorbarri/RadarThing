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

  window.__radarThingBooting = true;

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
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("[RadarThing] Failed to load runtime bundle."));
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
      throw error;
    });
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
// @description  Loads the latest RadarThing runtime for GeoFS from radarthing.com
// @author       xyzmani
// @icon         ${iconUrl}
// @match        http://*/geofs.php*
// @match        https://*/geofs.php*
// @grant        none
// @downloadURL  ${installerUrl}
// @updateURL    ${installerUrl}
// ==/UserScript==

(function () {
  "use strict";

  const LOADER_URL = ${JSON.stringify(loaderUrl)};
  const STATE_KEY = "__radarThingInstallerState";
  const state = (window[STATE_KEY] = window[STATE_KEY] || {});

  if (window.__radarThingLoaded || window.__radarThingBooting) {
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
    throw error;
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
