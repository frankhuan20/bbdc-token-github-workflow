import fs from "node:fs/promises";
import path from "node:path";
import { cssValue, flattenTokenEntries, readJson, rootDir, tokenCssName, currentTokenPath } from "./token-utils.mjs";

const distDir = path.join(rootDir, "dist");
const generatedDir = path.join(distDir, "generated");
const tokenDocument = await readJson(currentTokenPath);

await fs.rm(distDir, { recursive: true, force: true });
await fs.mkdir(generatedDir, { recursive: true });
await fs.cp(path.join(rootDir, "site"), distDir, { recursive: true });
await fs.cp(path.join(rootDir, "tokens"), path.join(distDir, "tokens"), { recursive: true });

const lightVars = [];
const darkVars = [];
for (const [, token] of flattenTokenEntries(tokenDocument)) {
  const name = tokenCssName(token);
  lightVars.push(`  ${name}: ${cssValue(token, "light")};`);
  darkVars.push(`  ${name}: ${cssValue(token, "dark")};`);
}

await fs.writeFile(
  path.join(generatedDir, "tokens.css"),
  `:root {\n${lightVars.join("\n")}\n}\n\n[data-mode=\"dark\"] {\n${darkVars.join("\n")}\n}\n`,
  "utf8",
);

const swift = [
  "// Generated from tokens/current.json",
  "public enum BBDCToken {",
  ...flattenTokenEntries(tokenDocument).map(([name, token]) => {
    const codeName = token.codeSyntax?.ios?.replace("BBDCToken.", "") || name.replace(/\W+/g, "_");
    return `  public static let ${codeName} = "${cssValue(token, "light")}"`;
  }),
  "}",
  "",
].join("\n");

const kotlin = [
  "// Generated from tokens/current.json",
  "object BbdcTokens {",
  ...flattenTokenEntries(tokenDocument).map(([name, token]) => {
    const codeName = token.codeSyntax?.android?.replace("BbdcTokens.", "") || name.replace(/\W+/g, "_");
    return `  const val ${codeName} = "${cssValue(token, "light")}"`;
  }),
  "}",
  "",
].join("\n");

const arkts = [
  "// Generated from tokens/current.json",
  "export const BbdcTokens = {",
  ...flattenTokenEntries(tokenDocument).map(([name, token]) => {
    const codeName = name.replace(/\./g, "_");
    return `  ${codeName}: "${cssValue(token, "light")}",`;
  }),
  "};",
  "",
].join("\n");

await fs.mkdir(path.join(generatedDir, "ios"), { recursive: true });
await fs.mkdir(path.join(generatedDir, "android"), { recursive: true });
await fs.mkdir(path.join(generatedDir, "harmony"), { recursive: true });
await fs.writeFile(path.join(generatedDir, "ios/BBDCToken.swift"), swift, "utf8");
await fs.writeFile(path.join(generatedDir, "android/BbdcTokens.kt"), kotlin, "utf8");
await fs.writeFile(path.join(generatedDir, "harmony/BbdcTokens.ets"), arkts, "utf8");

console.log(`Built preview site at ${distDir}`);
