import { spawn } from "node:child_process";
import { readFile, rm, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UTApi, UTFile } from "uploadthing/server";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const backupDir = path.join(repoRoot, "convex-backup");
const backupCustomIdPrefix = "convex-backup:radarthing:";

interface Options {
  convexTargetArgs: string[];
  includeFileStorage: boolean;
  keepLocal: boolean;
  retentionDays: number | null;
}

function printUsage(exitCode = 1): never {
  const output = exitCode === 0 ? console.log : console.error;

  output(`Usage: bun scripts/backup-convex-to-uploadthing.ts [options]

Options:
  --prod                         Export from the production deployment.
  --dev                          Export from the default development deployment.
  --deployment-name <name>       Export from a specific Convex deployment.
  --preview-name <name>          Export from a specific preview deployment.
  --include-file-storage         Include Convex file storage in the backup ZIP.
  --retention-days <days>        Delete older UploadThing backups from this script.
  --keep-local                   Keep the generated ZIP under convex-backup/.
  -h, --help                     Show this help.

When CONVEX_DEPLOY_KEY is set, Convex uses that key's deployment and ignores
deployment selection flags.`);
  process.exit(exitCode);
}

function parsePositiveInteger(value: string, flag: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    convexTargetArgs: process.env.CONVEX_DEPLOY_KEY ? [] : ["--prod"],
    includeFileStorage: false,
    keepLocal: false,
    retentionDays: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case "--prod":
        options.convexTargetArgs = ["--prod"];
        break;
      case "--dev":
        options.convexTargetArgs = [];
        break;
      case "--deployment-name": {
        const deploymentName = argv[++i];
        if (!deploymentName) printUsage();
        options.convexTargetArgs = ["--deployment-name", deploymentName];
        break;
      }
      case "--preview-name": {
        const previewName = argv[++i];
        if (!previewName) printUsage();
        options.convexTargetArgs = ["--preview-name", previewName];
        break;
      }
      case "--include-file-storage":
        options.includeFileStorage = true;
        break;
      case "--retention-days": {
        const days = argv[++i];
        if (!days) printUsage();
        options.retentionDays = parsePositiveInteger(days, arg);
        break;
      }
      case "--keep-local":
        options.keepLocal = true;
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

async function exportConvexBackup(options: Options) {
  await mkdir(backupDir, { recursive: true });

  const timestamp = new Date().toISOString();
  const safeTimestamp = timestamp.replaceAll(":", "-");
  const fileName = `radarthing-convex-${safeTimestamp}.zip`;
  const filePath = path.join(backupDir, fileName);

  const args = [
    "convex",
    "export",
    "--path",
    filePath,
    ...options.convexTargetArgs,
  ];

  if (options.includeFileStorage) {
    args.push("--include-file-storage");
  }

  console.log("Exporting Convex backup...");
  await runCommand("bunx", args);

  const backupStat = await stat(filePath);
  if (!backupStat.isFile() || backupStat.size === 0) {
    throw new Error(`Convex export did not create a valid ZIP at ${filePath}`);
  }

  return {
    timestamp,
    fileName,
    filePath,
    size: backupStat.size,
  };
}

async function uploadBackup(backup: {
  timestamp: string;
  fileName: string;
  filePath: string;
}) {
  const uploadThingToken = process.env.UPLOADTHING_TOKEN;
  if (!uploadThingToken) {
    throw new Error("UPLOADTHING_TOKEN must be set.");
  }

  const bytes = await readFile(backup.filePath);
  const file = new UTFile([new Uint8Array(bytes)], backup.fileName, {
    customId: `${backupCustomIdPrefix}${backup.timestamp}`,
    type: "application/zip",
  });

  console.log("Uploading backup to UploadThing...");
  const utapi = new UTApi({ token: uploadThingToken });
  const result = await utapi.uploadFiles(file, {
    acl: "private",
    contentDisposition: "attachment",
  });

  if (result.error) {
    throw new Error(`UploadThing upload failed: ${result.error.message}`);
  }

  return { utapi, uploadedFile: result.data };
}

async function pruneOldBackups(utapi: UTApi, retentionDays: number) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const keysToDelete: string[] = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const { files, hasMore } = await utapi.listFiles({ limit, offset });

    for (const file of files) {
      if (!file.customId?.startsWith(backupCustomIdPrefix)) {
        continue;
      }

      const timestamp = file.customId.slice(backupCustomIdPrefix.length);
      const createdAt = Date.parse(timestamp);
      if (!Number.isFinite(createdAt)) {
        continue;
      }

      if (createdAt < cutoff) {
        keysToDelete.push(file.key);
      }
    }

    if (!hasMore) break;
    offset += limit;
  }

  if (keysToDelete.length === 0) {
    console.log(`No UploadThing backups older than ${retentionDays} days.`);
    return;
  }

  const result = await utapi.deleteFiles(keysToDelete);
  console.log(
    `Deleted ${result.deletedCount} UploadThing backup(s) older than ${retentionDays} days.`,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const backup = await exportConvexBackup(options);
  const { utapi, uploadedFile } = await uploadBackup(backup);

  console.log(
    JSON.stringify(
      {
        uploaded: {
          key: uploadedFile.key,
          customId: uploadedFile.customId,
          name: uploadedFile.name,
          size: uploadedFile.size,
        },
      },
      null,
      2,
    ),
  );

  if (options.retentionDays !== null) {
    await pruneOldBackups(utapi, options.retentionDays);
  }

  if (!options.keepLocal) {
    await rm(backup.filePath);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
