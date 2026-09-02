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
  "serverUrl": "https://api.example.com",
  "userPagePath": "/client",
  "allowInsecureHttp": false,
  "apiPaths": {
    "status": "/api/status",
    "login": "/api/user/login",
    "login2fa": "/api/user/login/2fa",
    "authRefresh": "/api/user/auth/refresh",
    "tokenList": "/api/token/?p=1&size=100",
    "tokenUsage": "/api/token/usage",
    "registrationApplication": "/api/user/registration-applications",
    "passwordResetApplication": "/api/user/password-reset-applications",
    "passwordResetStatus": "/api/user/password-reset-applications/status",
    "passwordResetComplete": "/api/user/password-reset-applications/complete"
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
| `userPagePath` | 登录成功后打开的 New API 用户页面，当前为 `/client` |
| `allowInsecureHttp` | 仅本地测试或临时内网环境使用；正式发布必须为 `false` |
| `apiPaths` | 桌面客户端使用的固定站内接口路径 |

`authRefresh` 用于成员网页加载后刷新桌面客户端的登录会话；`tokenList` 用于选择管理员发放的唯一启用 Key；`tokenUsage` 用于检测 Key 和 New API 服务是否可用。找回密码使用另外三个接口路径：提交申请、查询审核状态、审批通过后完成密码重置。

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
npm run check
npm test
npm run visual:check
npm run dist:win
```

完成全部检查并复制到当前 Windows 用户桌面：

```powershell
npm run release:local
```

脚本最后会输出两个桌面 EXE 的 SHA-256 哈希。

Windows 无法覆盖正在运行的 EXE。若桌面旧版正在运行，脚本会重试后把新文件保存为 `*-new.exe` 并输出警告，不会强行结束用户进程。
