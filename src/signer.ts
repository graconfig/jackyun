import { createHash } from 'crypto'

/**
 * 签名器 - 按吉客云签名规则生成 MD5 签名
 * 需求: 3.1, 3.2, 3.3, 7.1
 */
export class Signer {
  /**
   * 计算吉客云签名
   *
   * 算法步骤：
   * 1. 将 params 的 key 按 ASCII 字典序升序排列
   * 2. 依次拼接 key + value，得到中间字符串 S
   * 3. 完整签名原文 = secret + S + secret
   * 4. 将整个字符串转为小写
   * 5. 对小写字符串做 UTF-8 MD5，输出 32 位小写十六进制
   *
   * @param params  参与签名的参数键值对（已排除 sign / contextid / token）
   * @param secret  AppSecret
   * @returns       32 位小写十六进制 MD5 字符串
   */
  sign(params: Map<string, string>, secret: string): string {
    // 1. 按 ASCII 字典序升序排列 key
    const sortedKeys = Array.from(params.keys()).sort()

    // 2. 拼接 key+value 得到中间字符串 S
    const s = sortedKeys.map(key => key + params.get(key)).join('')

    // 3. 完整签名原文 = secret + S + secret
    const raw = secret + s + secret

    // 4. 整体转小写
    const lower = raw.toLowerCase()

    // 5. UTF-8 MD5，输出 32 位小写十六进制
    return createHash('md5').update(lower, 'utf8').digest('hex')
  }
}
