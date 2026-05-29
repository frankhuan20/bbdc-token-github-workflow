# BBDC Token GitHub Workflow Demo

这是一个最小可跑通的测试闭环，用来验证：

`Figma 改按钮变量 -> 插件导出 token JSON -> 同步 GitHub -> GitHub Actions 构建网页 -> JSON 可回滚`

当前 demo 先把“客户端 Design Kit”模拟成网页，因为网页可以最快看到实际视觉变化。后续同一份 `tokens/current.json` 可以继续生成 iOS Swift Package、Android Gradle/Maven 包、HarmonyOS HAR/ohpm 包。

## 8 步流程

1. **设计系统改动**
   设计师在 Figma Variables 或组件属性里修改按钮颜色、字号、内间距、圆角等。

2. **发布 Figma Library**
   设计系统 Owner 发布库版本，并说明影响哪个 token、哪个组件、哪个状态。

3. **导出 token JSON**
   使用本项目的 Figma 插件读取 Variables、mode 和 code syntax，生成标准 `token JSON`。

4. **转换三端代码**
   本 demo 先生成网页 `tokens.css`，同时生成 Swift/Kotlin/ArkTS 样例文件。

5. **CI 自动验收**
   GitHub Actions 运行 `npm run validate`，检查字段缺失、命名、颜色格式、组件 token 覆盖。

6. **发布 Design Kit**
   本 demo 使用 GitHub Pages 发布网页预览。真实客户端可改为发布 Swift Package、Maven/Gradle、HAR/ohpm。

7. **客户端升级依赖**
   业务页面只使用 `BBButton` 等组件，不逐页改按钮样式。升级 Design Kit 版本即可。

8. **灰度与回滚**
   每次 token JSON 都写入 `tokens/history`。出问题时把历史 JSON 恢复为 `tokens/current.json`。

## 本地测试

启动网页预览：

```bash
npm run dev
```

打开：

```text
http://localhost:8787/
```

模拟一次 Figma 修改按钮：

```bash
EXPORT_FILE=$(npm run --silent token:demo -- --bg "#176c4f" --radius 22 --paddingX 30 --label green-button)
npm run token:import -- --file "$EXPORT_FILE" --label green-button
npm run dev
```

这时网页里的按钮会变成绿色，圆角和左右内边距也会变化。

## 回滚 JSON

查看历史版本：

```bash
npm run token:rollback -- --list
```

回滚到某个历史 JSON：

```bash
npm run token:rollback -- --file tokens/history/2026-05-29T00-00-00Z_initial.json
npm run dev
```

也可以用序号回滚：

```bash
npm run token:rollback -- 1
```

## Figma 插件安装

1. 打开 Figma Desktop。
2. 进入 `Plugins -> Development -> Import plugin from manifest...`。
3. 选择：

```text
figma-plugin/manifest.json
```

4. 在 Figma 文件里运行 `BBDC Token GitHub Publisher`。
5. 填写本次 JSON 修改描述。
6. 粘贴 GitHub fine-grained token。
7. 点击 `一键导出并发布到 GitHub`。

## GitHub 推送需要什么

插件直接推送 GitHub 时，需要：

- `Owner`: 例如 `frankhuan20`
- `Repo`: 例如 `bbdc-token-github-workflow`
- `Branch`: 通常是 `main`
- `GitHub token`: fine-grained token，给目标仓库 `Contents: Read and write`

插件会用 GitHub REST Git Database API 创建一个 commit，一次性更新这三个位置：

```text
tokens/current.json
tokens/history/<timestamp>_<label>.json
tokens/manifest.json
```

GitHub Actions 监听这些文件变化，自动构建并发布 Pages。

插件不会保存 GitHub token，只保存 owner/repo/branch/preview URL。

## 创建 GitHub 仓库

如果要重新创建一套测试仓库，在本目录运行：

```bash
gh auth login -h github.com
gh repo create bbdc-token-github-workflow --public --source . --remote origin --push
```

第一次 Actions 跑完后，进入 GitHub 仓库的 `Settings -> Pages`，确认 source 使用 `GitHub Actions`。

## 文件说明

```text
figma-plugin/              Figma 插件，负责导出 JSON 和推送 GitHub
tokens/current.json        当前生效 token
tokens/history/            每次导出的 token 快照，可回滚
tokens/manifest.json       历史版本索引
scripts/validate-tokens    CI 校验
scripts/build-site         把 token 转成网页 CSS 和三端样例代码
site/                      网页预览源文件
.github/workflows/         GitHub Actions 自动构建与发布 Pages
```
