import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConfigStore } from '../config-store'
import { ErrorCode } from '../types'

describe('ConfigStore', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    delete process.env.ERP_APP_KEY
    delete process.env.ERP_APP_SECRET
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  describe('getAppKey()', () => {
    it('未配置时抛出 ConfigMissingError，错误码为 CONFIG_MISSING', () => {
      const store = new ConfigStore()
      expect(() => store.getAppKey()).toThrow()
      try {
        store.getAppKey()
      } catch (e: any) {
        expect(e.errorCode).toBe(ErrorCode.CONFIG_MISSING)
        expect(e.name).toBe('ConfigMissingError')
      }
    })

    it('已配置时返回正确的 AppKey 值', () => {
      process.env.ERP_APP_KEY = 'my-app-key'
      const store = new ConfigStore()
      expect(store.getAppKey()).toBe('my-app-key')
    })
  })

  describe('getAppSecret()', () => {
    it('未配置时抛出 ConfigMissingError，错误码为 CONFIG_MISSING', () => {
      const store = new ConfigStore()
      expect(() => store.getAppSecret()).toThrow()
      try {
        store.getAppSecret()
      } catch (e: any) {
        expect(e.errorCode).toBe(ErrorCode.CONFIG_MISSING)
        expect(e.name).toBe('ConfigMissingError')
      }
    })

    it('已配置时返回正确的 AppSecret 值', () => {
      process.env.ERP_APP_SECRET = 'my-app-secret'
      const store = new ConfigStore()
      expect(store.getAppSecret()).toBe('my-app-secret')
    })
  })

  it('支持自定义环境变量名', () => {
    process.env.CUSTOM_KEY = 'custom-key-value'
    process.env.CUSTOM_SECRET = 'custom-secret-value'
    const store = new ConfigStore('CUSTOM_KEY', 'CUSTOM_SECRET')
    expect(store.getAppKey()).toBe('custom-key-value')
    expect(store.getAppSecret()).toBe('custom-secret-value')
  })
})
