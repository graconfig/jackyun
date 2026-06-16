# 日志落地设计文档

日期：2026-06-16

## 目标

将现有 `console.log/error` 日志同时写入本地 `logs/` 目录，按天滚动，保留 30 天。

## 技术选型

- **winston**：日志库，支持多 transport 并发输出
- **winston-daily-rotate-file**：winston 插件，按天滚动文件并自动清理

## 文件变更

```
src/logger.ts          新增 — winston 实例，实现现有 Logger 接口
src/server.ts          修改 — 注入 winstonLogger 替代 defaultLogger
logs/.gitkeep          新增 — 保证目录受版本控制
.gitignore             修改 — 忽略 logs/*.log
docker-compose.yml     修改 — 挂载 ./logs:/app/logs 持久化日志
package.json           修改 — 新增 winston、winston-daily-rotate-file 依赖
```

## 日志配置

### Transport 1：Console

保留现有控制台输出，行为不变。

### Transport 2：DailyRotateFile

| 参数 | 值 |
|------|----|
| 文件路径 | `logs/app-%DATE%.log` |
| DATE 格式 | `YYYY-MM-DD` |
| 滚动触发 | 每天零点（跨天后新日志写入新文件） |
| 写入时机 | 实时，每条日志产生后立即落盘 |
| 保留天数 | 30 天，超期自动删除 |

### 日志格式

纯文本，每行一条：

```
2026-06-16T10:30:00.000Z [INFO] [Gateway] 请求: {"method":"..."}
2026-06-16T10:30:00.123Z [ERROR] [Gateway] 异常: {"errorType":"..."}
```

格式模板：`TIMESTAMP [LEVEL] MESSAGE`，其中 LEVEL 全大写。

## 接口适配

`src/logger.ts` 导出的 `winstonLogger` 实现 `gateway-service.ts` 中已定义的 `Logger` 接口：

```typescript
export interface Logger {
  info(message: string): void
  error(message: string): void
}
```

`gateway-service.ts` 及所有测试文件**无需改动**。

## Docker 部署

`docker-compose.yml` 新增卷挂载，确保容器重建后日志不丢失：

```yaml
volumes:
  - ./logs:/app/logs
```

宿主机 `./logs` 目录在首次 `docker compose up` 时自动创建。

## .gitignore 策略

```
logs/*.log
```

`logs/.gitkeep` 不被忽略，目录结构保留在版本控制中。
