figma.showUI(__html__, { width: 520, height: 620 });

var TOKEN_PREFIXES = ["button/", "motion/button/"];

function startsWithAnyPrefix(name) {
  for (var i = 0; i < TOKEN_PREFIXES.length; i += 1) {
    if (name.indexOf(TOKEN_PREFIXES[i]) === 0) return true;
  }
  return false;
}

function tokenNameFromFigmaName(name) {
  return name.replace(/-/g, ".").replace(/\//g, ".");
}

function camelCase(name) {
  var parts = name.split(/[./\s-]+/).filter(Boolean);
  var out = "";
  for (var i = 0; i < parts.length; i += 1) {
    var part = parts[i];
    var lower = part.charAt(0).toLowerCase() + part.slice(1);
    out += i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return out;
}

function harmonyCode(name) {
  var parts = name.split(".");
  var root = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  return "BbdcTokens." + root + "." + camelCase(parts.slice(1).join("."));
}

function cssVarFromName(name) {
  return "var(--bbdc-" + name.replace(/[./\s]+/g, "-").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase() + ")";
}

function inferType(name, resolvedType) {
  if (resolvedType === "COLOR") return "color";
  if (name.indexOf("motion") >= 0 && name.indexOf("response") >= 0) return "duration";
  if (
    resolvedType === "FLOAT" &&
    (name.indexOf("padding") >= 0 ||
      name.indexOf("radius") >= 0 ||
      name.indexOf("gap") >= 0 ||
      name.indexOf("font-size") >= 0 ||
      name.indexOf("line-height") >= 0)
  ) {
    return "dimension";
  }
  if (resolvedType === "FLOAT") return "number";
  return "string";
}

function toHexChannel(value) {
  var hex = Math.round(value * 255).toString(16);
  return hex.length === 1 ? "0" + hex : hex;
}

function normalizeValue(value, type) {
  if (type === "color" && value && typeof value === "object") {
    return "#" + toHexChannel(value.r) + toHexChannel(value.g) + toHexChannel(value.b);
  }
  return value;
}

async function getCollectionForVariable(variable) {
  if (figma.variables.getVariableCollectionByIdAsync) {
    return await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
  }
  var collections = await figma.variables.getLocalVariableCollectionsAsync();
  for (var i = 0; i < collections.length; i += 1) {
    if (collections[i].id === variable.variableCollectionId) return collections[i];
  }
  return null;
}

async function getVariableById(id) {
  if (figma.variables.getVariableByIdAsync) {
    return await figma.variables.getVariableByIdAsync(id);
  }
  var variables = await figma.variables.getLocalVariablesAsync();
  for (var i = 0; i < variables.length; i += 1) {
    if (variables[i].id === id) return variables[i];
  }
  return null;
}

async function resolveVariableValue(variable, modeId, seen) {
  seen = seen || {};
  if (seen[variable.id]) return undefined;
  seen[variable.id] = true;
  var value = variable.valuesByMode[modeId];
  if (value === undefined) {
    var collection = await getCollectionForVariable(variable);
    if (collection && collection.modes && collection.modes.length > 0) {
      value = variable.valuesByMode[collection.modes[0].modeId];
    }
  }
  if (value && typeof value === "object" && value.type === "VARIABLE_ALIAS") {
    var target = await getVariableById(value.id);
    if (!target) return undefined;
    var targetCollection = await getCollectionForVariable(target);
    var targetModeId = targetCollection && targetCollection.modes && targetCollection.modes.length > 0 ? targetCollection.modes[0].modeId : modeId;
    return await resolveVariableValue(target, targetModeId, seen);
  }
  return value;
}

function findMode(collection, pattern) {
  if (!collection || !collection.modes) return null;
  for (var i = 0; i < collection.modes.length; i += 1) {
    if (pattern.test(collection.modes[i].name)) return collection.modes[i];
  }
  return collection.modes[0] || null;
}

async function buildTokenDocument() {
  if (!figma.variables || !figma.variables.getLocalVariablesAsync) {
    throw new Error("当前 Figma 版本不支持 Variables API。请更新 Figma Desktop。");
  }

  var variables = await figma.variables.getLocalVariablesAsync();
  var collections = await figma.variables.getLocalVariableCollectionsAsync();
  var semanticCollection = null;

  for (var i = 0; i < collections.length; i += 1) {
    if (collections[i].name.indexOf("Semantic") >= 0) semanticCollection = collections[i];
  }
  if (!semanticCollection && collections.length > 0) {
    semanticCollection = collections[0];
  }

  var lightMode = findMode(semanticCollection, /light/i);
  var darkMode = findMode(semanticCollection, /dark/i) || lightMode;
  var tokens = {};

  for (var v = 0; v < variables.length; v += 1) {
    var variable = variables[v];
    if (!startsWithAnyPrefix(variable.name)) continue;

    var name = tokenNameFromFigmaName(variable.name);
    var type = inferType(variable.name, variable.resolvedType);
    var lightModeId = lightMode ? lightMode.modeId : Object.keys(variable.valuesByMode)[0];
    var darkModeId = darkMode ? darkMode.modeId : lightModeId;
    var lightValue = normalizeValue(await resolveVariableValue(variable, lightModeId), type);
    var darkValue = normalizeValue(await resolveVariableValue(variable, darkModeId), type);
    var syntax = variable.codeSyntax || {};
    var token = {
      $type: type,
      $value: type === "color" ? { light: lightValue, dark: darkValue } : lightValue,
      figmaName: variable.name,
      variableId: variable.id,
      codeSyntax: {
        web: syntax.WEB || cssVarFromName(name),
        android: syntax.ANDROID || "BbdcTokens." + camelCase(name),
        ios: syntax.iOS || "BBDCToken." + camelCase(name),
        harmony: harmonyCode(name)
      }
    };
    if (type === "dimension") token.unit = "px";
    if (type === "duration") token.unit = "s";
    tokens[name] = token;
  }

  var userName = figma.currentUser && figma.currentUser.name ? figma.currentUser.name : "Figma user";
  return {
    $schema: "https://bbdc.example/design-token.schema.json",
    version: "figma-" + Date.now(),
    source: {
      name: "BBDC Figma Export",
      figmaFile: figma.root.name,
      figmaPage: figma.currentPage.name,
      exportedAt: new Date().toISOString(),
      exportedBy: userName
    },
    modes: ["light", "dark"],
    tokens: tokens,
    components: {
      BBButton: {
        description: "Button component driven by exported Figma Variables.",
        variants: ["Primary/Default", "Primary/Pressed", "Primary/Disabled"],
        uses: Object.keys(tokens).filter(function (name) {
          return name.indexOf("button.") === 0;
        })
      }
    }
  };
}

figma.ui.onmessage = async function (message) {
  if (!message || message.type !== "collect-tokens") return;
  try {
    var document = await buildTokenDocument();
    figma.ui.postMessage({ type: "tokens-collected", document: document });
  } catch (error) {
    figma.ui.postMessage({ type: "error", message: error && error.message ? error.message : String(error) });
  }
};
