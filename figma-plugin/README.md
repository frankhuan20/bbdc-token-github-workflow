# BBDC Token GitHub Publisher

这个 Figma 插件用于测试「Figma Variables -> Design Token JSON -> GitHub -> Actions -> 预览页」闭环。

## 插件做什么

1. 从当前 Figma 文件读取本地 Variables。
2. 只导出 `button/` 和 `motion/button/` 前缀的 token。
3. 自动识别 Semantic collection 里的 Light / Dark mode。
4. 生成项目当前使用的 `tokens/current.json` 格式。
5. 根据你填写的「本次 JSON 修改描述」生成历史快照。
6. 通过 GitHub REST Git Database API 创建一次 commit，同时写入：
   - `tokens/current.json`
   - `tokens/history/<timestamp>_<description>.json`
   - `tokens/manifest.json`

## 安装

1. 打开 Figma。
2. 进入 `Plugins -> Development -> Import plugin from manifest...`。
3. 选择这个文件：

   `/Users/liuhuan/Documents/codex/Figma Codding/bbdc-token-github-workflow/figma-plugin/manifest.json`

4. 运行 `BBDC Token GitHub Publisher`。

## GitHub Token 要求

推荐使用 fine-grained personal access token：

- Repository access：只选择 `frankhuan20/bbdc-token-github-workflow`
- Repository permissions：`Contents` 设置为 `Read and write`

当前插件只写 `tokens/**`，不修改 `.github/workflows/**`，所以不需要 workflow 写权限。

## 使用步骤

1. 确认仓库配置：
   - Owner: `frankhuan20`
   - Repo: `bbdc-token-github-workflow`
   - Branch: `main`
2. 填写「本次 JSON 修改描述」。
3. 粘贴 GitHub Token。
4. 点击「测试连接」确认 token 可访问仓库。
5. 点击「一键导出并发布到 GitHub」。
6. 打开插件返回的 Actions 链接，等待部署完成。
7. 打开预览页检查效果。

## 注意

- GitHub Token 只在插件窗口里使用，不会写入 Figma 文件。
- 插件会保存 owner/repo/branch/preview URL，但不会保存 token。
- GitHub Pages 仍可能有短时间缓存；插件会在预览链接后追加 `?v=<token-version>`，帮助浏览器拉取新页面。
- 如果 GitHub 返回 conflict，说明远端分支刚好被别人更新了，重新点击发布即可基于最新分支再提交。

