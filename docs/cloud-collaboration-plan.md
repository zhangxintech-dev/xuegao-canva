# 登录、协同生图与云端资产改造方案

## 目标

把当前本地单人画布升级为支持用户登录、多人协同、生图任务云端执行、图片长期可访问的产品形态。

核心变化：

- 用户可以登录、退出，并按账号查看自己的项目。
- 项目、画布节点、连线、工作流不再只存在浏览器 `localStorage`。
- 生成图片、上传图片、蒙版图片都进入云端资产存储。
- 多个用户可以进入同一个项目，看到节点、连线、生成状态的实时变化。
- 模型和 API Key 由后台配置，前端只展示可用模型，不暴露密钥。

## 改造边界

### 当前状态

- 项目数据主要保存在前端 `localStorage`。
- 画布节点和连线由 `src/stores/canvas.js` 管理。
- 项目列表由 `src/stores/projects.js` 管理。
- 图片生成由前端调用当前配置的模型接口。
- 上传图片、局部重绘 mask 等数据可能以 base64 临时存在节点里。

### 改造后状态

- 前端只负责 UI、交互、协同消息消费和发起 API 请求。
- 后端负责认证、权限、项目持久化、模型配置、生图任务、资产存储。
- 节点里保存长期可恢复的数据，例如 `assetId`、`url`、`taskId`，不保存大体积 base64。

## 后端模块

### Auth

职责：

- 用户注册、登录、退出。
- Token 刷新。
- 获取当前用户信息。
- 前端请求鉴权。

建议接口：

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `GET /api/auth/me`

### Projects

职责：

- 用户项目列表。
- 创建、重命名、复制、删除项目。
- 项目协作者和权限管理。

建议接口：

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId`
- `POST /api/projects/:projectId/collaborators`
- `DELETE /api/projects/:projectId/collaborators/:userId`

### Canvas

职责：

- 保存和加载画布快照。
- 保存节点、连线、视口。
- 支持增量更新，方便多人协同。

建议接口：

- `GET /api/projects/:projectId/canvas`
- `PUT /api/projects/:projectId/canvas`
- `PATCH /api/projects/:projectId/canvas/nodes/:nodeId`
- `POST /api/projects/:projectId/canvas/nodes`
- `DELETE /api/projects/:projectId/canvas/nodes/:nodeId`
- `POST /api/projects/:projectId/canvas/edges`
- `DELETE /api/projects/:projectId/canvas/edges/:edgeId`

### Assets

职责：

- 上传用户图片。
- 上传局部重绘 mask。
- 保存生成结果图。
- 返回长期可访问 URL。

建议接口：

- `POST /api/assets/upload`
- `POST /api/assets/mask`
- `GET /api/assets/:assetId`
- `DELETE /api/assets/:assetId`

节点建议保存：

```json
{
  "assetId": "asset_xxx",
  "url": "https://cdn.example.com/assets/xxx.png",
  "width": 1024,
  "height": 1024,
  "mimeType": "image/png"
}
```

### Generation

职责：

- 创建文生图、图生图、局部重绘、高清、扩图、重生成任务。
- 后端读取后台模型配置和密钥。
- 查询任务状态。
- 生成成功后把图片写入资产存储。

建议接口：

- `POST /api/generation/image`
- `GET /api/generation/tasks/:taskId`
- `POST /api/generation/tasks/:taskId/cancel`

请求示例：

```json
{
  "projectId": "project_xxx",
  "type": "inpaint",
  "model": "image-model-key",
  "prompt": "把标记区域改成红色花海",
  "imageAssetId": "asset_image_xxx",
  "maskAssetId": "asset_mask_xxx",
  "size": "1024x1024"
}
```

返回示例：

```json
{
  "taskId": "task_xxx",
  "status": "queued"
}
```

### Collaboration

职责：

- 项目房间。
- 广播节点、连线、文本、生成状态变化。
- 在线用户列表。
- 权限校验。

建议使用：

- WebSocket：适合实时协同。
- SSE：适合只推送生成状态，不适合复杂双向协同。

建议事件：

- `project:join`
- `project:leave`
- `canvas:node_added`
- `canvas:node_updated`
- `canvas:node_removed`
- `canvas:edge_added`
- `canvas:edge_removed`
- `generation:task_created`
- `generation:task_updated`
- `asset:created`
- `presence:updated`

### Models

职责：

- 后台配置模型、渠道、密钥、默认参数。
- 前端只获取可用模型列表和参数选项。
- 不向前端暴露 API Key。

建议接口：

- `GET /api/models/image`
- `GET /api/models/video`
- `GET /api/models/chat`

## 数据库建议表

### users

- `id`
- `email`
- `password_hash`
- `name`
- `avatar_url`
- `created_at`
- `updated_at`

### projects

- `id`
- `owner_id`
- `name`
- `thumbnail_asset_id`
- `created_at`
- `updated_at`

### project_members

- `project_id`
- `user_id`
- `role`
- `created_at`

角色建议：

- `owner`
- `editor`
- `viewer`

### canvas_snapshots

- `project_id`
- `nodes_json`
- `edges_json`
- `viewport_json`
- `version`
- `updated_at`

### assets

- `id`
- `owner_id`
- `project_id`
- `type`
- `url`
- `storage_key`
- `width`
- `height`
- `mime_type`
- `size_bytes`
- `created_at`

资产类型建议：

- `upload_image`
- `generated_image`
- `mask`
- `video`

### generation_tasks

- `id`
- `project_id`
- `user_id`
- `type`
- `model`
- `prompt`
- `input_asset_ids_json`
- `output_asset_ids_json`
- `status`
- `error_message`
- `created_at`
- `updated_at`

任务状态建议：

- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`

### model_configs

- `id`
- `type`
- `provider`
- `model_key`
- `display_name`
- `default_params_json`
- `enabled`
- `created_at`
- `updated_at`

密钥建议单独存储到安全配置服务，不直接放普通业务表。

## 前端改造模块

### 新增 API 模块

建议新增：

- `src/api/auth.js`
- `src/api/projects.js`
- `src/api/canvas.js`
- `src/api/assets.js`
- `src/api/generation.js`
- `src/api/collaboration.js`
- `src/api/models.js`

### 登录状态 Store

建议新增：

- `src/stores/auth.js`

职责：

- 保存当前用户。
- 保存 access token。
- 登录、注册、退出。
- 页面刷新后恢复会话。

### 请求层

修改：

- `src/utils/request.js`

需要支持：

- 自动携带 token。
- 401 自动刷新或跳转登录。
- 后端 API base URL 配置。

### 路由鉴权

修改：

- `src/router/index.js`

需要支持：

- 未登录访问画布跳转登录页。
- 已登录访问登录页跳转首页。
- 项目权限不足展示错误页或跳回首页。

### 项目 Store

重点修改：

- `src/stores/projects.js`

从 `localStorage` 改成调用云端项目 API。

建议保留一个本地 fallback：

- 开发模式或后端不可用时使用 localStorage。
- 生产模式默认云端。

### 画布 Store

重点修改：

- `src/stores/canvas.js`

需要新增：

- 远程加载画布。
- 防抖保存画布。
- 增量同步节点和连线。
- 接收协同事件并更新本地状态。
- 避免本机操作和远端广播循环触发。

### 工作流 Store

重点修改：

- `src/stores/workflows.js`

从本地保存改成按用户、团队或项目保存到后端。

### 生图 API

重点修改：

- `src/hooks/useApi.js`
- `src/api/image.js`

前端不再直接调用模型服务，而是调用后端：

- 创建生成任务。
- 轮询任务状态或接收 WebSocket 推送。
- 任务成功后拿到资产 URL。

### 首页

重点修改：

- `src/views/Home.vue`

需要改成：

- 当前用户项目列表。
- 支持团队或协作项目入口。
- 项目缩略图从资产 URL 读取。

### 画布页面

重点修改：

- `src/views/Canvas.vue`

需要新增：

- 加入项目协同房间。
- 展示在线用户。
- 保存状态提示。
- 生成任务状态同步。
- 断线重连。

### API 设置

重点修改：

- `src/components/ApiSettings.vue`

如果模型由后台配置：

- 普通用户隐藏 API Key 配置。
- 只展示当前可用模型和参数。
- 管理员后台再配置模型、渠道和密钥。

## 图片持久化方案

### 当前问题

当前本地方案会清理：

- base64 图片。
- `maskData`。

这是为了避免浏览器 `localStorage` 爆掉，但会导致项目再次打开时图片或蒙版不可恢复。

### 云端方案

所有图片类数据都走资产服务：

- 上传图：先传 `assets/upload`，节点保存 `assetId` 和 `url`。
- 生成图：生成任务完成后，后端存入对象存储，节点保存结果资产。
- 局部重绘 mask：前端生成 mask 后上传 `assets/mask`，生成任务引用 `maskAssetId`。

节点示例：

```json
{
  "id": "node_1",
  "type": "image",
  "data": {
    "label": "参考图",
    "assetId": "asset_xxx",
    "url": "https://cdn.example.com/assets/xxx.png",
    "width": 1024,
    "height": 1024
  }
}
```

局部重绘任务不建议长期把 `maskData` 放节点里，建议：

```json
{
  "imageAssetId": "asset_image_xxx",
  "maskAssetId": "asset_mask_xxx"
}
```

## 实施阶段

### 第一阶段：登录和云端项目骨架

目标：

- 可以登录。
- 首页显示云端项目。
- 创建项目写入后端。
- 画布可以从后端加载和保存。

改动：

- 新增登录页。
- 新增 `auth` store。
- 新增项目 API。
- 改造 `projects.js`。
- 改造路由鉴权。

### 第二阶段：图片资产持久化

目标：

- 上传图片不再只保存 base64。
- 生成图片能长期打开。
- 项目再次打开时图片不丢。

改动：

- 新增 `assets` API。
- 上传图片后保存 `assetId/url`。
- 生成成功后保存后端返回的资产 URL。
- 节点数据从 base64 改成资产引用。

### 第三阶段：后端生图任务

目标：

- 前端不暴露模型密钥。
- 生图、图生图、局部重绘都走后端任务。
- 支持任务状态恢复。

改动：

- 新增 `generation` API。
- 改造 `useApi.js`。
- 改造 `image.js`。
- 生成节点保存 `taskId`、`status`、`assetId`。

### 第四阶段：多人协同

目标：

- 多人进入同一个项目。
- 节点、连线、生成状态实时同步。
- 支持在线用户显示。

改动：

- 新增 WebSocket 客户端。
- 改造 `canvas.js` 增量广播。
- `Canvas.vue` 加入房间和在线状态。
- 加权限校验和冲突处理。

### 第五阶段：后台模型管理

目标：

- 后台配置模型和密钥。
- 前端只展示可用模型。

改动：

- 新增后台模型配置接口。
- 改造模型 store。
- 隐藏或调整 `ApiSettings.vue`。

## 推荐优先级

优先级从高到低：

1. 登录和项目云端化。
2. 图片资产持久化。
3. 生图任务后端化。
4. 多人协同。
5. 后台模型管理。

原因：

- 没有登录，就无法区分项目归属。
- 没有资产持久化，协同和项目恢复都会丢图片。
- 没有后端任务，模型密钥会暴露在前端。
- 协同依赖前面三层稳定数据结构。

## 前后端联调检查清单

- 登录后刷新页面仍保持登录状态。
- 未登录访问画布会跳登录。
- 创建项目后刷新首页仍能看到项目。
- 上传图片后刷新项目，图片仍可打开。
- 生成图片后刷新项目，结果图仍可打开。
- 局部重绘后刷新项目，结果图仍可打开。
- 同一项目两个浏览器窗口打开，节点增删能同步。
- 连线删除能同步。
- 生图任务状态能同步。
- API Key 不出现在浏览器请求 payload 或 localStorage 中。
