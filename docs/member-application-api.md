# 成员申请审核与客户端对接

本流程面向项目组内部客户端：成员在客户端注册并提交申请理由，管理员在 New API 后台审核，通过后系统启用账号并发放一个 API Key。

## 状态流转

```text
客户端注册 -> pending -> approved -> 账号启用 + 发放 Key
                       \-> rejected -> 账号保持禁用
```

`users.status` 表示账号能否使用，`user_applications.status` 表示某次申请的审核结果，两者不能混用。

## 1. 客户端提交注册申请

```http
POST /api/user/register
Content-Type: application/json
```

```json
{
  "username": "member01",
  "password": "password123",
  "email": "member01@example.com",
  "verification_code": "",
  "application_reason": "我是项目组开发成员，需要使用 API 进行客户端联调和测试。"
}
```

`application_reason` 必填，去掉首尾空格后必须为 10 至 500 个字符。注册成功后账号初始状态为禁用，此时不会生成 Key。

成功响应：

```json
{
  "success": true,
  "message": "申请已提交，请等待管理员审核",
  "data": {
    "application_id": 12,
    "application_status": "pending"
  }
}
```

## 2. 客户端查询自己的审核状态

```http
POST /api/user/application/status
Content-Type: application/json
```

```json
{
  "username": "member01",
  "password": "password123"
}
```

该接口会先校验账号密码，不会允许未登录用户根据申请编号查询他人记录。

```json
{
  "success": true,
  "message": "",
  "data": {
    "application_id": 12,
    "application_status": "rejected",
    "reason": "我是项目组开发成员，需要使用 API 进行联调。",
    "review_comment": "请补充具体负责的模块",
    "reviewed_at": 1788320000,
    "created_at": 1788310000
  }
}
```

客户端也可以直接尝试登录。密码正确但申请未通过时，登录接口返回稳定业务码：

```text
APPLICATION_PENDING
APPLICATION_REJECTED
```

## 3. 管理员获取申请列表

```http
GET /api/user/applications?p=1&page_size=100&status=pending
Authorization: Bearer <admin-access-token>
```

`status` 可选值为 `pending`、`approved`、`rejected`，留空表示全部。该接口需要管理员权限。

## 4. 管理员通过申请

```http
POST /api/user/applications/12/approve
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

```json
{
  "review_comment": "已确认项目组成员身份"
}
```

服务端会在同一数据库事务中：

1. 将申请标记为 `approved`。
2. 记录审核人和审核时间。
3. 将用户改为启用状态。
4. 生成一个不过期的 API Key。
5. 将 `issued_token_id` 写回申请记录。

重复点击通过不会重复发放 Key。审核响应不返回完整 Key。

## 5. 管理员拒绝申请

```http
POST /api/user/applications/12/reject
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

```json
{
  "review_comment": "请补充所属项目和具体用途"
}
```

拒绝时 `review_comment` 必填，最多 500 个字符。拒绝后账号保持禁用，不会生成 Key。

## 6. 客户端在通过后取得 Key

审核通过后，客户端按现有鉴权链路调用：

1. `POST /api/user/login` 获得登录 Access Token。
2. `GET /api/token/?p=1&page_size=10` 获得分配的 Token ID。
3. `POST /api/token/{token_id}/key` 获得完整 Key。
4. 客户端将服务器 API 地址和 Key 写入 Codex 配置。

所有生产请求必须使用 HTTPS，不要在日志、截图或错误上报中记录密码和完整 Key。

## 当前范围

- 已实现密码注册的申请审核。
- OAuth 自动注册没有申请理由字段，内部部署应关闭 OAuth 自动注册，避免绕过审核。
- 被拒绝后的自助重新申请尚未开放，需由项目组确定是否保留同一账号的多次申请历史。
