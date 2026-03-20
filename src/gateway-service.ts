/**
 * GatewayService - OA ESB ERP 网关主逻辑
 * 需求: 1.1, 1.2, 2.1-2.4, 3.1-3.5, 4.1-4.2, 5.1-5.5, 6.1-6.2, 8.1-8.3
 */

import { ConfigStore } from './config-store'
import { encodeFormBody } from './form-body'
import { HttpClient } from './http-client'
import { buildParams, validateParams } from './params'
import { Signer } from './signer'
import {
    ErpHttpError,
    ErrorCode,
    GatewayError,
    GatewayErrorResponse,
    GatewayRequest,
    GatewayResponse,
} from './types'

const ERP_URL = 'https://open.jackyun.com/open/openapi/do'

/**
 * Logger 接口，便于测试时注入 mock（需求 8.1-8.3）
 */
export interface Logger {
  info(message: string): void
  error(message: string): void
}

/**
 * 默认 Logger：使用 console（ESB 环境通常有统一日志收集）
 */
const defaultLogger: Logger = {
  info: (msg) => console.log(msg),
  error: (msg) => console.error(msg),
}

export class GatewayService {
  private readonly logger: Logger

  constructor(
    private readonly configStore: ConfigStore,
    private readonly signer: Signer,
    private readonly httpClient: HttpClient,
    logger?: Logger
  ) {
    this.logger = logger ?? defaultLogger
  }

  async invoke(request: GatewayRequest): Promise<GatewayResponse | GatewayErrorResponse> {
    const startTime = Date.now()

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

    try {
      // 1. 读取 AppKey / AppSecret（需求 1.1, 1.2）
      const appKey = this.configStore.getAppKey()
      const appSecret = this.configStore.getAppSecret()

      // 2. 校验必填参数（需求 2.4）
      validateParams(request)

      // 3. 补全公共参数（需求 2.1, 2.2, 2.3）
      const params = buildParams(request, appKey)

      // 4. 计算签名（需求 3.1-3.5）
      const sign = this.signer.sign(params, appSecret)
      params.set('sign', sign)

      // 5. URL 编码 bizcontent 并组装请求体（需求 4.1, 4.2, 5.1-5.3）
      const formBody = encodeFormBody(params, request.token, request.contextid)

      // 6. 调用 HttpClient（需求 5.1, 5.4）
      const httpResponse = await this.httpClient.post(ERP_URL, formBody)

      // 7. 处理响应（需求 5.5, 6.1, 6.2）
      if (httpResponse.status < 200 || httpResponse.status >= 300) {
        throw new ErpHttpError(httpResponse.status, httpResponse.body)
      }

      // 响应日志：记录 HTTP 状态码和耗时（需求 8.2）
      const elapsed = Date.now() - startTime
      this.logger.info(`[Gateway] 响应: ${JSON.stringify({ httpStatus: httpResponse.status, elapsedMs: elapsed })}`)

      return {
        body: httpResponse.body,
        httpStatus: httpResponse.status,
      }
    } catch (err) {
      // 异常日志：记录异常类型和错误描述（需求 8.3）
      const elapsed = Date.now() - startTime
      const errorType = err instanceof Error ? err.constructor.name : 'UnknownError'
      const errorMessage = err instanceof Error ? err.message : String(err)
      this.logger.error(`[Gateway] 异常: ${JSON.stringify({ errorType, errorMessage, elapsedMs: elapsed })}`)

      if (err instanceof GatewayError) {
        return err.toErrorResponse()
      }
      // 捕获未预期异常，返回 INTERNAL_ERROR
      const message = err instanceof Error ? err.message : String(err)
      return {
        errorCode: ErrorCode.INTERNAL_ERROR,
        errorMessage: `内部错误: ${message}`,
      }
    }
  }
}
