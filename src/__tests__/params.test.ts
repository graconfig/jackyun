import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { buildParams, formatTimestamp, validateParams } from '../params'
import { ErrorCode, GatewayRequest, ParamMissingError } from '../types'

// ─── 单元测试：validateParams ─────────────────────────────────────────────────

describe('validateParams - 单元测试', () => {
  const validRequest: GatewayRequest = {
    method: 'jst.goods.list',
    version: 'v1.0',
    bizcontent: '{"pageIndex":1}',
  }

  it('合法请求不抛出错误', () => {
    expect(() => validateParams(validRequest)).not.toThrow()
  })

  it('缺少 method 时抛出 ParamMissingError', () => {
    const req = { ...validRequest, method: '' }
    expect(() => validateParams(req)).toThrow(ParamMissingError)
  })

  it('缺少 version 时抛出 ParamMissingError', () => {
    const req = { ...validRequest, version: '' }
    expect(() => validateParams(req)).toThrow(ParamMissingError)
  })

  it('缺少 bizcontent 时抛出 ParamMissingError', () => {
    const req = { ...validRequest, bizcontent: '' }
    expect(() => validateParams(req)).toThrow(ParamMissingError)
  })

  it('同时缺少多个必填参数时，错误信息包含所有缺失参数名', () => {
    const req = { method: '', version: '', bizcontent: '' }
    try {
      validateParams(req)
      expect.fail('应抛出 ParamMissingError')
    } catch (e) {
      expect(e).toBeInstanceOf(ParamMissingError)
      const err = e as ParamMissingError
      expect(err.errorCode).toBe(ErrorCode.PARAM_MISSING)
      expect(err.message).toContain('method')
      expect(err.message).toContain('version')
      expect(err.message).toContain('bizcontent')
    }
  })

  it('空白字符串视为缺失', () => {
    const req = { ...validRequest, method: '   ' }
    expect(() => validateParams(req)).toThrow(ParamMissingError)
  })
})

// ─── 单元测试：buildParams ────────────────────────────────────────────────────

describe('buildParams - 单元测试', () => {
  const validRequest: GatewayRequest = {
    method: 'jst.goods.list',
    version: 'v1.0',
    bizcontent: '{"pageIndex":1}',
  }
  const appKey = 'test-app-key-123'

  it('返回的 Map 包含 appkey', () => {
    const params = buildParams(validRequest, appKey)
    expect(params.get('appkey')).toBe(appKey)
  })

  it('返回的 Map 包含 timestamp，格式为 yyyy-MM-dd HH:mm:ss', () => {
    const params = buildParams(validRequest, appKey)
    expect(params.get('timestamp')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('返回的 Map 包含 method、version、bizcontent', () => {
    const params = buildParams(validRequest, appKey)
    expect(params.get('method')).toBe(validRequest.method)
    expect(params.get('version')).toBe(validRequest.version)
    expect(params.get('bizcontent')).toBe(validRequest.bizcontent)
  })

  /**
   * 需求 2.1：contenttype 默认值为 "json"
   */
  it('未传 contenttype 时默认填充 "json"', () => {
    const params = buildParams(validRequest, appKey)
    expect(params.get('contenttype')).toBe('json')
  })

  it('传入 contenttype 时使用传入值', () => {
    const req = { ...validRequest, contenttype: 'xml' }
    const params = buildParams(req, appKey)
    expect(params.get('contenttype')).toBe('xml')
  })

  it('不包含 token 和 contextid（不参与签名）', () => {
    const req = { ...validRequest, token: 'tok123', contextid: 'ctx456' }
    const params = buildParams(req, appKey)
    expect(params.has('token')).toBe(false)
    expect(params.has('contextid')).toBe(false)
  })
})

// ─── 单元测试：formatTimestamp ────────────────────────────────────────────────

describe('formatTimestamp - 单元测试', () => {
  it('格式化已知日期', () => {
    const date = new Date(2024, 0, 1, 12, 0, 0) // 2024-01-01 12:00:00
    expect(formatTimestamp(date)).toBe('2024-01-01 12:00:00')
  })

  it('月份和日期补零', () => {
    const date = new Date(2024, 1, 5, 9, 3, 7) // 2024-02-05 09:03:07
    expect(formatTimestamp(date)).toBe('2024-02-05 09:03:07')
  })
})

// ─── 属性测试 ─────────────────────────────────────────────────────────────────

describe('params - 属性测试', () => {
  /**
   * Feature: oa-esb-erp-gateway, Property 4: 必填参数缺失返回 PARAM_MISSING
   * 生成缺少任意必填参数子集的请求，验证错误码和错误信息包含所有缺失参数名
   * Validates: Requirements 2.4
   */
  it('属性 4：必填参数缺失返回 PARAM_MISSING，错误信息包含所有缺失参数名', () => {
    // 生成必填参数的非空子集（至少缺少一个）
    const requiredKeys: ('method' | 'version' | 'bizcontent')[] = ['method', 'version', 'bizcontent']

    fc.assert(
      fc.property(
        // 随机选择要缺失的参数子集（1~3 个）
        fc.subarray([...requiredKeys], { minLength: 1 }),
        // 为未缺失的参数生成合法值
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (missingKeys: string[], method, version, bizcontent) => {
          // 构造请求：缺失的参数设为空字符串
          const request: Partial<GatewayRequest> = {
            method: missingKeys.includes('method') ? '' : method,
            version: missingKeys.includes('version') ? '' : version,
            bizcontent: missingKeys.includes('bizcontent') ? '' : bizcontent,
          }

          try {
            validateParams(request)
            return false // 应该抛出错误，未抛出则测试失败
          } catch (e) {
            if (!(e instanceof ParamMissingError)) return false

            // 验证错误码
            if (e.errorCode !== ErrorCode.PARAM_MISSING) return false

            // 验证错误信息包含所有缺失参数名
            return missingKeys.every(key => e.message.includes(key))
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: oa-esb-erp-gateway, Property 3: 公共参数自动填充
   * 生成任意合法请求，验证请求体中 appkey 等于配置值、timestamp 匹配格式
   * Validates: Requirements 2.2, 2.3
   */
  it('属性 3：公共参数自动填充 - appkey 等于配置值，timestamp 匹配格式', () => {
    fc.assert(
      fc.property(
        // 合法的 method、version、bizcontent
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        // 任意 appKey
        fc.string({ minLength: 1, maxLength: 64 }),
        (method, version, bizcontent, appKey) => {
          const request: GatewayRequest = { method, version, bizcontent }
          const params = buildParams(request, appKey)

          // appkey 等于配置值（需求 2.2）
          if (params.get('appkey') !== appKey) return false

          // timestamp 匹配 yyyy-MM-dd HH:mm:ss 格式（需求 2.3）
          const ts = params.get('timestamp') ?? ''
          return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(ts)
        }
      ),
      { numRuns: 100 }
    )
  })
})
