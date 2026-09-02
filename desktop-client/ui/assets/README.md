# Logo 文件夹

将自己的 Logo 放在这里，并在 `desktop.config.json` 的 `logoPath` 中填写对应路径。

- 支持格式：SVG、透明背景 PNG
- 文件名：只使用英文字母、数字、点、横线或下划线
- PNG 推荐尺寸：`512 x 512`
- PNG 推荐大小：不超过 `1 MB`
- Markdown 预览：[品牌预览.md](./品牌预览.md)

替换后运行 `npm run icon:generate` 生成 Windows 图标，再运行 `npm run visual:check` 查看窗口效果。`npm run dist:win` 会自动重新生成图标。
