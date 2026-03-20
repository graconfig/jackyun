import { ConfigMissingError } from './types'

/**
 * 配置存储组件 - 从环境变量读取 AppKey 和 AppSecret
 * 需求: 1.1, 1.2
 */
export class ConfigStore {
  private readonly appKeyEnv: string
  private readonly appSecretEnv: string

  constructor(
    appKeyEnv = 'ERP_APP_KEY',
    appSecretEnv = 'ERP_APP_SECRET'
  ) {
    this.appKeyEnv = appKeyEnv
    this.appSecretEnv = appSecretEnv
  }

  /**
   * 返回 AppKey，未配置时抛出 ConfigMissingError
   */
  getAppKey(): string {
    const value = process.env[this.appKeyEnv]
    if (!value) {
      throw new ConfigMissingError(`环境变量 ${this.appKeyEnv} 未配置`)
    }
    return value
  }

  /**
   * 返回 AppSecret，未配置时抛出 ConfigMissingError
   */
  getAppSecret(): string {
    const value = process.env[this.appSecretEnv]
    if (!value) {
      throw new ConfigMissingError(`环境变量 ${this.appSecretEnv} 未配置`)
    }
    return value
  }
}
