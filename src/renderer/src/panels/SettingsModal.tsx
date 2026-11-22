import { useEffect, useState } from 'react'
import { Alert, Form, Input, InputNumber, Modal, Select, Slider, Tabs, message } from 'antd'
import { useSettingsStore } from '../store/settingsStore'
import {
  PROVIDER_LABELS,
  MODEL_KIND_LABELS,
  SQL_DIALECT_LABELS
} from '@shared/types'
import { describeProviderStatus } from '@shared/providerStatus'
import type {
  AppSettings,
  ModelKind,
  NamingConvention,
  ProviderConfig,
  ProviderType,
  SqlDialect,
  ThemeMode
} from '@shared/types'

interface Props {
  open: boolean
  onClose: () => void
}

const DEFAULT_MODELS: Record<ProviderType, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20240620',
  azure: '',
  deepseek: 'deepseek-chat',
  qwen: 'qwen-plus',
  ollama: 'llama3.1',
  mock: ''
}

const NAMING_OPTIONS: { value: NamingConvention; label: string }[] = [
  { value: 'snake_case', label: 'snake_case（下划线）' },
  { value: 'camelCase', label: 'camelCase（小驼峰）' },
  { value: 'PascalCase', label: 'PascalCase（大驼峰）' },
  { value: 'original', label: '原样保留' }
]

export default function SettingsModal({ open, onClose }: Props) {
  const settings = useSettingsStore((s) => s.settings)
  const save = useSettingsStore((s) => s.save)
  const [draft, setDraft] = useState<AppSettings>(settings)

  useEffect(() => {
    if (open) setDraft(settings)
  }, [open, settings])

  const cfg = draft.provider
  const updateProvider = (patch: Partial<ProviderConfig>) =>
    setDraft((d) => ({ ...d, provider: { ...d.provider, ...patch } }))
  const updateCodegen = (patch: Partial<AppSettings['codegen']>) =>
    setDraft((d) => ({ ...d, codegen: { ...d.codegen, ...patch } }))

  const handleOk = async () => {
    await save(draft)
    message.success('设置已保存')
    onClose()
  }

  const isMock = cfg.type === 'mock'
  const isAzure = cfg.type === 'azure'
  const isOllama = cfg.type === 'ollama'
  const status = describeProviderStatus(cfg)

  const providerTab = (
    <Form layout="vertical">
      <Form.Item label="供应商">
        <Select
          value={cfg.type}
          onChange={(v: ProviderType) =>
            updateProvider({ type: v, model: DEFAULT_MODELS[v] || cfg.model })
          }
          options={Object.entries(PROVIDER_LABELS).map(([k, label]) => ({
            value: k,
            label
          }))}
        />
      </Form.Item>

      {isMock && (
        <Alert
          type="info"
          showIcon
          message="内置模拟模式无需任何 Key，可离线预览生成与微调。结果来自本地规则，不能代表真实大模型能力。"
        />
      )}
      {status.mode === 'missing-key' && (
        <Alert type="warning" showIcon message={status.hint} style={{ marginBottom: 12 }} />
      )}
      {status.mode === 'ready' && !isMock && (
        <Alert type="info" showIcon message={status.hint} style={{ marginBottom: 12 }} />
      )}

      {!isMock && (
        <>
          {!isOllama && (
            <Form.Item label="API Key">
              <Input.Password
                value={cfg.apiKey}
                onChange={(e) => updateProvider({ apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </Form.Item>
          )}

          <Form.Item
            label={isAzure ? '资源端点 (https://xxx.openai.azure.com)' : 'Base URL（可选，自定义代理）'}
          >
            <Input
              value={cfg.baseURL}
              onChange={(e) => updateProvider({ baseURL: e.target.value })}
              placeholder={isOllama ? 'http://localhost:11434/v1' : '留空使用官方默认'}
            />
          </Form.Item>

          {isAzure ? (
            <>
              <Form.Item label="部署名 (Deployment)">
                <Input
                  value={cfg.azureDeployment}
                  onChange={(e) => updateProvider({ azureDeployment: e.target.value })}
                />
              </Form.Item>
              <Form.Item label="API Version">
                <Input
                  value={cfg.azureApiVersion}
                  onChange={(e) => updateProvider({ azureApiVersion: e.target.value })}
                />
              </Form.Item>
            </>
          ) : (
            <Form.Item label="模型名称">
              <Input
                value={cfg.model}
                onChange={(e) => updateProvider({ model: e.target.value })}
                placeholder={DEFAULT_MODELS[cfg.type]}
              />
            </Form.Item>
          )}

          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="API Key 仅保存在本机。若系统提供安全存储则优先使用；否则回退到本地配置加密。这不是云端托管，也不会在无密钥时假装已经连上供应商。"
          />
          <Form.Item label={`温度 Temperature：${cfg.temperature ?? 0.4}`}>
            <Slider
              min={0}
              max={1}
              step={0.1}
              value={cfg.temperature ?? 0.4}
              onChange={(v) => updateProvider({ temperature: v })}
            />
          </Form.Item>
        </>
      )}
    </Form>
  )

  const generalTab = (
    <Form layout="vertical">
      <Form.Item label="主题">
        <Select
          value={draft.theme}
          onChange={(v: ThemeMode) => setDraft((d) => ({ ...d, theme: v }))}
          options={[
            { value: 'light', label: '浅色' },
            { value: 'dark', label: '深色' }
          ]}
        />
      </Form.Item>
      <Form.Item label="自动保存间隔（秒，0 关闭）">
        <InputNumber
          min={0}
          max={3600}
          style={{ width: '100%' }}
          value={draft.autosaveInterval}
          onChange={(v) => setDraft((d) => ({ ...d, autosaveInterval: v ?? 0 }))}
        />
      </Form.Item>
      <Form.Item label="默认新建模型类型">
        <Select
          value={draft.defaultModelKind}
          onChange={(v: ModelKind) => setDraft((d) => ({ ...d, defaultModelKind: v }))}
          options={Object.entries(MODEL_KIND_LABELS).map(([k, label]) => ({
            value: k,
            label
          }))}
        />
      </Form.Item>
      <Form.Item label="界面语言" extra="目前仅提供简体中文界面，该选项已禁用。">
        <Select value="zh" disabled options={[{ value: 'zh', label: '简体中文' }]} />
      </Form.Item>
    </Form>
  )

  const codegenTab = (
    <Form layout="vertical">
      <Form.Item label="默认 SQL 方言">
        <Select
          value={draft.codegen.sqlDialect}
          onChange={(v: SqlDialect) => updateCodegen({ sqlDialect: v })}
          options={Object.entries(SQL_DIALECT_LABELS).map(([k, label]) => ({
            value: k,
            label
          }))}
        />
      </Form.Item>
      <Form.Item label="默认命名风格">
        <Select
          value={draft.codegen.naming}
          onChange={(v: NamingConvention) => updateCodegen({ naming: v })}
          options={NAMING_OPTIONS}
        />
      </Form.Item>
      <Alert
        type="info"
        showIcon
        message="代码生成默认项会作为「生成」与「批量导出」面板的初始值，仍可在面板内临时调整。"
      />
    </Form>
  )

  return (
    <Modal
      title="设置"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="保存"
      width={600}
    >
      <Tabs
        defaultActiveKey="provider"
        items={[
          { key: 'provider', label: 'AI 供应商', children: providerTab },
          { key: 'general', label: '通用', children: generalTab },
          { key: 'codegen', label: '代码生成', children: codegenTab }
        ]}
      />
    </Modal>
  )
}
