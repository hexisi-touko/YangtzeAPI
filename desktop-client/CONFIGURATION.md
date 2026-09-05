# 客户端 JSON 配置说明

桌面客户端的可变品牌和服务器参数统一放在 `desktop.config.json`。这个文件包含实际服务器地址，默认不会提交到 Git；公开仓库只提交 `desktop.config.example.json`。

首次使用：

```powershell
Copy-Item desktop.config.example.json desktop.config.json
```

## 配置示例

```json
{
  "productName": "长大计科智慧油田",
  "artifactBaseName": "API-Client",
  "logoPath": "ui/assets/logo.svg",
  "appIconPath": "build/icon.ico",
  "serverUrl": "http://127.0.0.1:3000",
  "userPagePath": "/dashboard",
  "allowInsecureHttp": true,
  "apiPaths": {
    "status": "/api/status",
    "login": "/api/user/login",
    "login2fa": "/api/user/login/2fa",
    "registrationApplication": "/api/user/registration-applications",
    "registrationApplicationStatus": "/api/user/application/status",
    "passwordResetApplication": "/api/user/password-reset-applications",
    "passwordResetStatus": "/api/user/password-reset-applications/status",
    "passwordResetComplete": "/api/user/password-reset-applications/complete",
    "desktopTools": "/api/user/desktop-tools"
  }
}
```

## 字段含义

| 字段 | 作用 |
| --- | --- |
| `productName` | 登录窗口、用户窗口、安装程序和快捷方式显示名称 |
| `artifactBaseName` | 生成的安装版和便携版 EXE 文件名前缀 |
| `logoPath` | 登录页 Logo，只允许 `ui/assets` 下的 SVG 或 PNG |
| `appIconPath` | 构建时自动生成的 Windows ICO 路径，通常不需要修改 |
| `serverUrl` | New API 站点根地址，不带 `/api` 和页面路径 |
| `userPagePath` | 登录成功后打开的 New API 用户页面 |
| `allowInsecureHttp` | 仅本地测试或临时内网环境使用；正式发布必须为 `false` |
| `apiPaths` | 桌面客户端使用的固定站内接口路径；`desktopTools` 用于读取管理员分配的工具配置 |

找回密码使用三个接口路径：提交申请、查询审核状态、审批通过后完成密码重置。只改服务端路由时，可以分别修改 `passwordResetApplication`、`passwordResetStatus` 和 `passwordResetComplete`。

仓库内的 `desktop.config.local-test.json` 已连接 `master` 分支通过 `compose.local.yaml` 启动的本地 New API，可直接使用 `npm run start:local-test` 联调。

窗口有效尺寸固定为 `420 x 620`，不放入 JSON，防止修改品牌时意外破坏界面布局。

## 更换 Logo

1. 将 SVG 或透明背景 PNG 放入 `ui/assets`。
2. 在 JSON 中修改 `logoPath`。
3. 打开 [品牌预览.md](./ui/assets/品牌预览.md) 检查 Markdown 预览。
4. 运行 `npm run icon:generate` 生成 Windows 程序图标。
5. 运行 `npm run visual:check` 检查实际 Electron 窗口。

Markdown 预览与 EXE 使用同一图片文件，但真正控制 EXE Logo 路径的是 JSON。

## 重新生成 EXE

只构建到 `dist`：

```powershell
npm run build:production
```

正式构建要求 HTTPS 服务地址且 `allowInsecureHttp=false`，拒绝回环地址。本地测试构建：

```powershell
npm run build:local
```

脚本最后会输出两个桌面 EXE 的 SHA-256 哈希。

Windows 无法覆盖正在运行的 EXE。若桌面旧版正在运行，脚本会重试后把新文件保存为 `*-new.exe` 并输出警告，不会强行结束用户进程。
