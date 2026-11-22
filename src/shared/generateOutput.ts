/** 生成面板输出按「图 + 类别 + 类型 + 相关选项」隔离，避免切标签后旧结果冒充新结果。 */

export interface GenerateOutputKeyParts {
  modelId: string
  category: string
  target: string
  dialect?: string
  naming?: string
}

export interface GenerateSourceParts {
  modelName: string
  categoryLabel: string
  targetLabel: string
  dialectLabel?: string
  naming?: string
}

export function generateOutputKey(parts: GenerateOutputKeyParts): string {
  const dialect =
    parts.category === 'code' && (parts.target === 'sql' || parts.target === 'typescript-prisma')
      ? (parts.dialect ?? '')
      : ''
  const naming = parts.category === 'code' ? (parts.naming ?? '') : ''
  return [parts.modelId, parts.category, parts.target, dialect, naming].join('\u0001')
}

export function describeGenerateSource(parts: GenerateSourceParts): string {
  const bits = [`图「${parts.modelName}」`, parts.categoryLabel, parts.targetLabel]
  if (parts.dialectLabel) bits.push(`方言 ${parts.dialectLabel}`)
  if (parts.naming) bits.push(`命名 ${parts.naming}`)
  return '结果来源：' + bits.join(' · ')
}

export type GenerateSlotStatus = 'empty' | 'pending' | 'error' | 'ready'

export function generateSlotStatus(text: string | undefined): GenerateSlotStatus {
  if (text == null || text.trim() === '') return 'empty'
  const t = text.trim()
  if (t === '生成中…' || t === '生成中...') return 'pending'
  if (t.startsWith('生成失败')) return 'error'
  return 'ready'
}

export function lookupGenerateSlot(
  cache: Record<string, string>,
  key: string
): { text: string; status: GenerateSlotStatus } {
  const text = cache[key] ?? ''
  return { text, status: generateSlotStatus(text) }
}
