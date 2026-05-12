# xuegao-canvas Docker 部署指南

## 快速开始

### 方式一：


```bash
# 1. 构建前端
pnpm install
pnpm build

# 2. 构建 Docker 镜像
docker build -t xuegao-canvas .

# 3. 运行容器
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

