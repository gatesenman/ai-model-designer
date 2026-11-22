import { create } from 'zustand'
import type { AppSettings, ProviderConfig, ThemeMode } from '@shared/types'

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  load: () => Promise<void>
  save: (settings: AppSettings) => Promise<void>
  setProvider: (provider: ProviderConfig) => void
  setTheme: (theme: ThemeMode) => Promise<void>
  toggleTheme: () => Promise<void>
  patch: (patch: Partial<AppSettings>) => Promise<void>
}

const fallback: AppSettings = {
  provider: { type: 'mock', temperature: 0.4, azureApiVersion: '2024-02-15-preview' },
  language: 'zh',
  theme: 'light',
  autosaveInterval: 30,
  defaultModelKind: 'logical',
  codegen: { sqlDialect: 'mysql', naming: 'snake_case' }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: fallback,
  loaded: false,
  load: async () => {
    try {
      const s = await window.api.getSettings()
      set({ settings: { ...fallback, ...s }, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
  save: async (settings) => {
    const saved = await window.api.setSettings(settings)
    set({ settings: { ...fallback, ...saved } })
  },
  setProvider: (provider) => set({ settings: { ...get().settings, provider } }),
  setTheme: async (theme) => {
    const next = { ...get().settings, theme }
    set({ settings: next })
    await window.api.setSettings(next)
  },
  toggleTheme: async () => {
    const theme: ThemeMode = get().settings.theme === 'dark' ? 'light' : 'dark'
    await get().setTheme(theme)
  },
  patch: async (p) => {
    const next = { ...get().settings, ...p }
    set({ settings: next })
    await window.api.setSettings(next)
  }
}))
