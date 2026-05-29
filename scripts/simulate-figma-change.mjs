import fs from "node:fs/promises";
import path from "node:path";
import { currentTokenPath, readJson, rootDir, safeTimestamp } from "./token-utils.mjs";

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const bg = getArg("--bg", "#176c4f");
const radius = Number(getArg("--radius", 22));
const paddingX = Number(getArg("--paddingX", 30));
const label = getArg("--label", "simulated-figma-change");

const document = await readJson(currentTokenPath);
document.version = `0.1.${Date.now()}`;
document.source = {
  ...(document.source || {}),
  name: "Simulated Figma Export",
  exportedAt: new Date().toISOString(),
  exportedBy: "scripts/simulate-figma-change.mjs",
};

document.tokens["button.primary.bg.default"].$value.light = bg;
document.tokens["button.primary.bg.default"].$value.dark = bg;
document.tokens["button.primary.bg.pressed"].$value.light = bg;
document.tokens["button.radius"].$value = radius;
document.tokens["button.primary.padding.x"].$value = paddingX;

const tempDir = path.join(rootDir, ".tmp");
await fs.mkdir(tempDir, { recursive: true });
const exportPath = path.join(tempDir, `${safeTimestamp()}_${label}.json`);
await fs.writeFile(exportPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");

console.log(exportPath);
