# File Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将日志实时写入 `logs/app-YYYY-MM-DD.log`，按天滚动，保留 30 天，请求日志记录完整 bizcontent。

**Architecture:** 新增 `src/logger.ts` 创建 winston 实例（Console + DailyRotateFile 双 transport），实现现有 `Logger` 接口；`server.ts` 注入该实例；`gateway-service.ts` 请求日志加入 bizcontent 字段并移除脱敏注释。

**Tech Stack:** winston, winston-daily-rotate-file

---

## 文件概览

| 操作 | 路径 | 说明 |
|------|------|------|
| 新增 | `src/logger.ts` | winston 实例，实现 Logger 接口 |
| 修改 | `src/gateway-service.ts` | 请求日志加 bizcontent，移除需求 8.1 注释 |
| 修改 | `src/server.ts` | 注入 winstonLogger |
| 修改 | `package.json` | 新增依赖 |
| 新增 | `logs/.gitkeep` | 保留目录结构 |
| 修改 | `.gitignore` | 忽略 logs/*.log |
| 修改 | `docker-compose.yml` | 挂载 ./logs:/app/logs |

---

### Task 1: 安装依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 winston 和 winston-daily-rotate-file**

```bash
cd d:/Users/PC/Projects/jackyun
npm install winston winston-daily-rotate-file
```

Expected: `package.json` 的 `dependencies` 中出现 `winston` 和 `winston-daily-rotate-file`。

- [ ] **Step 2: 确认类型声明已包含**

```bash
npm ls winston winston-daily-rotate-file
```

Expected: 两个包均列出，版本号正常（winston-daily-rotate-file 自带类型声明）。

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add winston and winston-daily-rotate-file dependencies"
```

---

### Task 2: 创建 logger.ts

**Files:**
- Create: `src/logger.ts`

- [ ] **Step 1: 创建文件**

写入 `src/logger.ts`：

```typescript
import path from 'path'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import type { Logger } from './gateway-service'

const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level.toUpperCase()}] ${message}`
})

const winstonInstance = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    logFormat
  ),
  transports: [
    new winston.transports.Console(),
    new DailyRotateFile({
      dirname: path.join(process.cwd(), 'logs'),
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      zippedArchive: false,
    }),
  ],
})

export const winstonLogger: Logger = {
  info: (message: string) => winstonInstance.info(message),
  error: (message: string) => winstonInstance.error(message),
}
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

```bash
cd d:/Users/PC/Projects/jackyun
npx tsc --noEmit
```

Expected: 无报错输出。

- [ ] **Step 3: Commit**

```bash
git add src/logger.ts
git commit -m "feat: add winston file logger"
```

---

### Task 3: 注入 winstonLogger 到 server.ts

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: 修改 server.ts**

将 `src/server.ts` 第 19-23 行从：

```typescript
const service = new GatewayService(
  new ConfigStore(),
  new Signer(),
  new HttpClient()
)
```

改为：

```typescript
import { winstonLogger } from './logger'

// ...（保留文件其余内容不变）

const service = new GatewayService(
  new ConfigStore(),
  new Signer(),
  new HttpClient(),
  winstonLogger
)
```

完整修改后的 import 区域（文件顶部）：

```typescript
import 'dotenv/config'
import express, { Request, Response } from 'express'
import { ConfigStore } from './config-store'
import { GatewayService } from './gateway-service'
import { HttpClient } from './http-client'
import { winstonLogger } from './logger'
import { Signer } from './signer'
import { GatewayRequest } from './types'
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

```bash
npx tsc --noEmit
```

Expected: 无报错。

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat: inject winstonLogger into GatewayService"
```

---

### Task 4: gateway-service.ts 请求日志加入 bizcontent

**Files:**
- Modify: `src/gateway-service.ts:53-64`

- [ ] **Step 1: 修改请求日志区块**

将 `src/gateway-service.ts` 第 53-63 行从：

```typescript
    // 请求日志：记录 method、version、timestamp、contextid（若有）
    // 不记录 AppSecret 和 bizcontent 原文（需求 8.1）
    const requestLog: Record<string, string> = {
      method: request.method,
      version: request.version,
      timestamp: new Date().toISOString(),
    }
    if (request.contextid) {
      requestLog['contextid'] = request.contextid
    }
    this.logger.info(`[Gateway] 请求: ${JSON.stringify(requestLog)}`)
```

改为：

```typescript
    const requestLog: Record<string, string> = {
      method: request.method,
      version: request.version,
      timestamp: new Date().toISOString(),
      bizcontent: request.bizcontent,
    }
    if (request.contextid) {
      requestLog['contextid'] = request.contextid
    }
    this.logger.info(`[Gateway] 请求: ${JSON.stringify(requestLog)}`)
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

```bash
npx tsc --noEmit
```

Expected: 无报错。

- [ ] **Step 3: 运行现有测试，确认无回归**

```bash
npm test
```

Expected: 所有测试 PASS（gateway-service-logging.test.ts 和其他测试均通过）。

- [ ] **Step 4: Commit**

```bash
git add src/gateway-service.ts
git commit -m "feat: include bizcontent in request log"
```

---

### Task 5: 配置 logs 目录和 .gitignore

**Files:**
- Create: `logs/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: 创建 logs/.gitkeep**

```bash
mkdir -p d:/Users/PC/Projects/jackyun/logs
touch d:/Users/PC/Projects/jackyun/logs/.gitkeep
```

- [ ] **Step 2: 更新 .gitignore**

在 `.gitignore` 末尾追加：

```
logs/*.log
```

- [ ] **Step 3: Commit**

```bash
git add logs/.gitkeep .gitignore
git commit -m "chore: add logs directory and gitignore log files"
```

---

### Task 6: docker-compose.yml 挂载 logs 目录

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: 修改 docker-compose.yml**

在 `volumes:` 块中新增一行，完整 `volumes` 块变为：

```yaml
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - /etc/timezone:/etc/timezone:ro
      - ./logs:/app/logs
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: mount logs volume in docker-compose"
```

---

### Task 7: 端到端冒烟测试

- [ ] **Step 1: 启动服务（开发模式）**

```bash
cd d:/Users/PC/Projects/jackyun
npm run dev
```

Expected: 终端输出 `[Gateway] 服务已启动，监听端口 3000`，同时 `logs/` 目录下出现 `app-2026-06-16.log`（日期为当天）。

- [ ] **Step 2: 发送测试请求**

新开终端：

```bash
curl -s -X POST http://localhost:3000/invoke \
  -H "Content-Type: application/json" \
  -d '{"method":"stock.query","version":"1.0","bizcontent":"{\"warehouseNo\":\"WH001\"}"}'
```

- [ ] **Step 3: 确认日志文件内容**

```bash
cat d:/Users/PC/Projects/jackyun/logs/app-2026-06-16.log
```

Expected: 文件中包含类似以下内容：

```
2026-06-16T10:30:00.000Z [INFO] [Gateway] 请求: {"method":"stock.query","version":"1.0","timestamp":"...","bizcontent":"{\"warehouseNo\":\"WH001\"}"}
2026-06-16T10:30:00.123Z [INFO] [Gateway] 响应: {"httpStatus":200,"elapsedMs":...}
```

或包含错误日志（如凭证未配置时）：

```
2026-06-16T10:30:00.123Z [ERROR] [Gateway] 异常: {"errorType":"...","errorMessage":"...","elapsedMs":...}
```

- [ ] **Step 4: 停止服务**

`Ctrl+C` 停止开发服务器。
