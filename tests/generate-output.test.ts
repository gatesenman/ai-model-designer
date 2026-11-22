import { describe, expect, it } from 'vitest'
import {
  describeGenerateSource,
  generateOutputKey,
  generateSlotStatus,
  lookupGenerateSlot
} from '@shared/generateOutput'
import { isOutputSavable } from '@shared/projectSession'
import { shouldApplyAiResult } from '@shared/aiRequestGuard'

describe('生成输出隔离与来源标识', () => {
  it('不同图、类别、类型或方言使用不同缓存键', () => {
    const sql = generateOutputKey({
      modelId: 'm1',
      category: 'code',
      target: 'sql',
      dialect: 'mysql',
      naming: 'snake_case'
    })
    const java = generateOutputKey({
      modelId: 'm1',
      category: 'code',
      target: 'java-pojo',
      dialect: 'mysql',
      naming: 'snake_case'
    })
    const pg = generateOutputKey({
      modelId: 'm1',
      category: 'code',
      target: 'sql',
      dialect: 'postgresql',
      naming: 'snake_case'
    })
    const otherModel = generateOutputKey({
      modelId: 'm2',
      category: 'code',
      target: 'sql',
      dialect: 'mysql',
      naming: 'snake_case'
    })
    const data = generateOutputKey({ modelId: 'm1', category: 'data', target: 'json' })
    expect(new Set([sql, java, pg, otherModel, data]).size).toBe(5)
  })

  it('lookup 只返回当前键，切类型后不会拿出旧输出', () => {
    const sql = generateOutputKey({ modelId: 'm1', category: 'code', target: 'sql', dialect: 'mysql', naming: 'snake_case' })
    const java = generateOutputKey({ modelId: 'm1', category: 'code', target: 'java-pojo', naming: 'snake_case' })
    const cache = { [sql]: 'CREATE TABLE t (id int);' }
    expect(lookupGenerateSlot(cache, sql).status).toBe('ready')
    expect(lookupGenerateSlot(cache, java).status).toBe('empty')
    expect(lookupGenerateSlot(cache, java).text).toBe('')
  })

  it('来源文案标明图名、类别与类型，避免被当成当前未生成的新结果', () => {
    const label = describeGenerateSource({
      modelName: '成熟度验收',
      categoryLabel: '代码',
      targetLabel: 'SQL DDL',
      dialectLabel: 'MySQL',
      naming: 'snake_case'
    })
    expect(label).toContain('结果来源：')
    expect(label).toContain('成熟度验收')
    expect(label).toContain('SQL DDL')
    expect(label).toContain('MySQL')
  })

  it('空、生成中、失败均不可保存或复制', () => {
    expect(generateSlotStatus('')).toBe('empty')
    expect(generateSlotStatus('生成中…')).toBe('pending')
    expect(generateSlotStatus('生成失败：boom')).toBe('error')
    expect(generateSlotStatus('CREATE TABLE t (id int);')).toBe('ready')
    expect(isOutputSavable('')).toBe(false)
    expect(isOutputSavable('生成中…')).toBe(false)
    expect(isOutputSavable('生成失败：boom')).toBe(false)
  })
})

describe('取消后旧 AI 请求不得回填', () => {
  it('取消后 activeId 被清空，或已被新请求替换时，不得应用旧结果', () => {
    expect(shouldApplyAiResult('req-1', 'req-1')).toBe(true)
    expect(shouldApplyAiResult(null, 'req-1')).toBe(false)
    expect(shouldApplyAiResult('req-2', 'req-1')).toBe(false)
    expect(shouldApplyAiResult(undefined, 'req-1')).toBe(false)
  })
})
