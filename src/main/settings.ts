import Store from 'electron-store'
import { safeStorage } from 'electron'
import type { AppSettings } from '../shared/types'

const defaults: AppSettings = {
  provider: {
    type: 'mock',
    model: '',
    temperature: 0.4,
    azureApiVersion: '2024-02-15-preview'
  },
  language: 'zh',
  theme: 'light',
  autosaveInterval: 30,
  defaultModelKind: 'logical',
  codegen: {
    sqlDialect: 'mysql',
    naming: 'snake_case'
  }
}

const store = new Store<{ settings: AppSettings; apiKeyBlob?: string; apiKeyEnc?: string }>({
  name: 'ai-model-designer-settings',
  // 回退加密（safeStorage 不可用时）；密钥仅保护本机配置文件，不是云端保险
  encryptionKey: 'ai-model-designer-local-key',
  defaults: { settings: defaults }
})

function withDefaults(s: Partial<AppSettings> | undefined): AppSettings {
  return {
    ...defaults,
    ...s,
    provider: { ...defaults.provider, ...(s?.provider ?? {}) },
    codegen: { ...defaults.codegen, ...(s?.codegen ?? {}) }
  }
}

function readApiKey(): string | undefined {
  const blob = store.get('apiKeyBlob')
  if (!blob) return undefined
  const enc = store.get('apiKeyEnc')
  if (enc === 'safeStorage') {
    try {
      if (!safeStorage.isEncryptionAvailable()) return undefined
      return safeStorage.decryptString(Buffer.from(blob, 'base64'))
    } catch {
      return undefined
    }
  }
  return blob
}

function writeApiKey(apiKey: string | undefined): void {
  if (!apiKey) {
    store.delete('apiKeyBlob')
    store.delete('apiKeyEnc')
    return
  }
  try {
    if (safeStorage.isEncryptionAvailable()) {
      store.set('apiKeyBlob', safeStorage.encryptString(apiKey).toString('base64'))
      store.set('apiKeyEnc', 'safeStorage')
      return
    }
  } catch {
    /* fall through */
  }
  store.set('apiKeyBlob', apiKey)
  store.set('apiKeyEnc', 'store')
}

export function getSettings(): AppSettings {
  const merged = withDefaults(store.get('settings', defaults))
  const apiKey = readApiKey() ?? merged.provider.apiKey
  return { ...merged, provider: { ...merged.provider, apiKey } }
}

export function setSettings(settings: AppSettings): AppSettings {
  const merged = withDefaults(settings)
  writeApiKey(merged.provider.apiKey)
  const { apiKey: _omit, ...providerRest } = merged.provider
  store.set('settings', { ...merged, provider: providerRest })
  return getSettings()
}
