figma.showUI(__html__, { width: 640, height: 860 });

var SETTINGS_KEY = "bbdc-token-github-publisher-settings-v1";
var TOKEN_KEY = "bbdc-token-github-publisher-token-v1";
var TOKEN_PREFIXES = ["button/", "motion/button/"];

function startsWithAnyPrefix(name) {
  for (var i = 0; i < TOKEN_PREFIXES.length; i += 1) {
    if (name.indexOf(TOKEN_PREFIXES[i]) === 0) return true;
  }
  return false;
}

function safeTimestamp(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/[:.]/g, "-");
}

function tokenNameFromFigmaName(name) {
  return String(name || "")
    .trim()
    .replace(/\//g, ".")
    .replace(/-/g, ".")
    .replace(/\s+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\./, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

function camelCase(name) {
  var parts = String(name || "").split(/[./\s-]+/).filter(Boolean);
  var out = "";
  for (var i = 0; i < parts.length; i += 1) {
    var lower = parts[i].charAt(0).toLowerCase() + parts[i].slice(1);
    out += i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return out || "token";
}

function pascalCase(name) {
  var value = camelCase(name);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function harmonyCode(name) {
  var parts = String(name || "").split(".");
  var root = pascalCase(parts[0] || "token");
  var leaf = camelCase(parts.slice(1).join(".")) || camelCase(name);
  return "BbdcTokens." + root + "." + leaf;
}

function cssVarFromName(name) {
  return "var(--bbdc-" + String(name || "token").replace(/[./\s]+/g, "-").toLowerCase() + ")";
}

function syntaxValue(syntax, keys) {
  if (!syntax) return null;
  for (var i = 0; i < keys.length; i += 1) {
    if (syntax[keys[i]]) return syntax[keys[i]];
  }
  return null;
}

function inferType(name, resolvedType) {
  var normalized = tokenNameFromFigmaName(name);
  if (resolvedType === "COLOR") return "color";
  if (resolvedType === "STRING") return "string";
  if (resolvedType === "BOOLEAN") return "boolean";
  if (normalized.indexOf("motion") >= 0 && normalized.indexOf("response") >= 0) return "duration";
  if (
    resolvedType === "FLOAT" &&
    (normalized.indexOf("padding") >= 0 ||
      normalized.indexOf("radius") >= 0 ||
      normalized.indexOf("gap") >= 0 ||
      normalized.indexOf("font.size") >= 0 ||
      normalized.indexOf("line.height") >= 0 ||
      normalized.indexOf("min.height") >= 0)
  ) {
    return "dimension";
  }
  if (resolvedType === "FLOAT") return "number";
  return "string";
}

function toCssChannel(value) {
  return Math.max(0, Math.min(255, Math.round((value || 0) * 255)));
}

function toHexChannel(value) {
  return toCssChannel(value).toString(16).padStart(2, "0").toUpperCase();
}

function normalizeNumber(value) {
  if (typeof value !== "number") return value;
  return Number(value.toFixed(4));
}

function normalizeValue(value, type) {
  if (type === "color" && value && typeof value === "object") {
    var alpha = value.a === undefined ? 1 : value.a;
    if (alpha >= 0.999) {
      return "#" + toHexChannel(value.r) + toHexChannel(value.g) + toHexChannel(value.b);
    }
    return (
      "rgba(" +
      toCssChannel(value.r) +
      ", " +
      toCssChannel(value.g) +
      ", " +
      toCssChannel(value.b) +
      ", " +
      Number(alpha.toFixed(3)) +
      ")"
    );
  }
  return normalizeNumber(value);
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

function findMode(collection, pattern) {
  if (!collection || !collection.modes) return null;
  for (var i = 0; i < collection.modes.length; i += 1) {
    if (pattern.test(collection.modes[i].name)) return collection.modes[i];
  }
  return null;
}

function findModeByName(collection, preferredName) {
  if (!collection || !collection.modes || !preferredName) return null;
  for (var i = 0; i < collection.modes.length; i += 1) {
    if (collection.modes[i].name.toLowerCase() === preferredName.toLowerCase()) {
      return collection.modes[i];
    }
  }
  return null;
}

function fallbackMode(collection) {
  return collection && collection.modes && collection.modes.length > 0 ? collection.modes[0] : null;
}

async function resolveVariableValue(variable, modeName, fallbackModeId, seen) {
  seen = seen || {};
  if (seen[variable.id]) return undefined;
  seen[variable.id] = true;

  var collection = await getCollectionForVariable(variable);
  var mode = findModeByName(collection, modeName) || fallbackMode(collection);
  var modeId = mode ? mode.modeId : fallbackModeId;
  var value = variable.valuesByMode[modeId];

  if (value === undefined && fallbackModeId) {
    value = variable.valuesByMode[fallbackModeId];
  }
  if (value === undefined && collection && collection.modes && collection.modes.length > 0) {
    value = variable.valuesByMode[collection.modes[0].modeId];
  }

  if (value && typeof value === "object" && value.type === "VARIABLE_ALIAS") {
    var target = await getVariableById(value.id);
    if (!target) return undefined;
    return await resolveVariableValue(target, modeName, fallbackModeId, seen);
  }
  return value;
}

function collectionForExport(collections) {
  for (var i = 0; i < collections.length; i += 1) {
    if (/semantic/i.test(collections[i].name)) return collections[i];
  }
  return collections[0] || null;
}

function codeSyntaxFor(variable, tokenName) {
  var syntax = variable.codeSyntax || {};
  return {
    web: syntaxValue(syntax, ["WEB", "web"]) || cssVarFromName(tokenName),
    android: syntaxValue(syntax, ["ANDROID", "android"]) || "BbdcTokens." + camelCase(tokenName),
    ios: syntaxValue(syntax, ["iOS", "IOS", "ios"]) || "BBDCToken." + camelCase(tokenName),
    harmony: syntaxValue(syntax, ["HARMONY", "harmony", "ARKTS", "arkts"]) || harmonyCode(tokenName),
  };
}

async function buildTokenDocument(changeDescription) {
  if (!figma.variables || !figma.variables.getLocalVariablesAsync) {
    throw new Error("当前 Figma 版本不支持 Variables API，请更新 Figma Desktop。");
  }

  var variables = await figma.variables.getLocalVariablesAsync();
  var collections = await figma.variables.getLocalVariableCollectionsAsync();
  var semanticCollection = collectionForExport(collections);
  var lightMode = findMode(semanticCollection, /light|亮|浅/i) || fallbackMode(semanticCollection);
  var darkMode = findMode(semanticCollection, /dark|暗|深/i) || lightMode;
  var lightModeName = lightMode ? lightMode.name : "light";
  var darkModeName = darkMode ? darkMode.name : lightModeName;
  var tokens = {};

  for (var i = 0; i < variables.length; i += 1) {
    var variable = variables[i];
    if (!startsWithAnyPrefix(variable.name)) continue;

    var name = tokenNameFromFigmaName(variable.name);
    var type = inferType(variable.name, variable.resolvedType);
    var lightValue = normalizeValue(await resolveVariableValue(variable, lightModeName, lightMode && lightMode.modeId), type);
    var darkValue = normalizeValue(await resolveVariableValue(variable, darkModeName, darkMode && darkMode.modeId), type);
    var token = {
      $type: type,
      $value: type === "color" ? { light: lightValue, dark: darkValue } : lightValue,
      figmaName: variable.name,
      variableId: variable.id,
      codeSyntax: codeSyntaxFor(variable, name),
    };
    if (type === "dimension") token.unit = "px";
    if (type === "duration") token.unit = "s";
    tokens[name] = token;
  }

  if (Object.keys(tokens).length === 0) {
    throw new Error("没有找到 button/ 或 motion/button/ 前缀的本地 Figma Variables。");
  }

  var now = new Date();
  var userName = figma.currentUser && figma.currentUser.name ? figma.currentUser.name : "Figma user";
  return {
    $schema: "https://bbdc.example/design-token.schema.json",
    version: "figma-" + safeTimestamp(now),
    source: {
      name: "BBDC Figma Variables Export",
      figmaFile: figma.root.name,
      figmaPage: figma.currentPage.name,
      figmaCollection: semanticCollection ? semanticCollection.name : "",
      modes: { light: lightModeName, dark: darkModeName },
      exportedAt: now.toISOString(),
      exportedBy: userName,
      changeDescription: changeDescription || "",
    },
    modes: ["light", "dark"],
    tokens: tokens,
    components: {
      BBButton: {
        description: "Button component driven by exported Figma Variables.",
        variants: ["Primary/Default", "Primary/Pressed", "Primary/Disabled"],
        uses: Object.keys(tokens).filter(function (tokenName) {
          return tokenName.indexOf("button.") === 0;
        }),
      },
    },
  };
}

function publicSettings(settings) {
  settings = settings || {};
  return {
    owner: settings.owner || "frankhuan20",
    repo: settings.repo || "bbdc-token-github-workflow",
    branch: settings.branch || "main",
    pagesUrl: settings.pagesUrl || "https://frankhuan20.github.io/bbdc-token-github-workflow/",
  };
}

async function loadSettings() {
  var settings = {};
  var savedToken = "";
  try {
    settings = (await figma.clientStorage.getAsync(SETTINGS_KEY)) || {};
  } catch (error) {
    settings = {};
  }
  try {
    savedToken = (await figma.clientStorage.getAsync(TOKEN_KEY)) || "";
  } catch (error) {
    savedToken = "";
  }
  figma.ui.postMessage({
    type: "settings-loaded",
    settings: publicSettings(settings),
    savedToken: savedToken,
    hasSavedToken: Boolean(savedToken),
  });
}

async function saveSettings(settings) {
  await figma.clientStorage.setAsync(
    SETTINGS_KEY,
    publicSettings({
      owner: settings && settings.owner,
      repo: settings && settings.repo,
      branch: settings && settings.branch,
      pagesUrl: settings && settings.pagesUrl,
    }),
  );
  await loadSettings();
}

async function saveToken(token) {
  await figma.clientStorage.setAsync(TOKEN_KEY, token || "");
  await loadSettings();
}

figma.ui.onmessage = async function (message) {
  try {
    if (!message || !message.type) return;

    if (message.type === "get-settings") {
      await loadSettings();
      return;
    }

    if (message.type === "save-settings") {
      await saveSettings(message.settings || {});
      figma.notify("GitHub 仓库配置已保存");
      return;
    }

    if (message.type === "save-token") {
      await saveToken(message.token || "");
      figma.notify(message.token ? "GitHub Token 已保存" : "GitHub Token 已清除");
      return;
    }

    if (message.type === "clear-token") {
      await saveToken("");
      figma.notify("GitHub Token 已清除");
      return;
    }

    if (message.type === "collect-tokens") {
      var document = await buildTokenDocument(message.description || "");
      figma.ui.postMessage({ type: "tokens-collected", document: document, requestId: message.requestId });
      return;
    }

    if (message.type === "notify") {
      figma.notify(message.message || "");
    }
  } catch (error) {
    figma.ui.postMessage({
      type: "error",
      requestId: message && message.requestId,
      message: error && error.message ? error.message : String(error),
    });
  }
};

loadSettings();
