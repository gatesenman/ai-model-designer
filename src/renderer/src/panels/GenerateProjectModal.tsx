import { useMemo, useState } from 'react'
import { Button, Checkbox, Input, Modal, Progress, Tag, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import {
  DIAGRAM_CATALOG,
  DIAGRAM_GROUP_LABELS,
  DIAGRAM_GROUP_ORDER,
  type DiagramGroupId,
  type DiagramTypeDef
} from '@shared/diagramCatalog'
import { MODEL_KIND_LABELS } from '@shared/types'
import { useModelStore } from '../store/modelStore'
import { useSettingsStore } from '../store/settingsStore'
import { generateProjectDiagrams } from '../ai/aiClient'

interface Props {
  open: boolean
  onClose: () => void
}

const ENGINE_BADGE: Record<string, string> = {
  conceptual: '#00a884',
  logical: '#3b6cff',
  physical: '#7c3aed',
  uml: '#6b3bff',
  architecture: '#d4690a'
}

export default function GenerateProjectModal({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState<DiagramGroupId | 'all'>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(
    null
  )
  const config = useSettingsStore((s) => s.settings.provider)
  const addModels = useModelStore((s) => s.addModels)

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    return DIAGRAM_CATALOG.filter((t) => {
      if (activeGroup !== 'all' && t.group !== activeGroup) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        (t.subtitle ?? '').toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      )
    })
  }, [q, activeGroup])

  const grouped = useMemo(() => {
    const map = new Map<DiagramGroupId, DiagramTypeDef[]>()
    for (const t of filtered) {
      const arr = map.get(t.group) ?? []
      arr.push(t)
      map.set(t.group, arr)
    }
    return DIAGRAM_GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      label: DIAGRAM_GROUP_LABELS[g],
      items: map.get(g)!
    }))
  }, [filtered])

  const toggle = (id: string): void =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const reset = (): void => {
    setQuery('')
    setActiveGroup('all')
    setSelected([])
    setPrompt('')
    setProgress(null)
  }

  const handleGenerate = async (): Promise<void> => {
    if (!prompt.trim()) {
      message.warning('请先描述领域需求')
      return
    }
    if (selected.length === 0) {
      message.warning('请至少勾选一种图表')
      return
    }
    setBusy(true)
    setProgress({ done: 0, total: selected.length, name: '' })
    try {
      const docs = await generateProjectDiagrams(config, prompt.trim(), selected, (done, total, name) =>
        setProgress({ done, total, name })
      )
      if (docs.length === 0) {
        message.error('未生成任何图表')
        return
      }
      addModels(docs)
      message.success(`已生成 ${docs.length} 张图表`)
      reset()
      onClose()
    } catch (err) {
      message.error(`生成失败：${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={busy ? undefined : onClose}
      footer={null}
      width={960}
      title="项目驱动生成多张图"
      className="new-diagram-modal"
      styles={{ body: { padding: 0 } }}
      maskClosable={!busy}
    >
      <div className="gpm">
        <div className="gpm__prompt">
          <Input.TextArea
            placeholder="描述你的业务领域，例如：一个面向中小企业的在线订单与库存管理系统，涵盖客户、商品、订单、库存、支付与履约流程…"
            autoSize={{ minRows: 3, maxRows: 6 }}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={busy}
          />
          <div className="gpm__hint">
            AI 会先提炼共享领域术语表，再据此生成所选的每一张图，保证实体命名一致、互相关联。
          </div>
        </div>

        <div className="ndm" style={{ borderTop: '1px solid var(--border, #e5e7eb)' }}>
          <div className="ndm__sidebar">
            <div
              className={`ndm__group-item ${activeGroup === 'all' ? 'active' : ''}`}
              onClick={() => setActiveGroup('all')}
            >
              全部类型
              <span className="ndm__group-count">{DIAGRAM_CATALOG.length}</span>
            </div>
            {DIAGRAM_GROUP_ORDER.map((g) => {
              const count = DIAGRAM_CATALOG.filter((t) => t.group === g).length
              return (
                <div
                  key={g}
                  className={`ndm__group-item ${activeGroup === g ? 'active' : ''}`}
                  onClick={() => setActiveGroup(g)}
                >
                  {DIAGRAM_GROUP_LABELS[g]}
                  <span className="ndm__group-count">{count}</span>
                </div>
              )
            })}
          </div>

          <div className="ndm__main">
            <div className="ndm__search">
              <Input
                allowClear
                size="middle"
                prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                placeholder="搜索图表类型…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="ndm__content">
              {grouped.map(({ group, label, items }) => (
                <div key={group} className="ndm__section">
                  <div className="ndm__section-title">{label}</div>
                  <div className="ndm__grid">
                    {items.map((t) => {
                      const checked = selected.includes(t.id)
                      return (
                        <button
                          key={t.id}
                          className={`ndm__card ${checked ? 'ndm__card--checked' : ''}`}
                          onClick={() => toggle(t.id)}
                          title={t.description}
                        >
                          <div className="ndm__card-top">
                            <Checkbox checked={checked} style={{ marginRight: 6 }} />
                            <span className="ndm__card-name">{t.name}</span>
                            <span
                              className="ndm__card-engine"
                              style={{ color: ENGINE_BADGE[t.engine] }}
                            >
                              {MODEL_KIND_LABELS[t.engine]}
                            </span>
                          </div>
                          {t.subtitle && <div className="ndm__card-sub">{t.subtitle}</div>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="gpm__footer">
          <div className="gpm__selected">
            已选 {selected.length} 张
            {selected.length > 0 && (
              <Button type="link" size="small" onClick={() => setSelected([])} disabled={busy}>
                清空
              </Button>
            )}
          </div>
          {busy && progress && (
            <div className="gpm__progress">
              <Progress
                percent={Math.round((progress.done / progress.total) * 100)}
                size="small"
                status="active"
              />
              <Tag color="processing">
                {progress.done}/{progress.total} {progress.name && `· ${progress.name}`}
              </Tag>
            </div>
          )}
          <div className="gpm__actions">
            <Button onClick={onClose} disabled={busy}>
              取消
            </Button>
            <Button type="primary" loading={busy} onClick={handleGenerate}>
              生成 {selected.length > 0 ? `${selected.length} 张图` : ''}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
