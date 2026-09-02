# YangtzeAPI 桌面客户端

当前 `main` 分支只保存 Windows EXE 客户端相关源码、配置模板、构建脚本、测试和 New API 对接契约。

## 客户端源码

桌面客户端位于 [`desktop-client/`](./desktop-client/)，包括：

- 固定尺寸的登录、注册申请、两步验证和找回密码界面
- 可通过 JSON 修改的产品名称、Logo、服务器地址和接口路径
- New API 登录与会话适配
- 注册申请、审核状态查询和审批后密码重置的客户端实现
- Windows 安装版与便携版构建脚本
- 单元测试、固定窗口截图检查和 GitHub Actions

## 后续对接

修改版 New API 源码上传后，服务端实现人员可以直接参考：

- [`desktop-client/SERVER-CONTRACT.md`](./desktop-client/SERVER-CONTRACT.md)：请求、响应和安全约束
- [`desktop-client/INTEGRATION.md`](./desktop-client/INTEGRATION.md)：服务端实现项目与联调顺序
- [`desktop-client/CONFIGURATION.md`](./desktop-client/CONFIGURATION.md)：客户端 JSON 配置

当前仓库不会提交真实服务器配置、密码、令牌、数据库数据、`node_modules`、构建缓存、截图或包含真实服务器地址的 EXE。

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
