import path from "node:path";
import {
  currentTokenPath,
  manifestPath,
  readJson,
  rootDir,
  safeTimestamp,
  writeJson,
} from "./token-utils.mjs";

const args = process.argv.slice(2);
const listMode = args.includes("--list");
const fileArgIndex = args.findIndex((arg) => arg === "--file" || arg === "-f");
const target = fileArgIndex >= 0 ? args[fileArgIndex + 1] : args[0];

let manifest = await readJson(manifestPath);

if (listMode || !target) {
  console.log("Available history snapshots:");
  for (const [index, item] of (manifest.history || []).entries()) {
    console.log(`${index + 1}. ${item.file}  ${item.label || ""}  ${item.createdAt || ""}`);
  }
  if (!target) {
    console.log("\nRollback usage: npm run token:rollback -- --file tokens/history/<snapshot>.json");
  }
  process.exit(0);
}

const normalized = target.match(/^\d+$/)
  ? manifest.history[Number(target) - 1]?.file
  : target;

if (!normalized) {
  console.error(`Cannot find rollback target: ${target}`);
  process.exit(1);
}

const snapshotPath = path.resolve(rootDir, normalized);
const snapshot = await readJson(snapshotPath);
snapshot.source = {
  ...(snapshot.source || {}),
  rolledBackAt: new Date().toISOString(),
  rolledBackFrom: normalized,
};

await writeJson(currentTokenPath, snapshot);
manifest.history = [
  ...(manifest.history || []),
  {
    file: normalized,
    label: `rollback -> ${normalized}`,
    createdAt: snapshot.source.rolledBackAt,
    source: "rollback",
  },
];
await writeJson(manifestPath, manifest);

console.log(`Rolled back tokens/current.json to ${normalized}`);
console.log("Run npm run build to refresh the preview site.");
