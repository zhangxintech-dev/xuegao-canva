FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_APP_API_BASE_URL=/api
ARG VITE_BASE_PATH=/xuegao-canvas/
ENV VITE_APP_API_BASE_URL=${VITE_APP_API_BASE_URL}
ENV VITE_BASE_PATH=${VITE_BASE_PATH}

RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html/xuegao-canvas

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
