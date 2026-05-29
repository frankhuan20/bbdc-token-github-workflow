import fs from "node:fs/promises";
import path from "node:path";
import {
  currentTokenPath,
  historyDir,
  manifestPath,
  readJson,
  safeTimestamp,
  slugify,
  writeJson,
} from "./token-utils.mjs";

const args = process.argv.slice(2);
const fileArgIndex = args.findIndex((arg) => arg === "--file" || arg === "-f");
const labelArgIndex = args.findIndex((arg) => arg === "--label" || arg === "-l");
const inputFile = fileArgIndex >= 0 ? args[fileArgIndex + 1] : args[0];
const label = labelArgIndex >= 0 ? args[labelArgIndex + 1] : "figma-export";

if (!inputFile) {
  console.error("Usage: npm run token:import -- --file path/to/export.json --label figma-change");
  process.exit(1);
}

const incoming = await readJson(path.resolve(inputFile));
const timestamp = safeTimestamp();
const safeLabel = slugify(label);
const historyFile = `tokens/history/${timestamp}_${safeLabel}.json`;
const historyPath = path.join(historyDir, `${timestamp}_${safeLabel}.json`);

incoming.source = {
  ...(incoming.source || {}),
  importedAt: new Date().toISOString(),
  importedBy: "scripts/import-token.mjs",
};

await writeJson(historyPath, incoming);
await writeJson(currentTokenPath, incoming);

let manifest = { current: "tokens/current.json", history: [] };
try {
  manifest = await readJson(manifestPath);
} catch {
  // First import in a blank repo.
}

manifest.current = "tokens/current.json";
manifest.history = [
  ...(manifest.history || []),
  {
    file: historyFile,
    label,
    createdAt: incoming.source.importedAt,
    source: incoming.source,
  },
];

await writeJson(manifestPath, manifest);
console.log(`Imported token JSON into tokens/current.json`);
console.log(`History snapshot: ${historyFile}`);
