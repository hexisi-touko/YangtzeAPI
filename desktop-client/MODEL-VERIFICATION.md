# Codex 多模型接入验证

2026-09-05，本机 New API `http://127.0.0.1:3000`。

- 已移除 Kimi 独立卡片、专用同步适配器和内置聊天窗口。
- Codex 模型列表支持获取、搜索、默认值选择与账号级持久化。获取后全部同步，无需勾选；旧版勾选偏好不再隐藏模型。
- 管理端已有 `kimi-k3` 和 `kimi-k3-256k`，无需创建虚构别名。当前渠道没有改名映射。
- 使用测试账号的 API 令牌获取模型列表，返回 11 个模型，其中包含 `kimi-k3`。
- `kimi-k3` 经现有 New API `/v1/responses` 返回 HTTP 200、SSE 文本与完成事件。
- 已验证一次流式函数工具调用，以及携带工具结果和历史输出的第二轮请求。
- 本机 Codex CLI 0.148.0 的 app-server 已接受生成的 TOML 和 JSON 目录，`model/list` 返回 `kimi-k3`。
- Playwright 在 1060x720 和 840x580 验证三张工具卡片、无复选框、获取后全量同步、全部模型可选为默认、搜索、应用、重新打开、刷新失败保留选择以及图片加载和布局。
- 实际 Codex 文件工作流被本机 Windows 沙箱策略阻止终端进程启动，因此完整文件读写验收未通过。未修改或绕过安全策略。

## 复核命令

```powershell
npm run check
npm test
node scripts/verify-model-integration.js
node scripts/verify-kimi-schema.js
```

集成脚本仅用于本机开发环境，从本机 SQLite 只读读取测试账号令牌并在隔离的临时 CODEX_HOME 中运行，结束后删除临时目录，不修改日常 Codex 配置。它会产生少量模型调用用量。完整文件工作流可通过 `CODEX_VERIFY_FILE_WORKFLOW=1` 单独启用，需要本机原有策略允许工作区终端操作。

界面操作脚本为 `scripts/verify-model-ui.js`，使用 Playwright CLI `run-code --filename` 运行，界面 IPC 数据为测试桩。它不等于打包后的真实登录端到端验证。

模型列表及 Responses 响应的模型名来自现有上游，本次未独立审计上游内部实际使用的模型。新模型的图片、搜索及长上下文能力未在本轮验证。

## 账号名称与推理档位

Codex 自定义供应商名称改为客户端当前登录账号的 `username`，随账号切换重新同步；未取得用户名时使用 `API`。它是供应商显示名称，不代表登录了 OpenAI 账号。

按 [Moonshot 官方 K3 文档](https://github.com/MoonshotAI/Kimi-K3#6-model-usage)，`kimi-k3`、`kimi-k3-256k` 目录声明 `low/high/max`，默认 `max`。按 OpenAI [Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra)、[Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)、[GPT-5.5](https://developers.openai.com/api/docs/models/gpt-5.5) 官方模型文档补充各自档位，默认 `medium`。其他未知模型不凭别名推测支持档位。

重复同步同一模型保留 TOML 中的有效推理设置；旧版 K3 的 `medium` 或切换模型带来的不兼容设置替换为该模型默认值。Codex 现有任务可保存独立的模型与推理设置，需在任务中重新选择档位。

`node scripts/verify-reasoning.js --live` 已通过：本机 Codex 0.148.0 的 `model/list` 返回两种 K3 的三个档位；通过真实 app-server 的 `turn/start` 逐档选择，在本地 HTTP 接收端捕获六个真实请求，均携带对应 `reasoning.effort` 且未附加不支持的 reasoning summary。再经本机 New API 发起同样六个上游流式请求，均完成并在响应的 `reasoning.effort` 返回相同值。这证明客户端发出参数、现有网关接受并回显参数，不是模型内部计算量或回答质量的独立审计。

客户端 33 项测试通过，覆盖档位修复与保留、不同模型切换、用户名同步与账号隔离。

## 全部 Kimi 型号

`node scripts/verify-kimi-schema.js --all-models` 从测试账号实时获取全部 Kimi 型号，并逐个验证目录收录、原始嵌套 `$ref` 工具定义、流式工具调用、携带历史输出与工具结果的第二轮请求。本机当前 8 个型号全部通过：`kimi-k2`、`kimi-k2-thinking`、`kimi-k2.5`、`kimi-k2.6`、`kimi-k2.7-code`、`kimi-k2.7-code-highspeed`、`kimi-k3`、`kimi-k3-256k`。这验证了现有上游的接口兼容性，不是对上游内部模型身份的审计。

所有授权型号获取后直接同步，保留准确模型 ID，并统一 Kimi 显示名称。不支持或尚未确认推理档位的型号不套用 K3 的档位。正式版与 LocalTest 使用同一功能代码并保留各自配置，按用户要求覆盖桌面上指定的两个 EXE，不新增桌面文件名。

## Moonshot Schema 修复

截图报错已在旧服务端复现：`node scripts/verify-kimi-schema.js --expect-rejection` 返回预期 HTTP 400，错误包含 `when using $ref, type should be defined`。最小请求与 `$defs.__schema20` 工具定义均复现。

参考 [cc-switch Moonshot 兼容实现](https://github.com/farion1231/cc-switch/blob/db41d701879592b8eca938cbe5c5ac28dd732b9f/src-tauri/src/proxy/providers/transform_codex_chat_moonshot_schema.rs) 的约束保留方式，在 New API 的 Responses 请求转换后，将 Kimi 工具 schema 的 `$ref` 放入 `allOf`，保留同级约束、已有 `allOf` 分支和递归引用。仅遍历 schema 关键字，保留 default/examples/enum/const 字面值；非 Kimi 请求不改动。纯请求体透传模式仍遵守原设置，不做转换。

服务端改动位于 `D:/codex/YangtzeAPI-local-integration/relay/common/kimi_tool_schema.go` 和 `relay/responses_handler.go`。相关 Go 测试、客户端 32 项测试通过。镜像 `yangtze-new-api:kimi-schema-20260905` 已替换本机 `new-api-local`，原样 schema 经真实网关完成工具调用和结果回传。旧镜像保留为 `yangtze-new-api:before-kimi-schema-20260905`，数据库备份在 `D:/codex/new-api-local/backups/before-kimi-schema-20260905-113656.db`。

配置面板参考 [cc-switch CodexFormFields](https://github.com/farion1231/cc-switch/blob/db41d701879592b8eca938cbe5c5ac28dd732b9f/src/components/providers/forms/CodexFormFields.tsx) 的模型获取、默认模型建议及异步结果管理。全量同步行为按用户要求实现，不照搬其手工目录编辑流程。
