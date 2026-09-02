# New API Windows 桌面客户端

这是一个 Electron 桌面客户端，提供固定尺寸的本地登录、注册申请、两步验证和找回密码界面。登录成功后，客户端使用同一持久会话打开配置的 New API 成员页面，并可安全地配置和检测本机 Codex。

产品名称、安装包文件名、Logo、服务器地址、用户页面路径和接口路径都由 `desktop.config.json` 管理，不需要在源码中逐处改名。

## 当前兼容状态

- `GET /api/status`：兼容 New API
- `POST /api/user/login`：兼容 New API
- `POST /api/user/login/2fa`：兼容 New API
- `POST /api/user/registration-applications`：为管理员审核注册而预留的自定义接口，需由后续修改版 New API 实现
- `POST /api/user/password-reset-applications`：为管理员审核找回密码而预留的自定义接口，需由后续修改版 New API 实现
- `POST /api/user/password-reset-applications/status`：查询本机已提交申请的审核状态
- `POST /api/user/password-reset-applications/complete`：审核通过后提交新密码

找回密码不使用邮箱：用户先提交用户名和申请理由，管理员在 Web 端批准后，EXE 才显示“重置密码”和“再次确认重置密码”。客户端不直接连接数据库，也不包含申请表。服务端接口契约见 [SERVER-CONTRACT.md](./SERVER-CONTRACT.md)。

## 目录结构

```text
desktop-client/
├─ main.js                         Electron 窗口、IPC 和会话
├─ preload.js                      受限的页面桥接
├─ user-preload.js                 成员页面的 Codex 配置桥接
├─ src/
│  ├─ config.js                    JSON 加载与安全校验
│  ├─ new-api-client.js            New API 请求适配器
│  ├─ codex-config-manager.js       Codex 配置检测、备份和写入
│  └─ password-reset-store.js      Windows 加密申请凭证存储
├─ ui/                             本地登录界面
├─ test/                           Node 单元测试
├─ scripts/
│  ├─ visual-check.js              固定窗口截图检查
│  └─ release-local.ps1            本机完整发布脚本
├─ desktop.config.example.json     可提交的配置模板
└─ electron-builder.config.js      动态安装包配置
```

## 本地开始

```powershell
npm ci
Copy-Item desktop.config.example.json desktop.config.json
npm run check
npm test
npm run visual:check
npm start
```

正式环境应把 `serverUrl` 配置为 HTTPS，并保持 `allowInsecureHttp` 为 `false`。本地 HTTP 仅用于开发测试，不要使用正式账号密码。

“配置 Codex”使用与 CC Switch 兼容的独立 `yangtze_api` 供应商配置。API Key 写入该供应商的 `experimental_bearer_token`，不会覆盖 `auth.json` 中的官方登录，也不会删除其他供应商、模型、插件和 MCP 设置。写入前的文件备份位于 `%CODEX_HOME%\.yangtze-backups`，未设置 `CODEX_HOME` 时默认使用 `%USERPROFILE%\.codex`。

客户端与 CC Switch 都可能切换当前 `model_provider`。成员在 CC Switch 中切到其他供应商后，客户端会显示“当前供应商已切换”；再次点击“配置 Codex”即可切回本项目服务。配置变更后需要重启 Codex。

该兼容层参考了 [CC Switch](https://github.com/farion1231/cc-switch)（MIT）的供应商级凭据、配置保护和切换思路，并按 Electron/Node 重新实现；客户端不要求成员额外安装 CC Switch。

## 构建

```powershell
npm run dist:win
```

输出位于 `dist/`：

- `<artifactBaseName>-Setup-<version>-x64.exe`
- `<artifactBaseName>-Portable-<version>-x64.exe`

运行完整检查、构建并复制到 Windows 桌面：

```powershell
npm run release:local
```

## 文档

- [客户端 JSON 配置说明](./CONFIGURATION.md)
- [New API 服务端连接契约](./SERVER-CONTRACT.md)
- [GitHub 上传检查清单](./GITHUB-CHECKLIST.md)
- [品牌 Logo Markdown 预览](./ui/assets/品牌预览.md)
