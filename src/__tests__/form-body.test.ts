import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { encodeFormBody } from '../form-body'
import { Signer } from '../signer'

const signer = new Signer()

// ─── 单元测试：encodeFormBody ─────────────────────────────────────────────────

describe('encodeFormBody - 单元测试', () => {
  it('bizcontent 被 URL 编码，其他参数不编码', () => {
    const params = new Map<string, string>([
      ['appkey', 'testkey'],
      ['bizcontent', '{"name":"张三"}'],
      ['sign', 'abc123'],
    ])
    const body = encodeFormBody(params)
    expect(body).toContain('bizcontent=%7B%22name%22%3A%22%E5%BC%A0%E4%B8%89%22%7D')
    expect(body).toContain('appkey=testkey')
    expect(body).toContain('sign=abc123')
  })

  it('不含特殊字符的 bizcontent 编码后与原值相同', () => {
    const params = new Map<string, string>([
      ['bizcontent', 'hello'],
    ])
    const body = encodeFormBody(params)
    expect(body).toBe('bizcontent=hello')
  })

  it('token 存在时追加到请求体末尾', () => {
    const params = new Map<string, string>([
      ['appkey', 'key1'],
      ['bizcontent', '{}'],
    ])
    const body = encodeFormBody(params, 'mytoken')
    expect(body).toContain('token=mytoken')
    expect(body.endsWith('token=mytoken')).toBe(true)
  })

  it('contextid 存在时追加到请求体末尾', () => {
    const params = new Map<string, string>([
      ['appkey', 'key1'],
      ['bizcontent', '{}'],
    ])
    const body = encodeFormBody(params, undefined, 'ctx-001')
    expect(body).toContain('contextid=ctx-001')
    expect(body.endsWith('contextid=ctx-001')).toBe(true)
  })

  it('token 和 contextid 同时存在时均追加到请求体', () => {
    const params = new Map<string, string>([
      ['bizcontent', '{}'],
    ])
    const body = encodeFormBody(params, 'tok', 'ctx')
    expect(body).toContain('token=tok')
    expect(body).toContain('contextid=ctx')
  })

  it('token 和 contextid 均未传时不出现在请求体中', () => {
    const params = new Map<string, string>([
      ['bizcontent', '{}'],
    ])
    const body = encodeFormBody(params)
    expect(body).not.toContain('token=')
    expect(body).not.toContain('contextid=')
  })

  it('空格在 bizcontent 中被编码为 %20', () => {
    const params = new Map<string, string>([
      ['bizcontent', 'hello world'],
    ])
    const body = encodeFormBody(params)
    expect(body).toBe('bizcontent=hello%20world')
  })

  it('参数之间用 & 分隔', () => {
    const params = new Map<string, string>([
      ['appkey', 'k'],
      ['bizcontent', '{}'],
      ['sign', 's'],
    ])
    const body = encodeFormBody(params)
    const parts = body.split('&')
    expect(parts.length).toBe(3)
  })
})

// ─── 属性测试 ─────────────────────────────────────────────────────────────────

describe('encodeFormBody - 属性测试', () => {
  /**
   * Feature: oa-esb-erp-gateway, Property 2: bizcontent 编码分离
   * 生成含特殊字符（空格、引号、中文）的 bizcontent，验证签名用原始值、
   * 请求体用编码值，两者不相等（当原始值含需编码字符时）
   * Validates: Requirements 3.4, 4.1, 4.2
   */
  it('属性 2：bizcontent 编码分离 - 签名用原始值，请求体用编码值', () => {
    // 生成含特殊字符的 bizcontent（空格、引号、中文）
    const specialBizcontent = fc.oneof(
      // 含空格
      fc.string({ minLength: 1, maxLength: 30 }).map(s => s + ' ' + s),
      // 含引号
      fc.string({ minLength: 1, maxLength: 30 }).map(s => `"${s}"`),
      // 含中文（固定前缀确保有需编码字符）
      fc.string({ minLength: 1, maxLength: 20 }).map(s => `{"name":"张三${s}"}`),
    )

    fc.assert(
      fc.property(
        specialBizcontent,
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 64 }),
        (bizcontent, appKey, secret) => {
          // 构造签名参数（bizcontent 使用原始值）
          const signParams = new Map<string, string>([
            ['appkey', appKey],
            ['bizcontent', bizcontent],
            ['method', 'test.method'],
            ['version', 'v1.0'],
          ])

          // 签名使用原始 bizcontent（需求 3.4, 4.2）
          const sign = signer.sign(signParams, secret)
          signParams.set('sign', sign)

          // 组装请求体（bizcontent 应被 URL 编码，需求 4.1）
          const body = encodeFormBody(signParams)

          // 从请求体中提取 bizcontent 的编码值
          const match = body.match(/(?:^|&)bizcontent=([^&]*)/)
          if (!match) return false
          const encodedBizcontent = match[1]

          // 验证：请求体中的 bizcontent 是原始值的 URL 编码
          if (encodedBizcontent !== encodeURIComponent(bizcontent)) return false

          // 验证：当原始值含需编码字符时，编码值与原始值不相等（需求 4.1, 4.2）
          const needsEncoding = encodeURIComponent(bizcontent) !== bizcontent
          if (needsEncoding) {
            return encodedBizcontent !== bizcontent
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: oa-esb-erp-gateway, Property 5: 非签名参数包含在请求体中
   * 生成带 token/contextid 的请求，验证请求体包含这两个参数，
   * 且移除后签名结果不变
   * Validates: Requirements 5.2, 5.3
   */
  it('属性 5：非签名参数包含在请求体中 - token/contextid 在请求体中但不影响签名', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),  // appKey
        fc.string({ minLength: 1, maxLength: 64 }),  // secret
        fc.string({ minLength: 1, maxLength: 30 }),  // token
        fc.string({ minLength: 1, maxLength: 30 }),  // contextid
        fc.string({ minLength: 1, maxLength: 100 }), // bizcontent
        (appKey, secret, token, contextid, bizcontent) => {
          // 构造签名参数（不含 token 和 contextid）
          const signParams = new Map<string, string>([
            ['appkey', appKey],
            ['bizcontent', bizcontent],
            ['method', 'test.method'],
            ['version', 'v1.0'],
          ])

          // 计算签名（不含 token/contextid，需求 5.2, 5.3）
          const signWithout = signer.sign(signParams, secret)

          // 验证：即使加入 token/contextid 后再移除，签名结果不变
          const paramsWithExtra = new Map(signParams)
          paramsWithExtra.set('token', token)
          paramsWithExtra.set('contextid', contextid)
          paramsWithExtra.delete('token')
          paramsWithExtra.delete('contextid')
          const signAfterRemoval = signer.sign(paramsWithExtra, secret)

          if (signWithout !== signAfterRemoval) return false

          // 组装请求体（包含 token 和 contextid）
          signParams.set('sign', signWithout)
          const body = encodeFormBody(signParams, token, contextid)

          // 验证：请求体包含 token 和 contextid（需求 5.2, 5.3）
          return body.includes(`token=${token}`) && body.includes(`contextid=${contextid}`)
        }
      ),
      { numRuns: 100 }
    )
  })
})
