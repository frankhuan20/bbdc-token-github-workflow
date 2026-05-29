figma.showUI(__html__, { width: 520, height: 680, themeColors: true });

const TOKEN_PREFIXES = ["button/", "motion/button/"];

function tokenNameFromFigmaName(name) {
  return name
    .replace(/-/g, ".")
    .replace(/\//g, ".")
    .replace(/\.x$/i, ".x")
    .replace(/\.y$/i, ".y");
}

function camelCase(name) {
  return name
    .split(/[./\s-]+/)
    .filter(Boolean)
    .map((part, index) => {
      const lower = part.charAt(0).toLowerCase() + part.slice(1);
      return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

function harmonyCode(name) {
  const parts = name.split(".");
  const root = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  return `BbdcTokens.${root}.${camelCase(parts.slice(1).join("."))}`;
}

function cssVarFromName(name) {
  return `var(--bbdc-${name.replace(/[./\s]+/g, "-").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()})`;
}

function inferType(name, resolvedType) {
  if (resolvedType === "COLOR") return "color";
  if (name.includes("motion") && name.includes("response")) return "duration";
  if (resolvedType === "FLOAT" && (name.includes("padding") || name.includes("radius") || name.includes("gap") || name.includes("font-size") || name.includes("line-height"))) {
    return "dimension";
  }
  if (resolvedType === "FLOAT") return "number";
  return "string";
}

function toHexChannel(value) {
  return Math.round(value * 255).toString(16).padStart(2, "0");
}

function normalizeValue(value, type) {
  if (type === "color" && value && typeof value === "object") {
    return `#${toHexChannel(value.r)}${toHexChannel(value.g)}${toHexChannel(value.b)}`;
  }
  return value;
}

async function resolveVariableValue(variable, modeId, seen = new Set()) {
  if (seen.has(variable.id)) return undefined;
  seen.add(variable.id);
  let value = variable.valuesByMode[modeId];
  if (value === undefined) {
    const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
    value = variable.valuesByMode[collection.modes[0].modeId];
  }
  if (value && typeof value === "object" && value.type === "VARIABLE_ALIAS") {
    const target = await figma.variables.getVariableByIdAsync(value.id);
    if (!target) return undefined;
    const targetCollection = await figma.variables.getVariableCollectionByIdAsync(target.variableCollectionId);
    const targetModeId = targetCollection.modes.find((mode) => mode.modeId === modeId)?.modeId || targetCollection.modes[0].modeId;
    return resolveVariableValue(target, targetModeId, seen);
  }
  return value;
}

async function buildTokenDocument() {
  const variables = await figma.variables.getLocalVariablesAsync();
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const semanticCollection =
    collections.find((collection) => collection.name.includes("Semantic")) ||
    collections.find((collection) => collection.modes.some((mode) => /light|dark/i.test(mode.name)));
  const lightMode =
    semanticCollection?.modes.find((mode) => /light/i.test(mode.name)) ||
    semanticCollection?.modes[0];
  const darkMode =
    semanticCollection?.modes.find((mode) => /dark/i.test(mode.name)) ||
    lightMode;

  const selected = variables.filter((variable) => TOKEN_PREFIXES.some((prefix) => variable.name.startsWith(prefix)));
  const tokens = {};
  for (const variable of selected) {
    const name = tokenNameFromFigmaName(variable.name);
    const type = inferType(variable.name, variable.resolvedType);
    const lightValue = normalizeValue(await resolveVariableValue(variable, lightMode?.modeId), type);
    const darkValue = normalizeValue(await resolveVariableValue(variable, darkMode?.modeId), type);
    const syntax = variable.codeSyntax || {};
    tokens[name] = {
      $type: type,
      $value: type === "color" ? { light: lightValue, dark: darkValue } : lightValue,
      ...(type === "dimension" ? { unit: "px" } : {}),
      ...(type === "duration" ? { unit: "s" } : {}),
      figmaName: variable.name,
      variableId: variable.id,
      codeSyntax: {
        web: syntax.WEB || cssVarFromName(name),
        android: syntax.ANDROID || `BbdcTokens.${camelCase(name)}`,
        ios: syntax.iOS || `BBDCToken.${camelCase(name)}`,
        harmony: harmonyCode(name),
      },
    };
  }

  return {
    $schema: "https://bbdc.example/design-token.schema.json",
    version: `figma-${Date.now()}`,
    source: {
      name: "BBDC Figma Export",
      figmaFile: figma.root.name,
      figmaPage: figma.currentPage.name,
      exportedAt: new Date().toISOString(),
      exportedBy: figma.currentUser?.name || "Figma user",
    },
    modes: ["light", "dark"],
    tokens,
    components: {
      BBButton: {
        description: "Button component driven by exported Figma Variables.",
        variants: ["Primary/Default", "Primary/Pressed", "Primary/Disabled"],
        uses: Object.keys(tokens).filter((name) => name.startsWith("button.")),
      },
    },
  };
}

figma.ui.onmessage = async (message) => {
  if (message.type === "collect-tokens") {
    try {
      const document = await buildTokenDocument();
      figma.ui.postMessage({ type: "tokens-collected", document });
    } catch (error) {
      figma.ui.postMessage({ type: "error", message: error.message || String(error) });
    }
  }
};
