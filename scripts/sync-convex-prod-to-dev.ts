import { spawn } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const backupDir = path.join(repoRoot, "convex-backup");

interface Options {
  yes: boolean;
  keepProdExport: boolean;
}

function printUsage(exitCode = 1): never {
  const writer = exitCode === 0 ? console.log : console.error;

  writer(`Usage: bun scripts/sync-convex-prod-to-dev.ts [options]

Exports the production Convex deployment and imports it into the default
development deployment with --replace-all.

Safety behavior:
  1. Export a backup of the current dev deployment into convex-backup/
  2. Export the production deployment into convex-backup/
  3. Replace the default dev deployment with the production snapshot

Options:
  -y, --yes           Skip the destructive confirmation prompt.
  --keep-prod-export  Keep the temporary production export ZIP after a
                      successful sync.
  -h, --help          Show this help.

This script refuses to run when CONVEX_DEPLOY_KEY is set because that variable
changes which deployment the Convex CLI targets.`);
  process.exit(exitCode);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    yes: false,
    keepProdExport: false,
  };

  for (const arg of argv) {
    switch (arg) {
      case "-y":
      case "--yes":
        options.yes = true;
        break;
      case "--keep-prod-export":
        options.keepProdExport = true;
        break;
      case "-h":
      case "--help":
        printUsage(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function requireSafeEnvironment() {
  if (process.env.CONVEX_DEPLOY_KEY) {
    throw new Error(
      "Refusing to run with CONVEX_DEPLOY_KEY set. Unset it first so Convex export/import target prod and the default dev deployment correctly.",
    );
  }
}

async function runCommand(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}

function createBackupPaths() {
  const timestamp = new Date().toISOString().replaceAll(":", "-");

  return {
    devBackupPath: path.join(
      backupDir,
      `radarthing-dev-before-prod-sync-${timestamp}.zip`,
    ),
    prodExportPath: path.join(
      backupDir,
      `radarthing-prod-for-dev-sync-${timestamp}.zip`,
    ),
  };
}

async function ensureZipExists(zipPath: string) {
  const file = await stat(zipPath);
  if (!file.isFile() || file.size === 0) {
    throw new Error(`Convex did not create a valid ZIP at ${zipPath}`);
  }
}

async function confirmSync() {
  if (!input.isTTY || !output.isTTY) {
    throw new Error(
      "Confirmation required, but no TTY is available. Re-run with --yes if you intend to replace the dev deployment.",
    );
  }

  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(
      'This will replace all data in the default Convex dev deployment with production data. Type "sync dev" to continue: ',
    );
    if (answer.trim() !== "sync dev") {
      throw new Error("Sync cancelled.");
    }
  } finally {
    rl.close();
  }
}

async function exportDevBackup(devBackupPath: string) {
  console.log(`Exporting current dev deployment to ${devBackupPath}...`);
  await runCommand("bunx", ["convex", "export", "--path", devBackupPath]);
  await ensureZipExists(devBackupPath);
}

async function exportProdSnapshot(prodExportPath: string) {
  console.log(`Exporting production deployment to ${prodExportPath}...`);
  await runCommand("bunx", [
    "convex",
    "export",
    "--path",
    prodExportPath,
    "--prod",
  ]);
  await ensureZipExists(prodExportPath);
}

async function importProdIntoDev(prodExportPath: string, skipPrompt: boolean) {
  const args = [
    "convex",
    "import",
    prodExportPath,
    "--replace-all",
  ];

  if (skipPrompt) {
    args.push("--yes");
  }

  console.log("Importing production snapshot into the default dev deployment...");
  await runCommand("bunx", args);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  requireSafeEnvironment();

  await mkdir(backupDir, { recursive: true });
  const { devBackupPath, prodExportPath } = createBackupPaths();

  if (!options.yes) {
    await confirmSync();
  }

  await exportDevBackup(devBackupPath);
  await exportProdSnapshot(prodExportPath);
  await importProdIntoDev(prodExportPath, options.yes);

  if (!options.keepProdExport) {
    await rm(prodExportPath, { force: true });
  }

  console.log("");
  console.log("Prod data synced into the default dev deployment.");
  console.log(`Dev backup kept at: ${devBackupPath}`);
  if (options.keepProdExport) {
    console.log(`Production export kept at: ${prodExportPath}`);
  }
  console.log(
    `To restore dev later: bunx convex import ${JSON.stringify(devBackupPath)} --replace-all`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
