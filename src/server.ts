/**
 * OA ESB ERP 网关 - Web 服务入口
 *
 * POST /invoke
 * Body (JSON): { method, version, bizcontent, contenttype?, token?, contextid? }
 */

import 'dotenv/config'
import express, { Request, Response } from 'express'
import { ConfigStore } from './config-store'
import { GatewayService } from './gateway-service'
import { HttpClient } from './http-client'
import { Signer } from './signer'
import { GatewayRequest } from './types'

const app = express()
app.use(express.json())

const service = new GatewayService(
  new ConfigStore(),
  new Signer(),
  new HttpClient()
)

app.post('/invoke', async (req: Request, res: Response) => {
  const { method, version, bizcontent, contenttype, token, contextid } = req.body

  const request: GatewayRequest = {
    method,
    version,
    bizcontent: typeof bizcontent === 'object' ? JSON.stringify(bizcontent) : bizcontent,
    ...(contenttype && { contenttype }),
    ...(token && { token }),
    ...(contextid && { contextid }),
  }

  const result = await service.invoke(request)
  res.json(result)
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

const PORT = process.env.PORT ?? 3000
app.listen(PORT, () => {
  console.log(`[Gateway] 服务已启动，监听端口 ${PORT}`)
})

export default app
