# QuantumNous/new-api 的 Key、用户与上游账号数据库设计研究

> 研究时间：2026-09-01
> 官方仓库：[`QuantumNous/new-api`](https://github.com/QuantumNous/new-api)
> 核对分支：`main`
> 核对提交：[`67a0585d0f252dfca445c11b7600971b7eeb8eea`](https://github.com/QuantumNous/new-api/tree/67a0585d0f252dfca445c11b7600971b7eeb8eea)

> 版本边界：本文是对上述 `main` 提交的设计研究。仓库中的 `new-api-v1.0.0-rc.27-*.sql` 则由 `v1.0.0-rc.27` 镜像在 PostgreSQL 15 空库中实际迁移后导出。两者用途不同，不能把本文字段描述当作该版本 DDL 的逐字副本。

## 结论

如果需求是“每个用户只有一个固定的、供客户端调用网关的 API Key”，应当：

1. **继续使用现有 `tokens` 表。** `tokens` 已经是下游客户端 API Key 的完整实体，包含所属用户、Key、状态、额度、过期时间、模型限制、IP 限制、分组和使用量。
2. **不在 `users` 新增另一个 Key 字段，也不复用 `users.access_token`。** `users.access_token` 是后台管理接口的个人访问令牌（PAT），其认证链路与模型转发使用的 `tokens.key` 不同。
3. **不新建 `user_keys` / `api_keys` 表。** 新表会复制 `tokens` 已有的生命周期字段、缓存和鉴权逻辑，收益为零，改造面反而更大。
4. **在 `tokens.user_id` 上增加唯一性，并同步收紧业务接口。** 数据库唯一性保证“最多一个”；注册或初始化时事务性创建保证“至少一个”。重置 Key 时更新同一条 `tokens` 记录，不新增第二条记录。

这项需求本身**不需要新增业务字段**；需要新增的是 `user_id` 唯一索引/约束及配套迁移。当前模型只给 `user_id` 建了普通索引，因此上游原版允许一个用户拥有多个 token；`tokens.key` 则已经全局唯一。[`model/token.go#L14-L33`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/model/token.go#L14-L33)

## 先区分三种 Key

| 凭证 | 所在表/字段 | 谁提交给谁 | 用途 |
|---|---|---|---|
| 下游客户端 Key | `tokens.key` | 用户客户端 -> new-api | 调用 `/v1/*`、`/v1beta/*` 等模型转发接口 |
| 后台管理 PAT | `users.access_token` | 用户/管理员 -> new-api 后台 API | 管理控制台接口认证，不是模型转发 Key |
| 上游渠道 Key | `channels.key` | new-api -> OpenAI、Anthropic、Gemini 等上游 | 供应商账号/API 凭证；一个渠道还可配置多 Key |

这三者不能混用。“每个用户一个固定 Key”若指用户调用 new-api，应约束 `tokens`；不能把它实现成 `channels.key`，也不能复用 `users.access_token`。

## 当前数据模型

### `users`

`User` 保存用户身份、角色、状态、额度、分组等。`AccessToken` 的源码注释明确写着“this token is for system management”，字段为 nullable `char(32)` 并带唯一索引。[`model/user.go#L77-L113`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/model/user.go#L77-L113)

后台 PAT 的生成接口会直接更新 `users.access_token`；每次调用都会生成新值，因此它本身是可轮换的管理凭证。[`controller/user.go#L430-L455`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/controller/user.go#L430-L455) 校验时也直接按 `access_token` 查询 `users`。[`model/user.go#L1165-L1178`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/model/user.go#L1165-L1178)

### `tokens`

`Token` 当前包含：

- `user_id`：普通索引，逻辑上归属一个用户；源码没有声明数据库外键。
- `key`：`varchar(128)`，全局唯一索引。
- `status`、`expired_time`：启停和过期生命周期。
- `remain_quota`、`used_quota`、`unlimited_quota`：Key 级额度。
- `model_limits*`、`allow_ips`、`group`、`auto_groups`：Key 级访问策略。
- `deleted_at`：GORM 软删除列。

完整定义见 [`model/token.go#L14-L33`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/model/token.go#L14-L33)。列表、搜索和计数均以 `user_id` 过滤，说明 `tokens` 正是用户拥有的客户端凭证集合。[`model/token.go#L106-L110`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/model/token.go#L106-L110) [`model/token.go#L159-L217`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/model/token.go#L159-L217)

原版控制器明确支持多 token：创建前读取 `MaxUserTokens`，只要未达到上限就生成新 Key 并插入新行。[`controller/token.go#L275-L351`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/controller/token.go#L275-L351) 路由也同时提供列表、新增、更新、单删、批量删除和批量查看 Key。[`router/api-router.go#L255-L268`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/router/api-router.go#L255-L268)

### 可用于过渡的现有配置

原版已有两个接近本需求、但不能替代数据库约束的配置：

- `token_setting.max_user_tokens` 可设为 `1`，限制常规创建接口中每个用户的 token 数量；默认值为 `1000`。[`setting/operation_setting/token_setting.go`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/setting/operation_setting/token_setting.go)
- `GENERATE_DEFAULT_TOKEN=true` 可让普通用户名/密码注册流程创建初始 token。[`common/init.go`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/common/init.go) [`controller/user.go`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/controller/user.go)

它们适合先验证产品流程，但不是硬保证：数量限制采用“先计数、后插入”，并发请求仍可能同时通过；默认 token 的创建逻辑也不天然覆盖 OAuth、管理员创建等所有用户创建入口。正式实现仍需唯一索引和统一的幂等创建流程。

### `channels`：上游“账号”

new-api 没有一个名为 `accounts` 的核心表；负责承载上游供应商账号/端点的是 `channels`。`Channel.Key` 是 `not null`，但不唯一，也没有 `user_id` 或 `token_id`；渠道是系统级资源，不是用户的客户端 Key。[`model/channel.go#L23-L60`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/model/channel.go#L23-L60)

`channels.key` 还支持多 Key：可按换行拆分，某些场景可解析 JSON 数组，再按照渠道的多 Key 配置随机或轮询选择可用 Key。[`model/channel.go#L180-L244`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/model/channel.go#L180-L244)

渠道可用性由 `abilities` 表按 `(group, model, channel_id)` 组合主键表达，并附带 enabled、priority、weight；这不是 token 与 channel 的直接绑定表。[`model/ability.go#L18-L26`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/model/ability.go#L18-L26)

### 关系概览

```text
users
  id
   |
   | tokens.user_id（逻辑关联；当前仅普通索引，无显式 FK）
   v
tokens                         abilities                         channels
  key（下游客户端凭证）          (group, model, channel_id)  --->  key（上游供应商凭证）
  group ----------------------> 按分组和模型选择渠道                无 user_id/token_id

logs 同时记录 user_id、token_id、channel_id，用于追踪实际调用链路。
```

日志模型确实同时保存三种标识：`UserId`、`TokenId`、`ChannelId`。[`model/log.go#L59-L80`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/model/log.go#L59-L80)

## 请求路由链路

模型请求的核心链路是：

```text
客户端携带 tokens.key
  -> relay router 的 TokenAuth
  -> 按 tokens.key 查询 token，取得 user_id、token_id 和 token 策略
  -> Distribute 按 group + model + priority/weight 选择 channel
  -> 从 channels.key 选择一个可用上游 Key
  -> RelayInfo.ApiKey 携带该上游 Key 调供应商
```

证据如下：

1. `/v1` 转发路由先执行 `TokenAuth()`，再执行 `Distribute()`。[`router/relay-router.go#L69-L97`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/router/relay-router.go#L69-L97)
2. `TokenAuth` 从 Bearer、Anthropic `x-api-key`、Gemini query/header 等位置规范化客户端 Key，去掉 `sk-` 前缀后调用 `ValidateUserToken`。[`middleware/auth.go#L354-L411`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/middleware/auth.go#L354-L411)
3. token 验证会查询 `tokens.key`，检查状态、过期时间和额度。[`model/token.go#L220-L257`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/model/token.go#L220-L257)
4. 鉴权成功后上下文写入 `user_id`、`token_id`、token 配额、模型限制和分组。[`middleware/auth.go#L488-L517`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/middleware/auth.go#L488-L517)
5. `Distribute` 按使用分组和模型从可用渠道池选择 channel。[`middleware/distributor.go#L102-L186`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/middleware/distributor.go#L102-L186)
6. 选中 channel 后调用 `GetNextEnabledKey()`，将 `channels.key` 放入 `ContextKeyChannelKey`。[`middleware/distributor.go#L619-L656`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/middleware/distributor.go#L619-L656)
7. Relay 初始化时把这个上游 Key 写入 `RelayInfo.ChannelMeta.ApiKey`。[`relay/common/relay_info.go#L188-L208`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/relay/common/relay_info.go#L188-L208)

因此，客户端 Key 和上游账号 Key 是先后出现在同一请求中的两种凭证，绝不是同一列的两个名字。

## 推荐数据库方案

### 方案 A：严格“一用户终身一行 token”（推荐）

给 `Token.UserId` 增加唯一索引，例如模型标签改为：

```go
UserId int `json:"user_id" gorm:"uniqueIndex:idx_tokens_user_id"`
```

等价数据库目标：

```sql
CREATE UNIQUE INDEX idx_tokens_user_id ON tokens (user_id);
```

这是最简单、跨 PostgreSQL/MySQL/SQLite 最一致的方案，但它意味着**软删除过的 token 也占用该用户的唯一位置**。在“一用户固定一个 Key”的语义下，这正好提示业务层不要删除 token 行：

- 注册用户时，在同一事务内创建唯一 token。
- 老用户没有 token 时，执行幂等的 get-or-create；并发创建依赖唯一索引裁决，冲突后回读。
- 移除普通用户“新增 token”“删除 token”“批量删除 token”的能力。
- “重置 Key”更新同一行的 `key`，保留 `tokens.id`、额度、策略和日志关联。
- token 暂停使用通过 `status` 完成，不通过软删除完成。
- 用户删除/恢复策略需要明确：若可能恢复，保留 token；若永久删除，可在事务中硬删除对应 token。

当前 `Token.Update()` **不会更新 `key`**，只更新名称、状态、额度和策略字段，所以重置 Key 需要新增专用方法；该方法还必须同时失效旧 Key 的 Redis 缓存，再写入新 Key，不能只修改控制器。[`model/token.go#L303-L331`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/model/token.go#L303-L331)

数据库唯一索引只能保证“每个用户最多一条”；“每个用户至少一条”必须由用户创建事务、启动迁移回填或幂等初始化流程保证。

### 迁移前置条件

原版允许多个 token 且使用软删除，直接增加唯一索引会在已有数据上失败。迁移必须先包含已软删除行做盘点：

```sql
SELECT user_id, COUNT(*)
FROM tokens
GROUP BY user_id
HAVING COUNT(*) > 1;
```

对每个用户需先选定保留行。一般应保留当前未删除、仍启用且最近访问的一行；其余行在备份后硬删除或迁出。不能只用 GORM 默认查询，因为默认查询会隐藏 `deleted_at IS NOT NULL` 的记录。

`tokens.key` 已有专门的 PostgreSQL 唯一性迁移，用于把旧 UNIQUE constraint 规范为当前独立唯一索引；这说明本项目对索引兼容迁移采用“先检查旧结构，再迁移，再 `AutoMigrate`”的方式。[`model/token_migration.go#L126-L213`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/model/token_migration.go#L126-L213) 主迁移也先运行该定制迁移，再对 `Channel`、`Token`、`User` 等执行 `AutoMigrate`。[`model/main.go#L317-L370`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/model/main.go#L317-L370) 新的 `user_id` 唯一性迁移应遵循相同模式，而不是只改 GORM 标签后期待生产数据自动兼容。

### 方案 B：只限制“一条未删除 token”，同时保留历史（不作为默认推荐）

如果必须保留多条已删除 token，又只限制当前有效行唯一，那么不同数据库需要不同实现：

- PostgreSQL/SQLite：`UNIQUE (user_id) WHERE deleted_at IS NULL` 部分唯一索引。
- MySQL：nullable `deleted_at` 不能通过 `UNIQUE(user_id, deleted_at)` 保证单条 active row，因为多个 `NULL` 可共存；需要生成列（例如 active 时映射为 `user_id`，deleted 时为 `NULL`）再加唯一索引，或由事务锁和业务逻辑保证。

这会增加三种数据库的迁移分支。除非保留 token 行历史是硬需求，否则方案 A 更符合“固定一个 Key”的模型。

### 为什么不新建“主 Key 映射表”

也可以新建：

```text
user_primary_tokens(user_id PK, token_id UNIQUE)
```

但它只能指出哪个 token 是“主 token”，并不能阻止 `tokens` 中出现其他 token；鉴权、额度、缓存仍然全部落在 `tokens`，多了一次查询和一致性维护。只有在必须保持上游多 token 功能、同时临时指定一个默认 token 的兼容场景下才值得采用，不适合明确的一用户一 Key 新规则。

## 如果“固定账号”也是需求，需单独建模

“每个用户一个固定客户端 Key”和“每个用户固定使用哪个上游账号/channel”是两个独立需求。当前版本没有普通用户到 channel 的持久绑定。源码虽允许管理员在客户端 Key 后追加 channel ID 来临时 pin，例如 `sk-<token>-<channelId>`，但普通用户会被拒绝，这也不是数据库关系。[`middleware/auth.go#L518-L535`](https://github.com/QuantumNous/new-api/blob/67a0585d0f252dfca445c11b7600971b7eeb8eea/middleware/auth.go#L518-L535)

若以后还要求固定上游账号，可按基数选择：

| 真实业务规则 | 建议 |
|---|---|
| 每个用户/固定 token 恰好只 pin 一个 channel，且关系没有优先级、有效期、失败回退等属性 | 在归属规则所在原表加 nullable `pinned_channel_id`：若绑定随用户存在放 `users`；若绑定是 Key 级路由策略放 `tokens`。需要应用层检查 channel 状态、模型能力和分组权限。 |
| 一个用户或 token 可绑定多个 channel，或关系需要优先级、权重、启停、有效期、失败回退 | 新建关联表，如 `token_channels(token_id, channel_id, priority, weight, enabled, valid_from, valid_until)`；不要把 ID 列表塞进 JSON/字符串。 |
| 只是让客户端拥有一个固定 Key，不固定上游账号 | 不加 channel 关联，继续使用现有 group/model/ability 调度。 |

无论选择哪种账号绑定方式，**上游密钥仍只保存在 `channels.key`**；绑定表只保存 `channel_id`，不能复制供应商密钥到 `users` 或 `tokens`。

## 最终建议

针对当前已明确的“每个用户有一个固定客户端 Key”：

- 表：复用 `tokens`。
- 字段：复用 `tokens.key` 和 `tokens.user_id`，不新增 Key 字段。
- 约束：新增 `tokens(user_id)` 唯一索引；保留已有 `tokens(key)` 全局唯一索引。
- 流程：用户创建时创建 token；读取采用 get-or-create；重置时原行换 Key；停用改 `status`；不再让用户新增或删除 token 行。
- 迁移：先清理所有重复行（包括软删除行），再创建唯一索引；为 PostgreSQL/MySQL/SQLite 做实际迁移测试。
- 边界：不要修改 `channels.key`，不要复用 `users.access_token`；若未来增加固定上游账号，再按一对一或多对多基数单独设计。
