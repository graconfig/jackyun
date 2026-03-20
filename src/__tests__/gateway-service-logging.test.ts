/**
 * GatewayService 日志测试
 * 需求: 8.1, 8.2, 8.3
 */

import * as fc from 'fast-check'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfigStore } from '../config-store'
import { GatewayService, Logger } from '../gateway-service'
import { HttpClient } from '../http-client'
import { Signer } from '../signer'
import { ErpTimeoutError, HttpResponse } from '../types'

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

function makeHttpClient(response: HttpResponse): HttpClient {
  return {
    post: vi.fn().mockResolvedValue(response),
  } as unknown as HttpClient
}

function makeConfigStore(appKey = 'testkey', appSecret = 'testsecret'): ConfigStore {
  const store = new ConfigStore('LOG_TEST_APP_KEY', 'LOG_TEST_APP_SECRET')
  process.env['LOG_TEST_APP_KEY'] = appKey
  process.env['LOG_TEST_APP_SECRET'] = appSecret
  return store
}

function clearConfigEnv() {
  delete process.env['LOG_TEST_APP_KEY']
  delete process.env['LOG_TEST_APP_SECRET']
}

/** 创建可捕获日志输出的 mock Logger */
function makeMockLogger() {
  const infoLogs: string[] = []
  const errorLogs: string[] = []
  const logger: Logger = {
    info: vi.fn((msg: string) => { infoLogs.push(msg) }),
    error: vi.fn((msg: string) => { errorLogs.push(msg) }),
  }
  return { logger, infoLogs, errorLogs }
}

// ─── 单元测试：日志内容（需求 8.2, 8.3）─────────────────────────────────────

describe('GatewayService - 日志内容单元测试', () => {
  afterEach(() => {
    clearConfigEnv()
  })

  it('成功响应时日志包含 HTTP 状态码（需求 8.2）', async () => {
    const { logger, infoLogs } = makeMockLogger()
    const httpClient = makeHttpClient({ status: 200, body: '{"result":"ok"}' })
    const service = new GatewayService(makeConfigStore(), new Signer(), httpClient, logger)

    await service.invoke({ method: 'jst.goods.list', version: '2', bizcontent: '{"pageIndex":1}' })

    const responseLogs = infoLogs.filter(l => l.includes('响应'))
    expect(responseLogs.length).toBeGreaterThan(0)
    expect(responseLogs[0]).toContain('200')
  })

  it('成功响应时日志包含耗时（elapsedMs）（需求 8.2）', async () => {
    const { logger, infoLogs } = makeMockLogger()
    const httpClient = makeHttpClient({ status: 200, body: '{"result":"ok"}' })
    const service = new GatewayService(makeConfigStore(), new Signer(), httpClient, logger)

    await service.invoke({ method: 'jst.goods.list', version: '2', bizcontent: '{"pageIndex":1}' })

    const responseLogs = infoLogs.filter(l => l.includes('响应'))
    expect(responseLogs[0]).toContain('elapsedMs')
  })

  it('ERP 返回非 2xx 时记录异常日志（需求 8.3）', async () => {
    const { logger, errorLogs } = makeMockLogger()
    const httpClient = makeHttpClient({ status: 500, body: 'Internal Server Error' })
    const service = new GatewayService(makeConfigStore(), new Signer(), httpClient, logger)

    await service.invoke({ method: 'test', version: '1', bizcontent: '{}' })

    expect(errorLogs.length).toBeGreaterThan(0)
    expect(errorLogs[0]).toContain('异常')
  })

  it('超时异常时记录错误日志（需求 8.3）', async () => {
    const { logger, errorLogs } = makeMockLogger()
    const httpClient = {
      post: vi.fn().mockRejectedValue(new ErpTimeoutError()),
    } as unknown as HttpClient
    const service = new GatewayService(makeConfigStore(), new Signer(), httpClient, logger)

    await service.invoke({ method: 'test', version: '1', bizcontent: '{}' })

    expect(errorLogs.length).toBeGreaterThan(0)
    expect(errorLogs[0]).toContain('ErpTimeoutError')
  })

  it('未预期异常时记录错误日志（需求 8.3）', async () => {
    const { logger, errorLogs } = makeMockLogger()
    const httpClient = {
      post: vi.fn().mockRejectedValue(new Error('network failure')),
    } as unknown as HttpClient
    const service = new GatewayService(makeConfigStore(), new Signer(), httpClient, logger)

    await service.invoke({ method: 'test', version: '1', bizcontent: '{}' })

    expect(errorLogs.length).toBeGreaterThan(0)
    expect(errorLogs[0]).toContain('network failure')
  })

  it('请求日志包含 method 和 version（需求 8.1）', async () => {
    const { logger, infoLogs } = makeMockLogger()
    const httpClient = makeHttpClient({ status: 200, body: '{}' })
    const service = new GatewayService(makeConfigStore(), new Signer(), httpClient, logger)

    await service.invoke({ method: 'jst.goods.list', version: '2', bizcontent: '{}' })

    const requestLogs = infoLogs.filter(l => l.includes('请求'))
    expect(requestLogs.length).toBeGreaterThan(0)
    expect(requestLogs[0]).toContain('jst.goods.list')
    expect(requestLogs[0]).toContain('"version"')
  })

  it('请求日志包含 contextid（若有）（需求 8.1）', async () => {
    const { logger, infoLogs } = makeMockLogger()
    const httpClient = makeHttpClient({ status: 200, body: '{}' })
    const service = new GatewayService(makeConfigStore(), new Signer(), httpClient, logger)

    await service.invoke({ method: 'test', version: '1', bizcontent: '{}', contextid: 'ctx-123' })

    const requestLogs = infoLogs.filter(l => l.includes('请求'))
    expect(requestLogs[0]).toContain('ctx-123')
  })

  it('请求日志不包含 contextid（若无）（需求 8.1）', async () => {
    const { logger, infoLogs } = makeMockLogger()
    const httpClient = makeHttpClient({ status: 200, body: '{}' })
    const service = new GatewayService(makeConfigStore(), new Signer(), httpClient, logger)

    await service.invoke({ method: 'test', version: '1', bizcontent: '{}' })

    const requestLogs = infoLogs.filter(l => l.includes('请求'))
    expect(requestLogs[0]).not.toContain('contextid')
  })
})

// ─── 属性测试：日志不含敏感信息（需求 8.1）──────────────────────────────────

describe('GatewayService - 属性测试', () => {
  afterEach(() => {
    clearConfigEnv()
  })

  /**
   * Feature: oa-esb-erp-gateway, Property 10: 日志不含敏感信息
   * 生成任意请求，捕获日志输出，验证不含 AppSecret 和 bizcontent 原文
   * Validates: Requirements 8.1
   *
   * 注：使用足够长且独特的字符串（minLength: 8）避免短字符串偶然出现在日志中
   * （例如单个空格可能出现在 JSON 格式化输出中，不代表敏感信息泄露）
   */
  it('属性 10：日志不含敏感信息', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 随机 method（非空，字母数字）
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789.'.split('')), { minLength: 3, maxLength: 30 }),
        // 随机 version（非空）
        fc.stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: 1, maxLength: 5 }),
        // 随机 bizcontent（足够长且独特，含特殊字符）
        fc.string({ minLength: 8, maxLength: 200 }),
        // 随机 AppSecret（足够长且独特）
        fc.string({ minLength: 8, maxLength: 50 }),
        // 随机 AppKey
        fc.string({ minLength: 1, maxLength: 30 }),
        async (method, version, bizcontent, appSecret, appKey) => {
          const { logger, infoLogs, errorLogs } = makeMockLogger()

          const store = new ConfigStore('P10_APP_KEY', 'P10_APP_SECRET')
          process.env['P10_APP_KEY'] = appKey
          process.env['P10_APP_SECRET'] = appSecret

          const httpClient = makeHttpClient({ status: 200, body: '{"ok":true}' })
          const service = new GatewayService(store, new Signer(), httpClient, logger)

          await service.invoke({ method, version, bizcontent })

          delete process.env['P10_APP_KEY']
          delete process.env['P10_APP_SECRET']

          const allLogs = [...infoLogs, ...errorLogs].join('\n')

          // 日志不得包含 AppSecret
          if (allLogs.includes(appSecret)) return false

          // 日志不得包含 bizcontent 原文
          if (allLogs.includes(bizcontent)) return false

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})
