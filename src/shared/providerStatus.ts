import type { ProviderConfig } from './types'
import { PROVIDER_LABELS } from './types'

export type ProviderRunMode = 'mock' | 'ready' | 'missing-key'

export interface ProviderStatus {
  mode: ProviderRunMode
  /** 状态栏短标签 */
  label: string
  /** 更完整的说明，不声称已验证连通 */
  hint: string
  needsKey: boolean
}

/** 真实供应商调用前是否缺少密钥（Ollama 本地默认可无 Key）。 */
export function providerNeedsApiKey(type: ProviderConfig['type']): boolean {
  return type !== 'mock' && type !== 'ollama'
}

export function describeProviderStatus(provider: ProviderConfig): ProviderStatus {
  const name = PROVIDER_LABELS[provider.type] ?? provider.type
  if (provider.type === 'mock') {
    return {
      mode: 'mock',
      label: '离线模拟',
      hint: '当前为内置模拟，不会调用外部大模型，结果仅供预览，不能当作真实模型能力。',
      needsKey: false
    }
  }
  const key = (provider.apiKey ?? '').trim()
  if (providerNeedsApiKey(provider.type) && !key) {
    return {
      mode: 'missing-key',
      label: `${name}（未配置密钥）`,
      hint: `已选择 ${name}，但尚未填写 API Key。不会假装已经连上该供应商；请在设置中填写密钥，或改回内置模拟。`,
      needsKey: true
    }
  }
  return {
    mode: 'ready',
    label: name,
    hint: `将请求 ${name}。是否可用取决于本机网络、端点与密钥，软件不会在无凭据时伪装已验证。`,
    needsKey: providerNeedsApiKey(provider.type)
  }
}

export function missingProviderKeyError(provider: ProviderConfig): string {
  const name = PROVIDER_LABELS[provider.type] ?? provider.type
  return `未配置 ${name} 的 API Key。请打开设置填写密钥，或将供应商改为「内置模拟」。`
}
