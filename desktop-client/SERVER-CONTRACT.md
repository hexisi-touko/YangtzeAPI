# New API 桌面客户端连接契约

本文只定义 EXE 与 New API 后端之间的 HTTP 契约。数据库表、管理员审核接口和 Web 管理页面属于 New API 服务端源码，不属于 Electron 客户端。

所有接口必须位于 `desktop.config.json` 中 `serverUrl` 的同一 Origin。正式环境必须使用 HTTPS。

## 系统状态

```http
GET /api/status
```

客户端读取以下字段：

```json
{
  "success": true,
  "data": {
    "password_login_enabled": true,
    "registration_application_enabled": true,
    "password_reset_application_enabled": true,
    "turnstile_check": false,
    "email_verification": false
  }
}
```

`registration_application_enabled` 是自定义字段。未提供时，客户端暂时兼容 New API 的 `register_enabled` 与 `password_register_enabled`。

## 登录

```http
POST /api/user/login
Content-Type: application/json
```

```json
{
  "username": "alice",
  "password": "用户输入的密码"
}
```

成功响应沿用 New API 的认证响应，并通过同一个 Electron Session 保存 Refresh Cookie。Access Token、Cookie 和密码不会返回给登录页面。

账号需要两步验证时沿用 New API 的 `require_2fa`、`flow_token` 和 `expires_at`，随后调用 `POST /api/user/login/2fa`。

## 提交注册申请

```http
POST /api/user/registration-applications
Content-Type: application/json
```

```json
{
  "username": "new-user",
  "password": "用户输入的密码",
  "reason": "课程科研项目使用"
}
```

建议成功响应：

```json
{
  "success": true,
  "message": "申请已提交，请等待管理员审核",
  "data": {
    "application_id": 42,
    "status": "pending"
  }
}
```

这个接口由后续 New API 自定义后端实现。EXE 不直接创建注册申请表，也不连接数据库。

## 业务错误

服务端可返回稳定错误码，客户端会显示 `message`：

| 错误码 | 含义 |
| --- | --- |
| `ACCOUNT_PENDING` | 申请正在审核 |
| `APPLICATION_REJECTED` | 申请已拒绝 |
| `USERNAME_TAKEN` | 用户名已存在或已被待审核申请占用 |
| `REGISTRATION_APPLICATION_DISABLED` | 当前停止接收申请 |

统一格式：

```json
{
  "success": false,
  "code": "ACCOUNT_PENDING",
  "message": "申请正在审核，请稍后再试"
}
```

## 用户工具配置

```http
GET /api/user/desktop-tools
```

该接口使用登录后的同一 Cookie 会话，只返回当前用户由管理员分配的工具配置。客户端主进程会消费完整的 `api_key`，但不会把明文 Key 传给渲染进程；页面只显示脱敏值。

建议响应：

```json
{
  "success": true,
  "data": {
    "tools": [
      {
        "id": "codex-gpt",
        "name": "GPT / Codex",
        "api_base_url": "http://127.0.0.1:3000/v1",
        "model": "gpt-5.2",
        "api_key": "sk-example",
        "config_format": "codex-v1",
        "enabled": true
      }
    ]
  }
}
```

`id` 支持 `claude-code` 和 `codex-gpt`。Kimi 是 Codex 可选模型，不再作为独立工具。`api_base_url` 必须是无账号密码、无片段的 HTTP(S) 地址；正式环境使用 HTTPS。`config_format` 用于兼容不同客户端版本的本地配置格式。

### Agent 模型选择

Claude Code 和 Codex 均可选择默认模型。后续 Agent 需要实现并注册适配器才能使用通用模型管理。当前发现接口固定为登录网关的 `/v1/models`，不同工具令牌的授权范围由服务端控制；不同 `api_base_url` 不会自动切换模型发现网关，也不能单凭地址实现渠道隔离。模型出现在列表中不等于对应 Agent 协议已兼容。

客户端通过主进程使用工具配置中的 `api_key` 调用当前 New API 的 `GET /v1/models`，不使用面板 PAT 或登录 Cookie。返回标准 `data: [{ id: "kimi-k3" }]`，可以预先在工具配置中提供 `available_models` 字符串数组。应用前重新获取模型列表并验证选择仍在授权范围内。

模型目录只控制显示和请求 ID。`kimi-k3` 必须在管理端配置为实际可路由模型；如上游 ID 不同，在渠道中维护模型映射。客户端不保存上游供应商密钥，不修改渠道或计费配置。Codex 对接的地址必须接受 `/v1/responses`，仅支持 Chat 的上游需要管理端配置转换。

只保存默认模型，按服务器、账号存于客户端 `model-preferences.json`。获取模型会直接把全部授权模型写入 Codex 的 `yangtze-model-catalog.json` 并更新 `config.toml`，无需勾选或另行应用模型清单；修改默认模型后点击应用。旧版 `selectedModels` 不再限制目录。Codex 在启动时读取目录，需要重启刷新。未知模型使用保守的文本与函数工具配置，不声明图片、搜索、推理强度等未验证能力。能力及长上下文适配仍须按上游逐项验证。

## 提交找回密码申请

```http
POST /api/user/password-reset-applications
Content-Type: application/json
```

```json
{
  "username": "locked-user",
  "reason": "原密码遗失，申请人工核验"
}
```

建议成功响应：

```json
{
  "success": true,
  "message": "找回密码申请已提交，请等待管理员处理",
  "data": {
    "application_id": 51,
    "application_secret": "至少 32 字节随机数生成的不可预测凭证",
    "status": "pending"
  }
}
```

`application_secret` 只在创建成功时返回一次。服务端只保存其密码学哈希，不得在数据库、管理页面或日志中保存或显示明文。EXE 使用 Electron `safeStorage` 加密保存在当前 Windows 用户目录中，不向登录页面暴露该凭证。

## 查询找回密码审核状态

```http
POST /api/user/password-reset-applications/status
Content-Type: application/json
```

```json
{
  "application_id": "51",
  "application_secret": "创建申请时返回的凭证"
}
```

建议响应：

```json
{
  "success": true,
  "message": "申请已通过，请设置新密码",
  "data": {
    "status": "approved",
    "review_note": "身份已核验"
  }
}
```

`status` 只允许 `pending`、`approved`、`rejected`。管理员只改变审核状态，不能代用户填写或查看新密码。

## 审批通过后完成密码重置

```http
POST /api/user/password-reset-applications/complete
Content-Type: application/json
```

```json
{
  "application_id": "51",
  "application_secret": "创建申请时返回的凭证",
  "new_password": "用户输入的新密码"
}
```

EXE 页面显示“重置密码”和“再次确认重置密码”，但确认值只用于本地一致性校验，请求中只发送一个 `new_password`。

服务端必须以单个事务完成：核对申请凭证哈希、确认状态为 `approved` 且未使用、按 New API 规则哈希新密码、标记申请已使用，并使该用户现有登录会话失效。凭证应为一次性凭证；成功或过期后再次调用必须失败。整个流程不使用邮箱、旧密码，也不能在管理页面或日志中显示任何密码。
