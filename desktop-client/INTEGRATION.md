# 后续接入修改版 New API 的流程

桌面客户端的连接模块已经建立，后续拿到修改版 New API 仓库后，不需要让 EXE 访问数据库，也不需要把管理员凭据写入 EXE。

## 服务端需要完成的部分

1. 增加注册申请数据库迁移。
2. 实现 `POST /api/user/registration-applications`。
3. 实现 `POST /api/user/password-reset-applications`。
4. 实现 `POST /api/user/password-reset-applications/status`。
5. 实现 `POST /api/user/password-reset-applications/complete`。
6. 在 `/api/status` 增加 `registration_application_enabled`。
7. 实现管理员查询、批准和拒绝两类申请的接口。
8. 在 New API Web 管理端增加“注册申请”和“找回密码申请”页面。
9. 批准注册申请时创建正式用户；批准找回申请后，由用户在 EXE 中设置新密码。

精确请求和响应格式见 [SERVER-CONTRACT.md](./SERVER-CONTRACT.md)。服务端优先遵守这个契约；确有必要修改路径时，只需同步修改 `desktop.config.json` 的 `apiPaths`。

## 联调顺序

```text
状态接口
  -> 提交注册申请
  -> Web 管理端查看申请
  -> 批准/拒绝
  -> 提交找回密码申请
  -> Web 管理端批准/拒绝
  -> EXE 查询到已批准
  -> 用户输入重置密码并再次确认
  -> 服务端一次性完成密码重置
  -> 正确密码登录
  -> 2FA（启用时）
  -> 使用同一 Cookie 会话打开 userPagePath
```

联调使用专门的普通测试账号。正式发布前配置 HTTPS，验证错误密码、待审核、已拒绝、禁用账号、服务器离线、会话过期和外部链接等状态。

## 不属于 EXE 的内容

- `registration_applications` 数据库表
- 管理员审核接口和权限判断
- 找回密码申请凭证哈希、审核状态和一次性使用逻辑
- Web 管理端审核页面
- 用户角色、额度、分组和模型权限
- New API Docker 镜像和数据库迁移

这些内容应保存在修改版 New API 源码仓库中。Electron 仓库只保留客户端接口、UI、构建配置和文档。
