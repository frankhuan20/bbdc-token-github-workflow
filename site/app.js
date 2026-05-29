const previewVersion = window.BBDC_PREVIEW_VERSION || String(Date.now());
const cacheSuffix = `?v=${encodeURIComponent(previewVersion)}`;
const $ = (selector) => document.querySelector(selector);

async function requestJson(path, label) {
  const response = await fetch(`${path}${cacheSuffix}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${label} 加载失败：HTTP ${response.status}`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${label} 不是有效 JSON：${error.message}`);
  }
}

function tokenValue(tokenDocument, name, mode = "light") {
  const token = tokenDocument.tokens[name];
  const value = token.$value;
  if (value && typeof value === "object") return value[mode] ?? value.light ?? Object.values(value)[0];
  return `${value}${token.unit || ""}`;
}

function latestHistory(manifest) {
  const history = manifest.history || [];
  return history.length ? history[history.length - 1] : null;
}

function updateDescription(tokenDocument, manifest) {
  const source = tokenDocument.source || {};
  const latest = latestHistory(manifest) || {};
  return (
    source.changeDescription ||
    latest.source?.changeDescription ||
    latest.label ||
    "本次更新未填写描述。之后从 Figma 插件发布时，可以在“本次 JSON 修改描述”里补充。"
  );
}

function showUpdateToast({ kind, icon, title, message, detail }) {
  let region = $(".toast-region");
  if (!region) {
    region = document.createElement("div");
    region.className = "toast-region";
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
  }

  region.innerHTML = "";
  const toast = document.createElement("article");
  toast.className = `update-toast ${kind}`;
  toast.setAttribute("role", kind === "error" ? "alert" : "status");
  toast.innerHTML = `
    <div class="toast-icon" aria-hidden="true">${icon}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
      ${detail ? `<div class="toast-detail">${detail}</div>` : ""}
    </div>
    <button class="toast-close" type="button" aria-label="关闭通知">×</button>
  `;
  region.appendChild(toast);
  toast.querySelector(".toast-close").addEventListener("click", () => toast.remove());
}

function renderPage(tokenDocument, manifest) {
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
    .map(([label, name]) => `<div class="spec-item"><b>${label}</b><span>${tokenValue(tokenDocument, name)}</span></div>`)
    .join("");

  $("#historyList").innerHTML = (manifest.history || [])
    .slice()
    .reverse()
    .map((item, index) => {
      const command = `npm run token:rollback -- --file ${item.file}`;
      const description = item.source?.changeDescription || item.label || "snapshot";
      return `<div class="history-item"><div><b>${index + 1}. ${description}</b><span>${item.createdAt || ""}</span></div><code>${command}</code></div>`;
    })
    .join("");

  $("#modeToggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.mode === "dark" ? "light" : "dark";
    document.documentElement.dataset.mode = next;
    $("#modeToggle").textContent = next === "dark" ? "Light" : "Dark";
  });

  const description = updateDescription(tokenDocument, manifest);
  showUpdateToast({
    kind: "success",
    icon: "✅",
    title: "更新成功",
    message: description,
    detail: `版本：${tokenDocument.version}`,
  });
}

function renderFailure(error) {
  $("#versionTitle").textContent = "加载失败";
  $("#sourceText").textContent = "GitHub Pages 可能还在部署，或网络/JSON 文件暂时不可用。";
  $("#jsonPreview").textContent = error.stack || error.message || String(error);
  $("#specList").innerHTML = "";
  $("#historyList").innerHTML = "";

  showUpdateToast({
    kind: "error",
    icon: "❌",
    title: "更新失败",
    message: "没有成功读取最新 token JSON。",
    detail: error.message || String(error),
  });
}

async function init() {
  const [tokenDocument, manifest] = await Promise.all([
    requestJson("./tokens/current.json", "current.json"),
    requestJson("./tokens/manifest.json", "manifest.json"),
  ]);
  renderPage(tokenDocument, manifest);
}

init().catch(renderFailure);
