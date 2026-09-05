# YangtzeAPI - AI 终端管理系统与中转平台

## 当前状态：1.1.0 源码更新

2026-09-05 更新客户端与配套服务端源码，安装包暂不发布。正式配置和 LocalTest 配置目前都连接 `http://127.0.0.1:3000`，尚无公网服务，其他用户不能仅下载客户端就完成联网使用。

当前内置 Agent 为 **Claude Code、Codex**。Kimi 作为授权模型选择，不再提供独立聊天卡片；Gemini 卡片已移除。两种 Agent 均可获取授权模型并选择默认模型，无需逐个勾选。模型显示不保证协议兼容，网关仍需配置对应路由与转换。

本次新增、调整、删除、修复和限制见 [更新日志](CHANGELOG.md)。下方原有说明和 [旧演示指南](DEMO_GUIDE.md) 中有关 Gemini、独立 Kimi 聊天、全只读模型和绿色启动按钮的描述属于旧版本，以本节及最新更新日志为准。

### 对外使用前

1. 部署 `master` 分支服务端，配置 HTTPS、模型渠道、审核与额度。
2. 按 [客户端配置手册](desktop-client/CONFIGURATION.md) 设置正式服务地址，再构建客户端。
3. 用户安装所需的 Claude Code 或 Codex 外部程序；管理客户端不内置这些 Agent。
4. 验证注册、审批、登录、模型获取、启用及真实调用后，再发布安装包。

本仓库按分支分别管理配套源码与架构：

- **`main` 分支（默认分支）**：最新版 Windows 桌面客户端源码、CC-Switch 风格 AI 终端工作台、配置文件与完整演示指南。
- **`master` 分支**：与客户端接口配套的修改版 New API 后端与 Web 管理端源码（包含用户审核、自动发 Key、额度注资与 Docker 部署配置）。

---

## 快速导航

- 📖 **演示与验收交付手册**：详见 [`DEMO_GUIDE.md`](./DEMO_GUIDE.md)（包含初期准备、9 步标准演示闭环以及纯净环境 0 配置测试规范）。
- 📝 **版本更新对比记录**：详见 [`CHANGELOG.md`](./CHANGELOG.md)（记录本次相比原仓库的全部改动与优化项）。
- ⚙️ **客户端配置手册**：详见 [`desktop-client/CONFIGURATION.md`](./desktop-client/CONFIGURATION.md)。
- 🔌 **服务端接口协议规范**：详见 [`desktop-client/SERVER-CONTRACT.md`](./desktop-client/SERVER-CONTRACT.md)。

---

## 核心特性

1. **单 Agent 单账号托管**：
   - 彻底告别繁琐的手动配置，Codex、Claude Code、Gemini 每个 Agent 固定一张卡片一套专属配置；
   - 管理员在后台审核通过后，系统全自动为用户生成专属唯一 API 密钥与初始可用额度，用户端只读锁定防篡改。
2. **纯白无边框沉浸式体验**：
   - 采用纯白高雅自绘标题栏，消除系统黑边；
   - 内嵌“长大实验室”专属矢量 SVG 徽标；
   - 配备 ☀️ 浅色 / 🌙 深色 主题一键平滑切换。
3. **1:1 原版配置详情弹窗**：
   - 点击卡片右侧 ✏️ 即可唤出完整配置弹窗；
   - 包含官网链接、真实 API Key（明文展示+眼睛切换）、API 服务端点（带完整 URL 开关与测速）、默认模型、Responses 原生上游格式、根据 URL 动态拉取的模型映射列表、自定义 User-Agent、本地代理覆盖以及动态渲染的 `auth.json` 与 `config.toml`。
4. **一键启用与开箱即用**：
   - 点击「▷ 启用」，系统自动将合规的 TOML 与 JSON 配置原子写入用户本地环境；
   - 彻底修复 `config_load` 语法冲突与 WSL 报错；
   - 蓝边动态高亮表示已激活，自动唤起本地 Codex / ChatGPT 客户端并顺畅完成对话。

---

## 本地快速联调与运行

### 1. 启动管理端（服务端）

切换至 `master` 源码分支目录，执行 Docker Compose 构建并启动：

```powershell
docker compose -f compose.local.yaml up -d --build
```

- 管理端服务启动后监听 `http://127.0.0.1:3000`；
- 浏览器打开 `http://127.0.0.1:3000` 登录管理员账号（默认 `Tsuki`），并在【渠道】中配置好一条可用的上游模型渠道。

### 2. 运行桌面客户端

在 `main` 分支的客户端目录执行：

```powershell
cd desktop-client
npm ci
npm run start:local-test
```

`desktop.config.local-test.json` 默认已配置为直连本地 `http://127.0.0.1:3000`，无需任何修改即可直接联调。

---

## 客户端打包与构建

在 `desktop-client/` 目录下执行以下命令：

```powershell
cd desktop-client

# 运行代码规范自检与自动化测试 (26项全通)
npm run check
npm test

# 一键打包生成 Windows 安装版 (.exe) 与免安装便携版 (.exe)
npm run dist:win
```

构建产物将保存在 `desktop-client/dist/` 目录下：
- **安装版**：`API-Client-Setup-1.0.0-x64.exe`
- **便携版**：`API-Client-Portable-1.0.0-x64.exe`

*(注：如果需要针对本地测试环境单独打包，执行 `npm run dist:local-test` 即可，产物生成在 `dist-local-test/` 目录)*
