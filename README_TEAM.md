# YangtzeAPI

本仓库同时保存桌面客户端和修改后的 New API 源码，请按分支使用：

- `main`：Windows 桌面客户端。
- `codex/full-new-api-source`：修改后的完整 New API 源码。

## 查看修改后的 New API 界面

```powershell
git fetch origin
git switch codex/full-new-api-source
git pull
cd web
npm install
npm run dev
```

后端服务需要同时在 `http://localhost:3000` 运行。浏览器打开
`http://localhost:5173` 才是前端开发页面，可以立即看到源码中的 UI 修改。

不要用官方 `calciumion/new-api` Docker 镜像检查本仓库的 UI；该镜像包含的是官方预编译页面，不包含本项目的修改。
