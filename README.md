# YangtzeAPI - AI 终端管理系统与中转平台

管理端统一审核用户并下发配置，Windows 客户端管理 Claude Code、Codex 的连接和模型选择。

> 当前为 1.1.0 源码联调阶段，尚未部署公网服务。示例配置连接 `http://127.0.0.1:3000`，不能作为供其他用户直接联网使用的正式安装包。

## 按角色开始

| 角色 | 入口 |
| --- | --- |
| 普通用户 | [客户端使用](#客户端使用) |
| 管理员 | [服务端部署](#服务端部署) |
| 开发者 | [本地联调](#本地联调)、[客户端打包](#客户端打包) |

## 客户端使用

以下流程需要管理员先部署可访问的服务，并提供配置正确的客户端：

1. 安装所需的 Claude Code 或 Codex 外部程序，管理客户端不包含这些 Agent。
2. 运行管理客户端，提交注册申请，等待管理员审批。
3. 登录后打开 Agent 配置，获取授权模型并选择默认模型。
4. 点击“启用”，将配置写入本机，再进入对应 Agent 使用。

模型获取后全量可选，无需勾选。Kimi 属于模型选项，没有独立卡片；当前不提供 Gemini 卡片。主卡片显示服务链接，已启用按钮仍显示“启用”，颜色为灰色。

模型清单来自当前 New API 对工具令牌开放的权限；列出模型不代表已通过每种 Agent 的协议验证。Codex 需要 Responses，Claude Code 需要兼容的 Messages 接口，路由和协议转换由服务端负责。

## 服务端部署

源码分支保持分工：`main` 为客户端，`master` 为配套 New API 服务端和 Web 管理端。建议放在两个独立目录。

在准备存放项目的父目录执行一次：

```powershell
git clone --branch master --single-branch https://github.com/hexisi-touko/YangtzeAPI.git YangtzeAPI-server
```

本地部署需要已启动的 Docker Desktop。在该父目录执行：

```powershell
docker compose -f ./YangtzeAPI-server/compose.local.yaml up -d --build
```

打开 `http://127.0.0.1:3000`，按首次初始化页面创建管理员；已有部署使用原管理员账号，没有统一的预设用户名。随后配置渠道、模型、用户审批和额度。

`compose.local.yaml` 仅绑定本机端口，用于开发联调。公网部署需另行配置 HTTPS、可访问地址与持久化备份。服务端数据保存在服务端目录的 `data/`，更新源码时保留该目录。

## 本地联调

前提：Windows PowerShell、Git、Node.js 22 或更高兼容版本，以及正在运行的 Docker Desktop。首次安装依赖和构建镜像需要网络。

在同一个项目父目录获取客户端：

```powershell
git clone --branch main --single-branch https://github.com/hexisi-touko/YangtzeAPI.git YangtzeAPI-client
cd YangtzeAPI-client/desktop-client
npm run dev:local -- -ServerDirectory ../../YangtzeAPI-server
```

脚本检查依赖和 Compose 配置，构建并启动服务端，等待 `/api/status` 就绪，执行 `npm ci`，最后启动 LocalTest 客户端。服务端目录也可以传绝对路径。

只检查前提、不启动服务：

```powershell
npm run dev:local -- -ServerDirectory ../../YangtzeAPI-server -CheckOnly
```

服务端已在运行、只需开发客户端时，在 `desktop-client` 目录执行：

```powershell
npm ci
npm run start:local-test
```

关闭客户端不会停止 Docker 服务。停止服务时在项目父目录执行 `docker compose -f ./YangtzeAPI-server/compose.local.yaml stop`。启动失败时用同一路径执行 `logs --tail 100` 排查。

## 客户端打包

以下命令均在 `desktop-client` 目录执行，失败会立即停止。默认不会上传文件或复制覆盖桌面 EXE。

| 目的 | 命令 | 输出目录 |
| --- | --- | --- |
| 本地测试包 | `npm run build:local` | `dist-local-test/` |
| 正式包 | `npm run build:production` | `dist/` |
| 只检查正式配置 | `npm run build:production -- -CheckOnly` | 不生成文件 |

正式打包前，复制示例为本地配置（仅首次，勿覆盖已有配置）：

```powershell
Copy-Item desktop.config.example.json desktop.config.json
```

按 [配置说明](desktop-client/CONFIGURATION.md) 设置可访问的 HTTPS `serverUrl`，并将 `allowInsecureHttp` 设为 `false`。正式打包会拒绝 HTTP、localhost 和回环地址。检查通过不代表服务已上线，发布前仍需另一台电脑验收。

脚本依次安装锁定依赖、检查语法、运行测试并构建安装版和便携版，最后输出文件路径和 SHA256。文件名由配置和版本生成：`<前缀>-Setup-<版本>-x64.exe`、`<前缀>-Portable-<版本>-x64.exe`。

`release:local` 是本地打包的兼容入口，不再复制到桌面；`dist:win`、`dist:local-test` 为底层构建命令，不包含完整检查，请优先使用上表入口。

## 项目文档

- [更新记录](CHANGELOG.md)：新增、调整、删除、修复及已知限制。
- [验收指南](DEMO_GUIDE.md)：首次使用与正式发布验收。
- [客户端配置](desktop-client/CONFIGURATION.md)：品牌、服务地址、接口路径。
- [接口契约](desktop-client/SERVER-CONTRACT.md)：用户审核与工具配置接口。
- [模型验证记录](desktop-client/MODEL-VERIFICATION.md)：历史本机测试范围，不代表公网验收。
