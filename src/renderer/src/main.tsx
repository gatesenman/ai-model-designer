import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import { useSettingsStore } from './store/settingsStore'
import './styles.css'

function Root() {
  const load = useSettingsStore((s) => s.load)
  const loaded = useSettingsStore((s) => s.loaded)
  const mode = useSettingsStore((s) => s.settings.theme)

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    document.body.classList.toggle('theme-dark', mode === 'dark')
  }, [mode])

  if (!loaded) return null

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { colorPrimary: '#3b6cff' }
      }}
    >
      <App />
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
