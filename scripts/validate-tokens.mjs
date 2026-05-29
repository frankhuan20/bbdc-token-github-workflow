import { contrastRatio, flattenTokenEntries, getToken, readJson, tokenValueForMode, currentTokenPath } from "./token-utils.mjs";

const document = await readJson(currentTokenPath);
const errors = [];
const warnings = [];

const requiredTokens = [
  "button.primary.bg.default",
  "button.primary.bg.pressed",
  "button.primary.bg.disabled",
  "button.primary.text.default",
  "button.primary.text.disabled",
  "button.primary.padding.x",
  "button.primary.padding.y",
  "button.gap",
  "button.radius",
  "button.label.font.size",
  "button.label.line.height",
];

for (const name of requiredTokens) {
  try {
    getToken(document, name);
  } catch (error) {
    errors.push(error.message);
  }
}

for (const [name, token] of flattenTokenEntries(document)) {
  if (!token.$type) errors.push(`${name} is missing $type`);
  if (token.$value === undefined) errors.push(`${name} is missing $value`);
  for (const platform of ["web", "android", "ios", "harmony"]) {
    if (!token.codeSyntax?.[platform]) {
      errors.push(`${name} is missing codeSyntax.${platform}`);
    }
  }
  if (token.$type === "color") {
    const modes = typeof token.$value === "object" ? Object.entries(token.$value) : [["value", token.$value]];
    for (const [mode, value] of modes) {
      if (!/^#[0-9a-fA-F]{6}$/.test(String(value)) && !/^rgba?\([\d.,\s]+\)$/.test(String(value))) {
        errors.push(`${name}.${mode} must be a 6-digit hex color or rgb/rgba color`);
      }
    }
  }
  if (token.$type === "dimension" && typeof token.$value !== "number") {
    errors.push(`${name} dimension value must be a number`);
  }
}

for (const [componentName, component] of Object.entries(document.components || {})) {
  for (const tokenName of component.uses || []) {
    if (!document.tokens?.[tokenName]) {
      errors.push(`${componentName} uses missing token ${tokenName}`);
    }
  }
}

const contrast = contrastRatio(
  tokenValueForMode(getToken(document, "button.primary.text.default")),
  tokenValueForMode(getToken(document, "button.primary.bg.default")),
);
if (contrast < 4.5) {
  warnings.push(`Primary button contrast is ${contrast.toFixed(2)}. Target is 4.5 for normal text.`);
}

if (errors.length) {
  console.error("Token validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Token validation passed. ${flattenTokenEntries(document).length} tokens checked.`);
if (warnings.length) {
  console.log("Warnings:");
  for (const warning of warnings) console.log(`- ${warning}`);
}
