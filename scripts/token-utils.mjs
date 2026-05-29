import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const currentTokenPath = path.join(rootDir, "tokens/current.json");
export const manifestPath = path.join(rootDir, "tokens/manifest.json");
export const historyDir = path.join(rootDir, "tokens/history");

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function slugify(input) {
  return String(input || "token")
    .trim()
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "token";
}

export function safeTimestamp(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/[:.]/g, "-");
}

export function tokenCssName(token) {
  const syntax = token.codeSyntax?.web || "";
  const match = syntax.match(/var\((--[^)]+)\)/);
  return match?.[1] || `--bbdc-${token.figmaName || "token"}`.replace(/[\/.\s]+/g, "-").toLowerCase();
}

export function tokenValueForMode(token, mode = "light") {
  const value = token.$value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value[mode] ?? value.light ?? Object.values(value)[0];
  }
  return value;
}

export function cssValue(token, mode = "light") {
  const value = tokenValueForMode(token, mode);
  if (token.$type === "dimension") return `${value}${token.unit || "px"}`;
  if (token.$type === "duration") return `${value}${token.unit || "s"}`;
  return String(value);
}

export function flattenTokenEntries(tokenDocument) {
  return Object.entries(tokenDocument.tokens || {});
}

export function hexToRgb(hex) {
  if (String(hex).startsWith("rgb")) {
    const values = String(hex).match(/[\d.]+/g)?.map(Number) || [];
    if (values.length >= 3) return { r: values[0], g: values[1], b: values[2] };
  }
  const normalized = String(hex).replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function channelToLinear(channel) {
  const v = channel / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(foregroundHex, backgroundHex) {
  const foreground = hexToRgb(foregroundHex);
  const background = hexToRgb(backgroundHex);
  if (!foreground || !background) return 0;
  const l1 =
    0.2126 * channelToLinear(foreground.r) +
    0.7152 * channelToLinear(foreground.g) +
    0.0722 * channelToLinear(foreground.b);
  const l2 =
    0.2126 * channelToLinear(background.r) +
    0.7152 * channelToLinear(background.g) +
    0.0722 * channelToLinear(background.b);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

export function getToken(document, name) {
  const token = document.tokens?.[name];
  if (!token) throw new Error(`Missing required token: ${name}`);
  return token;
}
