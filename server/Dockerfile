FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY schema.sql ./schema.sql
COPY src ./src

ENV NODE_ENV=production
ENV DB_MODE=postgres
ENV HOST=0.0.0.0
ENV PORT=8787

EXPOSE 8787

CMD ["node", "src/index.js"]
