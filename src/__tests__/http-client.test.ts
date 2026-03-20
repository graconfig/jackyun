/**
 * HttpClient 单元测试
 * 需求: 5.1, 5.4
 */

import { EventEmitter } from 'events'
import * as https from 'https'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpClient, RequestFn } from '../http-client'
import { ErpTimeoutError, ErrorCode } from '../types'

// ─── 辅助：构造 mock IncomingMessage ─────────────────────────────────────────

function makeMockResponse(statusCode: number, body: string) {
  const res = new EventEmitter() as NodeJS.ReadableStream & { statusCode?: number }
  res.statusCode = statusCode
  const emitBody = () => {
    res.emit('data', Buffer.from(body, 'utf8'))
    res.emit('end')
  }
  return { res, emitBody }
}

// ─── 辅助：构造 mock ClientRequest ───────────────────────────────────────────

function makeMockRequest() {
  const req = new EventEmitter() as any
  req.write = vi.fn()
  req.end = vi.fn()
  req.destroy = vi.fn()
  return req
}

// ─── 辅助：构造注入用的 requestFn ────────────────────────────────────────────

function makeRequestFn(
  req: ReturnType<typeof makeMockRequest>,
  res?: ReturnType<typeof makeMockResponse>
): RequestFn {
  return (options, callback) => {
    if (res) {
      callback(res.res as any)
      res.emitBody()
    }
    return req
  }
}

// ─── 测试套件 ─────────────────────────────────────────────────────────────────

describe('HttpClient', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── 需求 5.1：Content-Type 为 application/x-www-form-urlencoded ──────────

  it('发送请求时 Content-Type 为 application/x-www-form-urlencoded（需求 5.1）', async () => {
    const mockRes = makeMockResponse(200, '{"result":"ok"}')
    const req = makeMockRequest()
    let capturedOptions: https.RequestOptions | undefined

    const requestFn: RequestFn = (options, callback) => {
      capturedOptions = options
      callback(mockRes.res as any)
      mockRes.emitBody()
      return req
    }

    const client = new HttpClient(requestFn)
    await client.post('https://example.com/api', 'key=value')

    expect(capturedOptions?.headers).toBeDefined()
    expect((capturedOptions!.headers as Record<string, unknown>)['Content-Type'])
      .toBe('application/x-www-form-urlencoded')
  })

  // ─── 需求 5.1：使用 POST 方法 ─────────────────────────────────────────────

  it('使用 HTTP POST 方法发送请求（需求 5.1）', async () => {
    const mockRes = makeMockResponse(200, 'ok')
    const req = makeMockRequest()
    let capturedOptions: https.RequestOptions | undefined

    const requestFn: RequestFn = (options, callback) => {
      capturedOptions = options
      callback(mockRes.res as any)
      mockRes.emitBody()
      return req
    }

    const client = new HttpClient(requestFn)
    await client.post('https://example.com/api', 'a=1')

    expect(capturedOptions?.method).toBe('POST')
  })

  // ─── 需求 5.1：返回 status 和 body ───────────────────────────────────────

  it('成功时返回 { status, body }（需求 5.1）', async () => {
    const mockRes = makeMockResponse(200, '{"data":"hello"}')
    const req = makeMockRequest()
    const client = new HttpClient(makeRequestFn(req, mockRes))

    const result = await client.post('https://example.com/api', 'x=1')

    expect(result.status).toBe(200)
    expect(result.body).toBe('{"data":"hello"}')
  })

  // ─── 需求 5.4：超时 30s 抛出 ErpTimeoutError ─────────────────────────────

  it('超时 30s 时抛出 ErpTimeoutError（需求 5.4）', async () => {
    const req = makeMockRequest()
    // requestFn 不调用 callback，模拟服务器无响应
    const requestFn: RequestFn = (_options, _callback) => req

    const client = new HttpClient(requestFn)
    const postPromise = client.post('https://example.com/api', 'x=1', 30_000)

    vi.advanceTimersByTime(30_000)

    await expect(postPromise).rejects.toBeInstanceOf(ErpTimeoutError)
  })

  it('超时错误码为 ERP_TIMEOUT（需求 5.4）', async () => {
    const req = makeMockRequest()
    const requestFn: RequestFn = (_options, _callback) => req

    const client = new HttpClient(requestFn)
    const postPromise = client.post('https://example.com/api', 'x=1', 30_000)
    vi.advanceTimersByTime(30_000)

    try {
      await postPromise
      expect.fail('应该抛出错误')
    } catch (err) {
      expect(err).toBeInstanceOf(ErpTimeoutError)
      expect((err as ErpTimeoutError).errorCode).toBe(ErrorCode.ERP_TIMEOUT)
    }
  })

  it('自定义超时时间生效', async () => {
    const req = makeMockRequest()
    const requestFn: RequestFn = (_options, _callback) => req

    const client = new HttpClient(requestFn)
    const postPromise = client.post('https://example.com/api', 'x=1', 5_000)

    vi.advanceTimersByTime(4_999)
    // 此时 promise 仍 pending

    vi.advanceTimersByTime(1)
    await expect(postPromise).rejects.toBeInstanceOf(ErpTimeoutError)
  })

  it('在超时前收到响应时正常返回，不抛出超时错误', async () => {
    const mockRes = makeMockResponse(200, 'fast response')
    const req = makeMockRequest()
    const client = new HttpClient(makeRequestFn(req, mockRes))

    const result = await client.post('https://example.com/api', 'x=1', 30_000)

    expect(result.status).toBe(200)
    expect(result.body).toBe('fast response')
  })
})
