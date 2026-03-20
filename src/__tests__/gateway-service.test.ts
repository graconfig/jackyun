/**
 * GatewayService 测试
 * 需求: 1.1, 1.2, 2.1-2.4, 3.1-3.5, 4.1-4.2, 5.1-5.5, 6.1-6.2
 */

import * as fc from 'fast-check'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfigStore } from '../config-store'
import { GatewayService } from '../gateway-service'
import { HttpClient } from '../http-client'
import { Signer } from '../signer'
import { ErrorCode, GatewayErrorResponse, GatewayResponse, HttpResponse } from '../types'

// ─── 辅助：构造 mock HttpClient ───────────────────────────────────────────────

function makeHttpClient(response: HttpResponse): HttpClient {
  return {
    post: vi.fn().mockResolvedValue(response),
  } as unknown as HttpClient
}

// ─── 辅助：构造默认 ConfigStore（通过环境变量） ───────────────────────────────

function makeConfigStore(appKey = 'testkey', appSecret = 'testsecret'): ConfigStore {
  const store = new ConfigStore('TEST_APP_KEY', 'TEST_APP_SECRET')
  process.env['TEST_APP_KEY'] = appKey
  process.env['TEST_APP_SECRET'] = appSecret
  return store
}

function clearConfigEnv() {
  delete process.env['TEST_APP_KEY']
  delete process.env['TEST_APP_SECRET']
}

// ─── 单元测试 ─────────────────────────────────────────────────────────────────

describe('GatewayService - 单元测试', () => {
  afterEach(() => {
    clearConfigEnv()
  })

  it('成功调用时返回 ERP 响应体和状态码（需求 6.1, 6.2）', async () => {
    const httpClient = makeHttpClient({ status: 200, body: '{"result":"ok"}' })
    const service = new GatewayService(makeConfigStore(), new Signer(), httpClient)

    const result = await service.invoke({
      method: 'jst.goods.list',
      version: '2',
      bizcontent: '{"pageIndex":1}',
    })

    expect((result as GatewayResponse).body).toBe('{"result":"ok"}')
    expect((result as GatewayResponse).httpStatus).toBe(200)
  })

  it('AppKey 未配置时返回 CONFIG_MISSING（需求 1.2）', async () => {
    delete process.env['TEST_APP_KEY']
    delete process.env['TEST_APP_SECRET']
    const store = new ConfigStore('TEST_APP_KEY', 'TEST_APP_SECRET')
    const service = new GatewayService(store, new Signer(), makeHttpClient({ status: 200, body: '' }))

    const result = await service.invoke({
      method: 'test',
      version: '1',
      bizcontent: '{}',
    }) as GatewayErrorResponse

    expect(result.errorCode).toBe(ErrorCode.CONFIG_MISSING)
  })

  it('缺少必填参数时返回 PARAM_MISSING（需求 2.4）', async () => {
    const service = new GatewayService(
      makeConfigStore(),
      new Signer(),
      makeHttpClient({ status: 200, body: '' })
    )

    const result = await service.invoke({
      method: '',
      version: '1',
      bizcontent: '{}',
    }) as GatewayErrorResponse

    expect(result.errorCode).toBe(ErrorCode.PARAM_MISSING)
    expect(result.detail).toContain('method')
  })

  it('ERP 返回 4xx 时返回 ERP_HTTP_ERROR（需求 5.5）', async () => {
    const httpClient = makeHttpClient({ status: 404, body: 'Not Found' })
    const service = new GatewayService(makeConfigStore(), new Signer(), httpClient)

    const result = await service.invoke({
      method: 'test',
      version: '1',
      bizcontent: '{}',
    }) as GatewayErrorResponse

    expect(result.errorCode).toBe(ErrorCode.ERP_HTTP_ERROR)
    expect(result.detail).toBe('404')
  })

  it('ERP 返回 5xx 时返回 ERP_HTTP_ERROR（需求 5.5）', async () => {
    const httpClient = makeHttpClient({ status: 500, body: 'Internal Server Error' })
    const service = new GatewayService(makeConfigStore(), new Signer(), httpClient)

    const result = await service.invoke({
      method: 'test',
      version: '1',
      bizcontent: '{}',
    }) as GatewayErrorResponse

    expect(result.errorCode).toBe(ErrorCode.ERP_HTTP_ERROR)
    expect(result.detail).toBe('500')
  })

  it('HttpClient 抛出 ErpTimeoutError 时返回 ERP_TIMEOUT（需求 5.4）', async () => {
    const { ErpTimeoutError } = await import('../types')
    const httpClient = {
      post: vi.fn().mockRejectedValue(new ErpTimeoutError()),
    } as unknown as HttpClient

    const service = new GatewayService(makeConfigStore(), new Signer(), httpClient)

    const result = await service.invoke({
      method: 'test',
      version: '1',
      bizcontent: '{}',
    }) as GatewayErrorResponse

    expect(result.errorCode).toBe(ErrorCode.ERP_TIMEOUT)
  })

  it('未预期异常时返回 INTERNAL_ERROR', async () => {
    const httpClient = {
      post: vi.fn().mockRejectedValue(new Error('unexpected network failure')),
    } as unknown as HttpClient

    const service = new GatewayService(makeConfigStore(), new Signer(), httpClient)

    const result = await service.invoke({
      method: 'test',
      version: '1',
      bizcontent: '{}',
    }) as GatewayErrorResponse

    expect(result.errorCode).toBe(ErrorCode.INTERNAL_ERROR)
  })

  // ─── 需求 6.2：响应以 UTF-8 字符编码返回 ─────────────────────────────────

  it('响应体包含 UTF-8 中文字符时原样返回（需求 6.2）', async () => {
    const chineseBody = '{"name":"张三","status":"成功"}'
    const httpClient = makeHttpClient({ status: 200, body: chineseBody })
    const service = new GatewayService(makeConfigStore(), new Signer(), httpClient)

    const result = await service.invoke({
      method: 'test',
      version: '1',
      bizcontent: '{}',
    }) as GatewayResponse

    expect(result.body).toBe(chineseBody)
  })

  it('响应体包含 UTF-8 特殊字符时原样返回（需求 6.2）', async () => {
    const specialBody = '{"emoji":"🎉","symbols":"©®™"}'
    const httpClient = makeHttpClient({ status: 200, body: specialBody })
    const service = new GatewayService(makeConfigStore(), new Signer(), httpClient)

    const result = await service.invoke({
      method: 'test',
      version: '1',
      bizcontent: '{}',
    }) as GatewayResponse

    expect(result.body).toBe(specialBody)
  })
})

// ─── 属性测试 ─────────────────────────────────────────────────────────────────

describe('GatewayService - 属性测试', () => {
  afterEach(() => {
    clearConfigEnv()
  })

  /**
   * Feature: oa-esb-erp-gateway, Property 6: ERP 非 2xx 响应返回 ERP_HTTP_ERROR
   * mock ERP 返回随机 4xx/5xx 状态码，验证错误码为 ERP_HTTP_ERROR 且包含实际状态码
   * Validates: Requirements 5.5
   */
  it('属性 6：ERP 非 2xx 响应返回 ERP_HTTP_ERROR', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 随机 4xx/5xx 状态码
        fc.oneof(
          fc.integer({ min: 400, max: 499 }),
          fc.integer({ min: 500, max: 599 })
        ),
        fc.string({ maxLength: 100 }), // 响应体
        async (statusCode, responseBody) => {
          const httpClient = makeHttpClient({ status: statusCode, body: responseBody })
          const service = new GatewayService(makeConfigStore(), new Signer(), httpClient)

          const result = await service.invoke({
            method: 'test.method',
            version: '1',
            bizcontent: '{"key":"value"}',
          }) as GatewayErrorResponse

          // 错误码必须为 ERP_HTTP_ERROR
          if (result.errorCode !== ErrorCode.ERP_HTTP_ERROR) return false

          // detail 必须包含实际 HTTP 状态码
          if (result.detail !== String(statusCode)) return false

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: oa-esb-erp-gateway, Property 7: 响应体原样透传
   * mock ERP 返回任意 UTF-8 字符串，验证 Gateway 返回内容字节级完全一致
   * Validates: Requirements 6.1
   */
  it('属性 7：响应体原样透传', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 任意 UTF-8 字符串（包含中文、特殊字符等）
        fc.string({ minLength: 0, maxLength: 500 }),
        async (erpBody) => {
          const httpClient = makeHttpClient({ status: 200, body: erpBody })
          const service = new GatewayService(makeConfigStore(), new Signer(), httpClient)

          const result = await service.invoke({
            method: 'test.method',
            version: '1',
            bizcontent: '{"key":"value"}',
          }) as GatewayResponse

          // 响应体必须字节级完全一致
          if (result.body !== erpBody) return false

          // 验证字节级一致性
          const resultBytes = Buffer.from(result.body, 'utf8')
          const erpBytes = Buffer.from(erpBody, 'utf8')
          return resultBytes.equals(erpBytes)
        }
      ),
      { numRuns: 100 }
    )
  })
})
