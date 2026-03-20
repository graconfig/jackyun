# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
# 安装全部依赖（含 devDependencies），确保 tsc 可用
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ---- Stage 2: Production ----
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
# 只安装生产依赖，保持镜像精简
RUN npm ci --omit=dev

# 从构建阶段只拷贝编译产物
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/server.js"]
