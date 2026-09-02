# GitHub 上传检查清单

- [ ] 不提交 `desktop.config.json`，只提交 `desktop.config.example.json`
- [ ] 不提交 `.env`、密码、Cookie、令牌、数据库文件或真实服务器 IP
- [ ] 不提交 `node_modules/`、`dist/`、`artifacts/` 和桌面 EXE
- [ ] 执行 `npm ci`
- [ ] 执行 `npm run check`
- [ ] 执行 `npm test`
- [ ] 执行 `npm run visual:check`
- [ ] 使用示例配置执行一次 `npm run dist:win`
- [ ] 根据仓库公开或私有用途选择许可证
- [ ] 后续提交修改版 New API 时保留其原始版权与 AGPL 许可证要求

可以用下面的命令检查 Git 将要上传的内容：

```powershell
git status --short
git diff --cached --stat
git diff --cached -- . ':!package-lock.json'
```
