const [major] = process.versions.node.split(".").map(Number);

if (!Number.isFinite(major)) {
  console.error("Unable to detect the current Node.js version.");
  process.exit(1);
}

if (major < 20 || major >= 26) {
  console.error(
    [
      `Unsupported Node.js version: ${process.versions.node}`,
      "RadarThing requires Node.js >=20 and <26 for Next.js/Tailwind development.",
      "Use Node 22 LTS for local dev to avoid the Tailwind module.register() deprecation on Node 26.",
    ].join("\n"),
  );
  process.exit(1);
}
