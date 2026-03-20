# OA ESB ERP 网关

部署在 OA ESB 中心的通用网关服务，供 OA 内部系统调用吉客云（Jackyun）SAAS ERP 开放平台接口。

网关统一处理凭证管理、签名生成、参数编码和请求转发，调用方只需传入业务参数。

## 功能

- 统一持有 AppKey / AppSecret，调用方无需关心凭证
- 自动补全公共参数（appkey、timestamp）
- 按吉客云规则自动计算签名（字典序 + AppSecret 首尾 + 转小写 + MD5）
- bizcontent 签名用原始值，HTTP 传输自动 URL 编码
- ERP 响应原样透传，不做任何封装
- 请求/响应/异常日志，不记录 AppSecret 和 bizcontent 原文

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

```bash
export ERP_APP_KEY=你的AppKey
export ERP_APP_SECRET=你的AppSecret
```

### 启动服务

```bash
# 开发模式（ts-node，无需编译）
npm run dev

# 生产模式
npm run build
npm start
```

默认监听 `3000` 端口，可通过 `PORT` 环境变量修改。

### 调用示例

```bash
curl -X POST http://localhost:3000/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "method": "jst.goods.list",
    "version": "2",
    "bizcontent": "{\"pageIndex\":1,\"pageSize\":20}"
  }'
```

健康检查：

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

## 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| method | string | 是 | ERP 接口方法名，如 `jst.goods.list` |
| version | string | 是 | 接口版本号，如 `2` |
| bizcontent | string | 是 | 业务参数 JSON 字符串（原始值，不做编码） |
| contenttype | string | 否 | 返回格式，默认 `json` |
| token | string | 否 | 用户授权 token，不参与签名 |
| contextid | string | 否 | 上下文关联 ID，不参与签名 |

## 错误码

| 错误码 | 触发条件 |
|--------|---------|
| `CONFIG_MISSING` | `ERP_APP_KEY` 或 `ERP_APP_SECRET` 环境变量未配置 |
| `PARAM_MISSING` | `method`、`version`、`bizcontent` 任意必填参数缺失 |
| `ERP_TIMEOUT` | ERP 平台 30 秒内未响应 |
| `ERP_HTTP_ERROR` | ERP 平台返回 HTTP 非 2xx 状态码 |
| `INTERNAL_ERROR` | 未预期的内部异常 |

错误响应格式：

```json
{
  "errorCode": "PARAM_MISSING",
  "errorMessage": "缺少必填参数: method",
  "detail": "method"
}
```

## 项目结构

```
src/
├── types.ts            # 核心类型、错误码枚举、错误类
├── config-store.ts     # 从环境变量读取 AppKey / AppSecret
├── signer.ts           # 签名器（字典序排列 + MD5）
├── params.ts           # 参数校验与公共参数填充
├── form-body.ts        # bizcontent URL 编码与请求体组装
├── http-client.ts      # HTTP POST 客户端（30s 超时）
├── gateway-service.ts  # 主逻辑串联 + 日志记录
└── __tests__/          # 单元测试 + 属性测试（65 个）
```

## 签名规则

吉客云签名算法（参考官方文档）：

1. 取除 `sign`、`contextid`、`token` 之外的所有参数，按参数名 ASCII 字典序升序排列
2. 依次拼接 `参数名 + 参数值`，得到字符串 S
3. 完整签名原文 = `AppSecret + S + AppSecret`
4. 整体转小写后做 UTF-8 MD5，输出 32 位小写十六进制

> bizcontent 参与签名时使用原始 JSON 字符串，HTTP 传输时使用 URL 编码值。

## 测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch
```

测试覆盖 65 个用例，包含：
- 各组件单元测试
- 10 个正确性属性的属性测试（使用 [fast-check](https://fast-check.io/)，每个属性 100 次迭代）

## 构建

```bash
npm run build
# 输出到 dist/
```

## 环境要求

- Node.js >= 16
- TypeScript >= 5.4
