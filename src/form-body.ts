/**
 * bizcontent URL 编码与请求体组装
 * 需求: 4.1, 4.2, 5.1, 5.2, 5.3
 */

/**
 * 组装 application/x-www-form-urlencoded 请求体
 *
 * 关键规则：
 * - bizcontent 值必须 UTF-8 URL 编码（encodeURIComponent），其他参数不做编码
 * - token 和 contextid 若存在则追加到请求体末尾（不参与签名，需求 5.2, 5.3）
 *
 * @param signedParams  已签名的参数 Map（包含 sign，bizcontent 为原始值）
 * @param token         可选 token（不参与签名，直接追加）
 * @param contextid     可选 contextid（不参与签名，直接追加）
 * @returns             URL 编码后的请求体字符串
 */
export function encodeFormBody(
  signedParams: Map<string, string>,
  token?: string,
  contextid?: string
): string {
  const parts: string[] = []

  for (const [key, value] of signedParams) {
    if (key === 'bizcontent') {
      // bizcontent 使用 UTF-8 URL 编码（需求 4.1）
      parts.push(`${key}=${encodeURIComponent(value)}`)
    } else {
      // 其他参数不做 URL 编码
      parts.push(`${key}=${value}`)
    }
  }

  // token 和 contextid 不参与签名，追加到请求体末尾（需求 5.2, 5.3）
  if (token !== undefined) {
    parts.push(`token=${token}`)
  }
  if (contextid !== undefined) {
    parts.push(`contextid=${contextid}`)
  }

  return parts.join('&')
}
