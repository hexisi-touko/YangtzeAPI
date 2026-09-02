# New API 单机部署包

这是一套面向“自用或受控内测”的 New API 生产形态模板：

```text
公网 HTTPS -> Caddy -> New API -> PostgreSQL / Redis
```

New API、PostgreSQL 和 Redis 不直接暴露到公网，只有 Caddy 映射 80/443。只接入合法授权的上游 API，不将此配置用于 VPN、通用代理、任意 URL 转发或绕过上游限制。

## 仓库内容

- `compose.yaml`、`Caddyfile` 和 `scripts/`：PostgreSQL + Redis + Caddy 单机部署模板。
- `desktop-client/`：Electron 桌面客户端源码；已实现 New API 登录、2FA、找回密码及自定义注册申请接口适配。
- `new-api-v1.0.0-rc.27-users-ddl.sql`：该版本 `users` 表的 PostgreSQL DDL。
- `new-api-v1.0.0-rc.27-key-account-ddl.sql`：该版本 `users` 与 `tokens` 表的 PostgreSQL DDL。
- `new-api-key-account-database-research.md`：一用户固定一个 API 令牌的设计研究。

DDL 是让官方 `v1.0.0-rc.27` 镜像在 PostgreSQL 15 空库中执行应用迁移后导出的结构快照，不是生产数据库备份，也不包含用户数据。它们会创建新表，不能未经审查直接在已有生产数据库执行。

本仓库不提交 `.env`、真实桌面客户端连接配置、数据库数据目录、备份、日志、构建产物和压力测试结果。首次使用时复制 `.env.example` 生成 `.env`；桌面客户端配置参考 `desktop-client/desktop.config.example.json`。

本项目使用 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 的容器镜像，部署或分发前请同时遵守其许可证及相关上游服务条款。

## 服务器到手后的部署

以下命令在 Ubuntu 24.04 服务器上执行。先把本目录上传到服务器，例如 `/opt/new-api`。

1. 安装 Docker、Compose 和基础防火墙规则：

```bash
sudo chown -R "$USER":"$USER" /opt/new-api
cd /opt/new-api
sudo bash scripts/bootstrap-ubuntu.sh
```

脚本不会修改 SSH 登录策略；确认新 SSH 会话可以正常登录后，再自行关闭密码登录或限制 SSH 来源。

2. 生成域名、随机密钥和持久化目录：

```bash
sudo chown -R "$USER":"$USER" /opt/new-api
cd /opt/new-api
bash scripts/init-env.sh api.example.com admin@example.com
```

把 `api.example.com` 替换成实际域名。创建 DNS A 记录，将该域名指向服务器公网 IPv4。80/443 必须能从公网访问，Caddy 才能自动申请证书。

3. 检查配置并启动：

```bash
docker compose config
docker compose pull
docker compose up -d
docker compose ps
docker compose logs --tail=100 new-api caddy
```

4. 验证：

```bash
curl -fsS https://api.example.com/api/status
```

首次启动后，使用浏览器访问 `https://api.example.com` 完成 New API 初始化，再在后台添加合法上游渠道、模型和受限测试令牌。不要直接把管理员凭证当作客户端 API Key。

当前工作区的 `new-api-local` 是 SQLite 学习环境；本模板使用 PostgreSQL，不会自动导入本地的 `one-api.db`。第一次上线应在后台重新创建管理员、渠道和测试令牌。若本地已经有必须保留的配置，先单独做数据库迁移演练，不要直接把 SQLite 文件复制到 PostgreSQL 数据目录。

## VMware 本地演练

在 VMware 中安装 Ubuntu Server 24.04 LTS，建议给虚拟机分配 2 vCPU、4GB 内存、40GB 磁盘，并启用 NAT 网络和 OpenSSH Server。登录虚拟机后上传本目录，例如 `/opt/new-api`，然后执行：

```bash
sudo chown -R "$USER":"$USER" /opt/new-api
cd /opt/new-api
sudo bash scripts/bootstrap-ubuntu.sh
sudo ufw allow 3000/tcp
bash scripts/init-env.sh vm-api.local admin@example.com
docker compose -f compose.yaml -f compose.vm.yaml config
docker compose -f compose.yaml -f compose.vm.yaml pull
docker compose -f compose.yaml -f compose.vm.yaml up -d
docker compose -f compose.yaml -f compose.vm.yaml ps
```

在 VMware 的 Ubuntu 中用 `ip addr` 查看虚拟机 IP，然后在 Windows 浏览器访问 `http://虚拟机IP:3000`。此模式只用于验证 New API、PostgreSQL、Redis、渠道和令牌，不申请公网 HTTPS 证书。测试完成后停止并删除测试容器即可；生产部署仍使用不带 `compose.vm.yaml` 的正式配置。

## 备份

数据库是核心数据，Caddy 的证书目录和 New API 配置也需要保留。执行：

```bash
bash scripts/backup.sh
```

脚本会生成 PostgreSQL 自定义格式备份和应用数据归档，并删除本机超过 14 天的备份。生产环境还应将 `backups/` 复制到服务器之外的对象存储或另一台受控主机；本机备份不能抵御服务器故障或误删。

恢复数据库前先停止 New API：

```bash
set -a
source .env
set +a
docker compose stop new-api
cat backups/<timestamp>-postgres.dump | \
  docker compose exec -T postgres pg_restore \
    --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --clean --if-exists --no-owner
docker compose start new-api
```

## 更新与回滚

不要无条件依赖 `latest`。第一次部署验证成功后，把 `.env` 中的 `NEW_API_IMAGE` 固定到已验证的版本标签。更新前先备份：

```bash
bash scripts/backup.sh
docker compose pull new-api
docker compose up -d new-api
docker compose logs --tail=200 new-api
```

回滚时把 `NEW_API_IMAGE` 改回上一版本，再执行 `docker compose up -d new-api`。数据库迁移可能不可逆，升级前必须阅读对应版本的 New API 更新说明。

## 需要人工确认的事项

- 上游 API 账号和使用方式必须得到授权并符合上游条款。
- 域名 DNS 必须已经生效，服务器公网 80/443 必须放行。
- `SESSION_SECRET`、`CRYPTO_SECRET`、数据库密码和 Redis 密码不能提交到 Git 或发给普通用户；部署后不要随意更换。
- New API 后台仍需配置用户、令牌、模型范围、限额和成本告警；容器启动成功不代表业务配置已经完成。
- 当前模板是单机部署，不提供故障转移。需要高可用时，应采用共享 PostgreSQL、Redis 和一致密钥的多节点方案。

## 官方参考

- [New API Docker Compose 配置说明](https://docs.newapi.ai/zh/docs/installation/config-maintenance/docker-compose-yml)
- [New API 环境变量配置指南](https://www.newapi.ai/zh/docs/installation/config-maintenance/environment-variables)
- [New API 系统更新指南](https://www.newapi.ai/zh/docs/installation/config-maintenance/system-update)
