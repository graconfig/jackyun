import { createHash } from 'crypto'
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { Signer } from '../signer'

const signer = new Signer()

// ─── 单元测试：已知签名向量 ────────────────────────────────────────────────────

describe('Signer - 已知签名向量', () => {
  /**
   * 使用吉客云官方文档中的参数验证签名算法正确性
   * 需求: 3.1, 3.2, 3.3
   *
   * 注：文档中的 bizcontent 为单行 JSON（文档排版时换行仅为可读性）。
   * 签名算法：
   *   1. 参数按 ASCII 字典序排列：appkey < bizcontent < contenttype < method < timestamp < version
   *   2. 拼接 key+value 得到 S
   *   3. 完整原文 = secret + S + secret
   *   4. 转小写后 UTF-8 MD5
   */
  it('官方文档参数：签名算法步骤验证', () => {
    const secret = 'f0d1483f1f2e49cea3dfd48c8d7e3c23'
    const bizcontent =
      '{"brandName":"衣服","cateName":"拉链","costValuationMethod":0,"goodsAlias":"花之春","goodsAttr":1,"goodsMemo":"货品备注","goodsName":"行李包 花之春","goodsNameEn":"spring","goodsNo":"H06-2","isBatchManagement":0,"isCustomizProduction":0,"isDoorService":0,"isPaidService":0,"isPeriodManage":0,"isPickupCard":0,"isProsaleProduct":0,"isProxySale":0,"isSerialManagement":0,"outSkuCode":"8714wtst","ownerId":"jackyun_dev","ownerName":"jackyun_dev","shelfLife":0,"shelfLiftUnit":"","skuBarcode":"76620423621","skuHeight":3,"skuId":"","skuLength":3,"skuName":"无特殊字符","skuWeight":20,"skuWidth":4,"unitName":"件"}'
    const params = new Map<string, string>([
      ['appkey', '187657'],
      ['bizcontent', bizcontent],
      ['contenttype', 'json'],
      ['method', 'erp.goods.skuimport'],
      ['timestamp', '2019-07-30 15:18:30'],
      ['version', 'v1.0'],
    ])

    const result = signer.sign(params, secret)

    // 验证输出格式
    expect(result).toMatch(/^[0-9a-f]{32}$/)

    // 验证算法步骤：手动重现签名过程
    // 1. ASCII 字典序：appkey < bizcontent < contenttype < method < timestamp < version
    // 2. S = "appkey187657" + "bizcontent{...}" + "contenttypejson" + "methoderp.goods.skuimport" + "timestamp2019-07-30 15:18:30" + "versionv1.0"
    // 3. 原文 = secret + S + secret，转小写后 MD5
    const sortedKeys = ['appkey', 'bizcontent', 'contenttype', 'method', 'timestamp', 'version']
    const s = sortedKeys.map(k => k + params.get(k)).join('')
    const raw = (secret + s + secret).toLowerCase()
    const expected = createHash('md5').update(raw, 'utf8').digest('hex')

    expect(result).toBe(expected)
  })

  it('简单已知向量：可手动验证的最小用例', () => {
    // params: {a: "1", b: "2"}, secret: "abc"
    // 排序后：a, b
    // S = "a1b2"
    // 原文 = "abc" + "a1b2" + "abc" = "abca1b2abc"（已全小写）
    const expected = createHash('md5').update('abca1b2abc', 'utf8').digest('hex')

    const params = new Map<string, string>([
      ['b', '2'],
      ['a', '1'],
    ])
    expect(signer.sign(params, 'abc')).toBe(expected)
  })

  it('空参数 Map 时签名仅由 secret 首尾拼接后 MD5 决定', () => {
    const secret = 'mysecret'
    // 原文 = "mysecret" + "" + "mysecret" = "mysecretmysecret"
    const expected = createHash('md5').update('mysecretmysecret', 'utf8').digest('hex')

    const params = new Map<string, string>()
    expect(signer.sign(params, secret)).toBe(expected)
  })

  it('大写参数名和值在转小写后参与签名', () => {
    // params: {KEY: "VALUE"}, secret: "SECRET"
    // 原文 = "SECRET" + "KEYVALUE" + "SECRET" = "SECRETKEYVALUESECRET"
    // 转小写 = "secretkeyvaluesecret"
    const expected = createHash('md5').update('secretkeyvaluesecret', 'utf8').digest('hex')

    const params = new Map<string, string>([['KEY', 'VALUE']])
    expect(signer.sign(params, 'SECRET')).toBe(expected)
  })
})

// ─── 属性测试 ─────────────────────────────────────────────────────────────────

describe('Signer - 属性测试', () => {
  /**
   * Feature: oa-esb-erp-gateway, Property 1: 签名格式正确性
   * 对于任意合法参数集合和 AppSecret，输出应匹配 ^[0-9a-f]{32}$
   * Validates: Requirements 3.1, 3.2, 3.3
   */
  it('属性 1：签名格式正确性 - 输出匹配 ^[0-9a-f]{32}$', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.string({ minLength: 0, maxLength: 50 })
          ),
          { minLength: 0, maxLength: 10 }
        ),
        fc.string({ minLength: 1, maxLength: 64 }),
        (entries, secret) => {
          const params = new Map<string, string>(entries)
          const result = signer.sign(params, secret)
          return /^[0-9a-f]{32}$/.test(result)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: oa-esb-erp-gateway, Property 8: 签名确定性
   * 对相同输入调用 Signer 两次，结果完全相同
   * Validates: Requirements 7.2
   */
  it('属性 8：签名确定性 - 相同输入两次调用结果相同', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.string({ minLength: 0, maxLength: 50 })
          ),
          { minLength: 0, maxLength: 10 }
        ),
        fc.string({ minLength: 1, maxLength: 64 }),
        (entries, secret) => {
          const params = new Map<string, string>(entries)
          const result1 = signer.sign(params, secret)
          const result2 = signer.sign(params, secret)
          return result1 === result2
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: oa-esb-erp-gateway, Property 9: 签名顺序无关性
   * 对相同参数不同顺序传入 Signer，结果完全一致
   * Validates: Requirements 7.3
   */
  it('属性 9：签名顺序无关性 - 参数顺序不影响签名结果', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.string({ minLength: 0, maxLength: 50 })
          ),
          { minLength: 1, maxLength: 10 }
        ),
        fc.string({ minLength: 1, maxLength: 64 }),
        (entries, secret) => {
          // 去重（相同 key 保留最后一个，与 Map 行为一致）
          const deduped = new Map<string, string>(entries)
          const dedupedEntries = Array.from(deduped.entries())

          // 打乱顺序：将数组反转作为"不同顺序"
          const shuffled = [...dedupedEntries].reverse()

          const params1 = new Map<string, string>(dedupedEntries)
          const params2 = new Map<string, string>(shuffled)

          return signer.sign(params1, secret) === signer.sign(params2, secret)
        }
      ),
      { numRuns: 100 }
    )
  })
})
