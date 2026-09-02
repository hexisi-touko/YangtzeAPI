# YangtzeAPI 桌面客户端

本仓库按分支分别保存配套源码：

- `main`：最新版 Windows EXE 客户端源码。
- `master`：与客户端接口配套的完整修改版 New API 后端和 Web 管理端源码。

数据库、日志、`.env`、依赖和构建产物不会提交到任一分支。

## 客户端源码

桌面客户端位于 [`desktop-client/`](./desktop-client/)，包括：

- 固定尺寸的登录、注册申请、两步验证和找回密码界面
- 可通过 JSON 修改的产品名称、Logo、服务器地址和接口路径
- New API 登录与会话适配
- 注册申请、审核状态查询和审批后密码重置的客户端实现
- Windows 安装版与便携版构建脚本
- 单元测试、固定窗口截图检查和 GitHub Actions

## 与本地 New API 直接连接

将两个分支分别下载到不同目录。先在 `master` 源码目录启动修改版 New API：

```powershell
docker compose -f compose.local.yaml up -d --build
```

服务端会监听 `http://127.0.0.1:3000`，数据保存在该源码目录的 `data` 中。然后进入 `main` 分支的客户端目录：

```powershell
cd desktop-client
npm ci
npm run start:local-test
```

`desktop.config.local-test.json` 已配置为连接上述本地服务，无需再改接口地址。正式服务器部署时，应基于 `desktop.config.example.json` 创建 `desktop.config.json`，改为实际 HTTPS 地址后重新构建。

服务端对接资料：

- [`desktop-client/SERVER-CONTRACT.md`](./desktop-client/SERVER-CONTRACT.md)：请求、响应和安全约束
- [`desktop-client/INTEGRATION.md`](./desktop-client/INTEGRATION.md)：服务端实现项目与联调顺序
- [`desktop-client/CONFIGURATION.md`](./desktop-client/CONFIGURATION.md)：客户端 JSON 配置

仓库不会提交真实服务器配置、密码、令牌、数据库数据、`node_modules`、构建缓存、截图或安装包。

## 客户端验证

```powershell
cd desktop-client
npm ci
npm run check
npm test
npm run visual:check
```

生成 Windows 安装版和便携版：

```powershell
npm run dist:win
```
