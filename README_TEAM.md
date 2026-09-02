# YangtzeAPI

本仓库按分支分别保存配套源码：

- `main`：最新版 Windows EXE 客户端源码。
- `master`：与本地部署一致的完整修改版 New API 后端和 Web 管理端源码。

## 本地启动并连接 EXE

在 `master` 分支源码目录执行：

```powershell
docker compose -f compose.local.yaml up -d --build
```

修改版 New API 会从当前源码构建并监听 `http://127.0.0.1:3000`。SQLite 数据保存在本目录的 `data` 文件夹中；该文件夹不会提交到 Git，重新构建镜像不会删除其中的数据。

再下载 `main` 分支，在其 `desktop-client` 目录执行：

```powershell
npm ci
npm run start:local-test
```

客户端的 `desktop.config.local-test.json` 已指向上述地址和配套接口，可直接进行登录、注册申请、审核状态查询和找回密码联调。

忘记密码流程只修改登录密码，不会重新生成或替换注册审核时签发的 API Key。

数据库、日志、`.env`、依赖目录和编译产物均不包含在源码分支中。
