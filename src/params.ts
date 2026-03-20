import { GatewayRequest, ParamMissingError } from './types'

/**
 * 参数校验与公共参数填充
 * 需求: 2.1, 2.2, 2.3, 2.4
 */

// 必填参数列表
const REQUIRED_PARAMS: (keyof GatewayRequest)[] = ['method', 'version', 'bizcontent']

/**
 * 校验必填参数，缺失时抛出 ParamMissingError
 * 收集所有缺失参数名后一次性返回错误（需求 2.4）
 *
 * @param request 调用方传入的网关请求
 * @throws ParamMissingError 当任意必填参数缺失时
 */
export function validateParams(request: Partial<GatewayRequest>): void {
  const missing = REQUIRED_PARAMS.filter(
    key => !request[key] || (request[key] as string).trim() === ''
  )

  if (missing.length > 0) {
    throw new ParamMissingError(missing)
  }
}

/**
 * 补全公共参数：appkey 和 timestamp，以及 contenttype 默认值
 * 返回包含所有参与签名参数的 Map（不含 token、contextid、sign）
 *
 * @param request  已通过校验的网关请求
 * @param appKey   从 ConfigStore 读取的 AppKey（需求 2.2）
 * @returns        参数 Map，可直接传入 Signer.sign()
 */
export function buildParams(
  request: GatewayRequest,
  appKey: string
): Map<string, string> {
  // timestamp 格式：yyyy-MM-dd HH:mm:ss（需求 2.3）
  const now = new Date()
  const timestamp = formatTimestamp(now)

  // contenttype 缺省时默认填充 "json"（需求 2.1）
  const contenttype = request.contenttype ?? 'json'

  const params = new Map<string, string>([
    ['appkey', appKey],           // 需求 2.2
    ['method', request.method],
    ['version', request.version],
    ['bizcontent', request.bizcontent],
    ['contenttype', contenttype], // 需求 2.1
    ['timestamp', timestamp],     // 需求 2.3
  ])

  return params
}

/**
 * 将 Date 格式化为 `yyyy-MM-dd HH:mm:ss`
 */
export function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')

  const yyyy = date.getFullYear()
  const MM = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const HH = pad(date.getHours())
  const mm = pad(date.getMinutes())
  const ss = pad(date.getSeconds())

  return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`
}
