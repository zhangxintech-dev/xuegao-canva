# xuegao-canvas Docker 部署指南

## 快速开始

### 方式一：一键启动前端 + 后端 API + PostgreSQL

```bash
npm run docker:up
```

这会启动三个容器：

- `xuegao-canvas-frontend`：前端页面，宿主机端口 `5173`
- `xuegao-canvas-api`：后端 API，宿主机端口 `8787`
- `xuegao-canvas-postgres`：PostgreSQL，宿主机端口 `5432`

访问前端：

```text
http://127.0.0.1:5173/xuegao-canvas/
```

检查前后端是否可用：

```bash
npm run docker:check
```

检查后台管理功能是否完整可用：

```bash
npm run admin:check
```

看到 `dbMode: "postgres"` 后，再启动前端：
前端容器已由 `npm run docker:up` 自动启动，不需要再运行 `npm run dev`。

默认管理员：

```text
邮箱：zian@bencom.cn
密码：123456
```

常用命令：

```bash
npm run docker:logs
npm run docker:down
```

### 方式二：只部署前端静态页面


```bash
# 1. 构建 Docker 镜像
docker build -t xuegao-canvas .

# 2. 运行容器
docker run -d -p 8080:80 --name xuegao-canvas xuegao-canvas
```

## 常用命令

```bash
# 停止容器
docker stop xuegao-canvas

# 启动容器
docker start xuegao-canvas

# 删除容器
docker rm xuegao-canvas

# 查看日志
docker logs xuegao-canvas

# 进入容器
docker exec -it xuegao-canvas sh
```

## 配置说明

### 端口映射

默认映射 `8080:80`，可修改宿主机端口：

```bash
docker run -d -p 3000:80 --name xuegao-canvas peigen666/xuegao-canvas:latest
```

### Nginx 配置

- 静态文件路径：`/usr/share/nginx/html/xuegao-canvas`
- API 代理：`/v1` → `https://api.xuegao.site`
- Gzip 压缩：已启用
- 静态资源缓存：1 年
