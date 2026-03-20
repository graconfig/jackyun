/**
 * HttpClient - 向 ERP 开放平台发送 HTTP POST 请求
 * 需求: 5.1, 5.4
 */

import * as http from 'http'
import * as https from 'https'
import { ErpTimeoutError, HttpResponse } from './types'

const DEFAULT_TIMEOUT_MS = 30_000

/** 可注入的 request 函数类型，便于测试 mock */
export type RequestFn = (
  options: https.RequestOptions,
  callback: (res: http.IncomingMessage) => void
) => http.ClientRequest

/**
 * HttpClient
 *
 * 构造时可注入自定义 requestFn，用于单元测试。
 * 生产环境默认使用 Node.js 内置 https.request。
 */
export class HttpClient {
  private readonly requestFn: RequestFn

  constructor(requestFn?: RequestFn) {
    this.requestFn = requestFn ?? ((options, callback) => https.request(options, callback))
  }

  /**
   * 以 application/x-www-form-urlencoded 格式向目标 URL 发送 POST 请求
   * @param url       目标地址
   * @param formBody  请求体（已组装好的 form-urlencoded 字符串）
   * @param timeoutMs 超时毫秒数，默认 30000ms
   * @returns         { status: number, body: string }
   * @throws          ErpTimeoutError 超时时抛出
   */
  post(url: string, formBody: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url)

      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(formBody, 'utf8'),
        },
      }

      let timedOut = false

      const timer = setTimeout(() => {
        timedOut = true
        req.destroy()
        reject(new ErpTimeoutError())
      }, timeoutMs)

      const req = this.requestFn(options, (res) => {
        const chunks: Buffer[] = []

        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk)
        })

        res.on('end', () => {
          if (timedOut) return
          clearTimeout(timer)
          const body = Buffer.concat(chunks).toString('utf8')
          resolve({ status: res.statusCode ?? 0, body })
        })

        res.on('error', (err: Error) => {
          if (timedOut) return
          clearTimeout(timer)
          reject(err)
        })
      })

      req.on('error', (err: Error) => {
        if (timedOut) return
        clearTimeout(timer)
        reject(err)
      })

      req.write(formBody, 'utf8')
      req.end()
    })
  }
}
