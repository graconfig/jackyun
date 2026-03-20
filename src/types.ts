/**
 * OA ESB ERP 网关 - 核心类型定义
 */

// ─── 错误码枚举 ───────────────────────────────────────────────────────────────

/**
 * 网关错误码
 * - CONFIG_MISSING:  AppKey 或 AppSecret 未配置（需求 1.2）
 * - PARAM_MISSING:   method / version / bizcontent 缺失（需求 2.4）
 * - ERP_TIMEOUT:     ERP 平台 30 秒内未响应（需求 5.4）
 * - ERP_HTTP_ERROR:  ERP 平台返回 HTTP 非 2xx 状态码（需求 5.5）
 * - INTERNAL_ERROR:  未预期的内部异常
 */
export enum ErrorCode {
  CONFIG_MISSING = 'CONFIG_MISSING',
  PARAM_MISSING = 'PARAM_MISSING',
  ERP_TIMEOUT = 'ERP_TIMEOUT',
  ERP_HTTP_ERROR = 'ERP_HTTP_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

// ─── 请求 / 响应接口 ──────────────────────────────────────────────────────────

/**
 * 调用方传入的网关请求参数（需求 2.1）
 */
export interface GatewayRequest {
  /** 必填：ERP 接口方法名 */
  method: string
  /** 必填：接口版本号 */
  version: string
  /** 必填：业务参数 JSON 字符串（原始值，不做任何编码） */
  bizcontent: string
  /** 可选：内容类型，默认 "json" */
  contenttype?: string
  /** 可选：用户令牌，不参与签名 */
  token?: string
  /** 可选：上下文 ID，不参与签名 */
  contextid?: string
}

/**
 * 网关成功响应（需求 6.1, 6.2）
 */
export interface GatewayResponse {
  /** ERP 原始响应体（UTF-8 字符串，不做任何修改） */
  body: string
  /** ERP 返回的 HTTP 状态码 */
  httpStatus: number
}

/**
 * HttpClient 返回的原始 HTTP 响应
 */
export interface HttpResponse {
  /** HTTP 状态码 */
  status: number
  /** 响应体字符串（UTF-8） */
  body: string
}

// ─── 错误类型 ─────────────────────────────────────────────────────────────────

/**
 * 网关错误响应体格式（需求 1.2, 2.4, 5.4, 5.5）
 */
export interface GatewayErrorResponse {
  /** 错误码 */
  errorCode: ErrorCode
  /** 人类可读的错误描述 */
  errorMessage: string
  /** 可选的附加信息（如缺失的参数名、HTTP 状态码） */
  detail?: string
}

/**
 * 网关内部错误基类
 */
export class GatewayError extends Error {
  public readonly errorCode: ErrorCode
  public readonly detail?: string

  constructor(errorCode: ErrorCode, message: string, detail?: string) {
    super(message)
    this.name = 'GatewayError'
    this.errorCode = errorCode
    this.detail = detail
  }

  toErrorResponse(): GatewayErrorResponse {
    return {
      errorCode: this.errorCode,
      errorMessage: this.message,
      detail: this.detail,
    }
  }
}

/**
 * 配置缺失错误（需求 1.2）
 */
export class ConfigMissingError extends GatewayError {
  constructor(detail?: string) {
    super(ErrorCode.CONFIG_MISSING, 'AppKey 或 AppSecret 未配置', detail)
    this.name = 'ConfigMissingError'
  }
}

/**
 * 必填参数缺失错误（需求 2.4）
 */
export class ParamMissingError extends GatewayError {
  constructor(missingParams: string[]) {
    super(
      ErrorCode.PARAM_MISSING,
      `缺少必填参数: ${missingParams.join(', ')}`,
      missingParams.join(', ')
    )
    this.name = 'ParamMissingError'
  }
}

/**
 * ERP 请求超时错误（需求 5.4）
 */
export class ErpTimeoutError extends GatewayError {
  constructor() {
    super(ErrorCode.ERP_TIMEOUT, 'ERP 平台请求超时（30s）')
    this.name = 'ErpTimeoutError'
  }
}

/**
 * ERP HTTP 错误（需求 5.5）
 */
export class ErpHttpError extends GatewayError {
  public readonly httpStatus: number
  public readonly responseBody: string

  constructor(httpStatus: number, responseBody: string) {
    super(
      ErrorCode.ERP_HTTP_ERROR,
      `ERP 平台返回非 2xx 状态码: ${httpStatus}`,
      String(httpStatus)
    )
    this.name = 'ErpHttpError'
    this.httpStatus = httpStatus
    this.responseBody = responseBody
  }
}
