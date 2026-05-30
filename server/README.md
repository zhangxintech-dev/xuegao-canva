# Xuegao Canvas Local API

本目录是雪糕画布的本地后端骨架，当前使用 Node.js 原生 HTTP 实现。默认使用 JSON 文件存储；只有设置 `DB_MODE=postgres` 时才连接 PostgreSQL。

## 启动

在项目根目录运行：

推荐 Docker Compose，一次启动前端、后端 API 和 PostgreSQL：

```bash
npm run docker:up
```

查看服务状态：

```bash
npm run docker:check
```

查看容器日志：

```bash
npm run docker:logs
```

检查后台登录、用户、项目、日志、模型保存、模型删除和配额接口：

```bash
npm run admin:check
```

停止服务：

```bash
npm run docker:down
```

Docker 启动后，前端地址为：

```text
http://127.0.0.1:5173/xuegao-canvas/
```

API 地址固定为：

```text
http://127.0.0.1:8787
```

本地 Node 模式也可以运行：

```bash
npm run dev:server
```

同时启动前后端：

```bash
npm run dev:all
```

默认地址：

```text
http://127.0.0.1:8787
```

前端 Vite 已配置代理：

- `/api` -> `http://127.0.0.1:8787`
- `/uploads` -> `http://127.0.0.1:8787`

## 环境变量

- `PORT`：服务端口，默认 `8787`
- `HOST`：监听地址，默认 `127.0.0.1`
- `DB_MODE`：存储模式，默认 `json`；设置为 `postgres` 才启用 PostgreSQL
- `JWT_SECRET`：本地 token 签名密钥
- `ADMIN_EMAIL`：默认管理员邮箱，默认 `zian@bencom.cn`
- `ADMIN_PASSWORD`：默认管理员密码，默认 `123456`
- `ADMIN_NAME`：默认管理员昵称，默认 `雪糕管理员`
- `DATA_DIR`：JSON 数据目录，默认 `server/data`
- `UPLOAD_DIR`：上传文件目录，默认 `server/uploads`
- `PUBLIC_BASE_URL`：资产公开访问地址，默认 `http://127.0.0.1:8787`
- `DATABASE_URL`：PostgreSQL 连接串；仅 `DB_MODE=postgres` 时使用

确认后端是否启动：

```bash
curl http://127.0.0.1:8787/api/health
```

启用 PostgreSQL：

```bash
npm install --prefix server
DATABASE_URL="postgresql://zian@127.0.0.1:5432/xuegao_canvas" npm run dev:server:pg
```

如果使用 Docker Compose，不需要在本机安装或启动 PostgreSQL，容器会自动创建 `xuegao_canvas` 数据库并初始化表结构。

如果 PostgreSQL 没有启动，先不要设置 `DB_MODE=postgres`，直接用默认 JSON 模式即可完整注册、登录、后台配模型和调接口。

默认管理员账号会在后端启动时自动创建或补齐：

```text
邮箱：zian@bencom.cn
密码：123456
```

生产环境请务必通过 `ADMIN_PASSWORD` 改成强密码。

## 已实现接口

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `GET /api/auth/me`

### Projects and Canvas

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId`
- `GET /api/projects/:projectId/canvas`
- `PUT /api/projects/:projectId/canvas`
- `GET /api/projects/:projectId/members`
- `POST /api/projects/:projectId/members`
- `DELETE /api/projects/:projectId/members/:userId`
- `GET /api/projects/:projectId/workflow-versions`
- `GET /api/projects/:projectId/workflow-versions/:versionId`

### Teams and Permissions

- `GET /api/teams`
- `POST /api/teams`
- `GET /api/teams/:teamId`
- `POST /api/teams/:teamId/members`
- `DELETE /api/teams/:teamId/members/:userId`

### Admin

默认第一个注册用户拥有后台权限，也可以通过 `ADMIN_EMAILS=a@example.com,b@example.com` 指定管理员邮箱。

- `GET /api/admin/summary`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:userId/quota`
- `GET /api/admin/projects`
- `GET /api/admin/logs`
- `GET /api/admin/models`
- `POST /api/admin/models`
- `PATCH /api/admin/models/:modelId`
- `DELETE /api/admin/models/:modelId`

### Assets

- `POST /api/assets/upload`
- `POST /api/assets/mask`
- `GET /api/assets/:assetId`
- `GET /uploads/:fileName`

上传暂时接收 data URL：

```json
{
  "projectId": "project_xxx",
  "dataUrl": "data:image/png;base64,..."
}
```

### Generation

- `POST /api/generation/image`
- `GET /api/generation/tasks/:taskId`

当前 generation 是任务占位：会创建任务记录、检查并扣减用户配额，但还没有代理真实模型服务。

### Quota

- `GET /api/quota/me`
- `GET /api/quota/records`
- `POST /api/quota/adjust`

每次创建生成任务会扣减用户配额，默认新用户配额为 `100`，可通过 `DEFAULT_USER_QUOTA` 设置。

### Logs

- `GET /api/logs`

记录团队、项目、画布保存、生成任务等操作日志。

### Collaboration

- `GET /api/projects/:projectId/collaboration/events`
- `POST /api/projects/:projectId/collaboration/events`

当前是协同事件 HTTP 占位。后续可以替换为 WebSocket 广播，事件结构保持一致。

### Models

- `GET /api/models/image`
- `GET /api/models/video`
- `GET /api/models/chat`

当前返回空数组，后续接后台模型配置。

## 数据存储

默认本地开发使用：

- `server/data/db.json`
- `server/uploads/*`

PostgreSQL 模式使用：

- `server/schema.sql`

生产建议继续补强：

- S3/R2/OSS 等对象存储
- Redis 或消息队列管理生成任务
- WebSocket 房间广播与在线状态
