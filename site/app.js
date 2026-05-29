const tokenResponse = await fetch("./tokens/current.json");
const tokenDocument = await tokenResponse.json();
const manifestResponse = await fetch("./tokens/manifest.json");
const manifest = await manifestResponse.json();

const $ = (selector) => document.querySelector(selector);
const token = (name) => tokenDocument.tokens[name];
const tokenValue = (name, mode = "light") => {
  const value = token(name).$value;
  if (value && typeof value === "object") return value[mode] ?? value.light ?? Object.values(value)[0];
  return `${value}${token(name).unit || ""}`;
};

$("#versionTitle").textContent = tokenDocument.version;
$("#sourceText").textContent = `${tokenDocument.source?.name || "Unknown source"} / ${tokenDocument.source?.exportedAt || ""}`;
$("#jsonPreview").textContent = JSON.stringify(tokenDocument, null, 2);

const specs = [
  ["背景色", "button.primary.bg.default"],
  ["按下色", "button.primary.bg.pressed"],
  ["圆角", "button.radius"],
  ["左右内边距", "button.primary.padding.x"],
  ["上下内边距", "button.primary.padding.y"],
  ["字号", "button.label.font.size"],
  ["行高", "button.label.line.height"],
];

$("#specList").innerHTML = specs
  .map(([label, name]) => `<div class="spec-item"><b>${label}</b><span>${tokenValue(name)}</span></div>`)
  .join("");

$("#historyList").innerHTML = (manifest.history || [])
  .slice()
  .reverse()
  .map((item, index) => {
    const command = `npm run token:rollback -- --file ${item.file}`;
    return `<div class="history-item"><div><b>${index + 1}. ${item.label || "snapshot"}</b><span>${item.createdAt || ""}</span></div><code>${command}</code></div>`;
  })
  .join("");

$("#modeToggle").addEventListener("click", () => {
  const next = document.documentElement.dataset.mode === "dark" ? "light" : "dark";
  document.documentElement.dataset.mode = next;
  $("#modeToggle").textContent = next === "dark" ? "Light" : "Dark";
});
