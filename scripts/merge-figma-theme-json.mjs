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
const arg = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

const lightFile = arg("--light");
const darkFile = arg("--dark");
const label = arg("--label") || "figma-light-dark";

if (!lightFile || !darkFile) {
  console.error("Usage: node scripts/merge-figma-theme-json.mjs --light path/Light.tokens.json --dark path/Dark.tokens.json --label figma-light-dark");
  process.exit(1);
}

const light = await readJson(path.resolve(lightFile));
const dark = await readJson(path.resolve(darkFile));

function walkTokens(node, prefix = [], out = {}) {
  for (const [key, value] of Object.entries(node || {})) {
    if (value && typeof value === "object" && ("$value" in value || "$type" in value)) {
      out[prefix.concat(key).join(".")] = value;
    } else if (value && typeof value === "object") {
      walkTokens(value, prefix.concat(key), out);
    }
  }
  return out;
}

function normalizeFlatName(name) {
  return name
    .replace(/\.padding-x$/g, ".padding.x")
    .replace(/\.padding-y$/g, ".padding.y")
    .replace(/\.font-size$/g, ".font.size")
    .replace(/\.line-height$/g, ".line.height")
    .replace(/\.min-height$/g, ".min.height");
}

function colorToCss(value) {
  if (!value || typeof value !== "object") return String(value);
  if (typeof value.hex === "string" && (value.alpha === undefined || value.alpha >= 0.999)) {
    return value.hex.toUpperCase();
  }
  const components = value.components || [0, 0, 0];
  const r = Math.round((components[0] || 0) * 255);
  const g = Math.round((components[1] || 0) * 255);
  const b = Math.round((components[2] || 0) * 255);
  const alpha = value.alpha === undefined ? 1 : Number(value.alpha.toFixed(3));
  return alpha >= 0.999 ? `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase()}` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function codeSyntaxFor(flatName, token) {
  const figmaSyntax = token?.$extensions?.["com.figma.codeSyntax"] || {};
  const camel = flatName
    .split(/[.\s-]+/)
    .filter(Boolean)
    .map((part, index) => {
      const lower = part.toLowerCase();
      return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
  const harmonyRoot = flatName.split(".")[0];
  return {
    web: figmaSyntax.WEB || `var(--bbdc-${flatName.replace(/[.\s]+/g, "-").toLowerCase()})`,
    android: figmaSyntax.ANDROID || `BbdcTokens.${camel}`,
    ios: figmaSyntax.iOS || `BBDCToken.${camel}`,
    harmony: `BbdcTokens.${harmonyRoot.charAt(0).toUpperCase() + harmonyRoot.slice(1)}.${camel.replace(new RegExp(`^${harmonyRoot}`, "i"), "") || camel}`,
  };
}

function tokenType(flatName, sourceToken) {
  if (sourceToken.$type === "color") return "color";
  if (flatName.includes("motion") && flatName.includes("response")) return "duration";
  if (flatName.includes("padding") || flatName.includes("radius") || flatName.includes("gap") || flatName.includes("font.size") || flatName.includes("line.height") || flatName.includes("min.height")) {
    return "dimension";
  }
  return "number";
}

const lightFlat = walkTokens(light);
const darkFlat = walkTokens(dark);
const names = Array.from(new Set([...Object.keys(lightFlat), ...Object.keys(darkFlat)].map(normalizeFlatName))).sort();
const tokens = {};

for (const name of names) {
  const rawLightName = Object.keys(lightFlat).find((key) => normalizeFlatName(key) === name);
  const rawDarkName = Object.keys(darkFlat).find((key) => normalizeFlatName(key) === name);
  const lightToken = lightFlat[rawLightName] || darkFlat[rawDarkName];
  const darkToken = darkFlat[rawDarkName] || lightFlat[rawLightName];
  const type = tokenType(name, lightToken);
  const figmaName = name.replace(/\./g, "/").replace(/font\/size$/, "font-size").replace(/line\/height$/, "line-height").replace(/min\/height$/, "min-height").replace(/padding\/x$/, "padding-x").replace(/padding\/y$/, "padding-y");
  const token = {
    $type: type,
    $value: type === "color"
      ? {
          light: colorToCss(lightToken.$value),
          dark: colorToCss(darkToken.$value),
        }
      : lightToken.$value,
    figmaName,
    codeSyntax: codeSyntaxFor(name, lightToken),
  };
  if (type === "dimension") token.unit = "px";
  if (type === "duration") token.unit = "s";
  tokens[name] = token;
}

const now = new Date().toISOString();
const document = {
  $schema: "https://bbdc.example/design-token.schema.json",
  version: `figma-${safeTimestamp()}`,
  source: {
    name: "BBDC Figma Light/Dark Export",
    exportedAt: now,
    exportedBy: "merge-figma-theme-json.mjs",
    files: {
      light: path.resolve(lightFile),
      dark: path.resolve(darkFile),
    },
  },
  modes: ["light", "dark"],
  tokens,
  components: {
    BBButton: {
      description: "Button component driven by merged Light/Dark Figma token JSON.",
      variants: ["Primary/Default", "Primary/Pressed", "Primary/Disabled"],
      uses: Object.keys(tokens).filter((name) => name.startsWith("button.")),
    },
  },
};

const historyFile = `tokens/history/${safeTimestamp()}_${slugify(label)}.json`;
await writeJson(path.join(historyDir, path.basename(historyFile)), document);
await writeJson(currentTokenPath, document);

let manifest = { current: "tokens/current.json", history: [] };
try {
  manifest = await readJson(manifestPath);
} catch {
  // Empty project.
}
manifest.current = "tokens/current.json";
manifest.history = [
  ...(manifest.history || []),
  {
    file: historyFile,
    label,
    createdAt: now,
    source: document.source,
  },
];
await writeJson(manifestPath, manifest);

console.log(`Merged ${names.length} tokens into tokens/current.json`);
console.log(`History snapshot: ${historyFile}`);
